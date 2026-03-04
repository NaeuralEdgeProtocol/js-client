import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { Buffer } from 'node:buffer';
import {
    ALL_EDGE_NODES,
    INTERNAL_STATE_MANAGER,
    MESSAGE_TYPE_PAYLOAD,
    THREAD_TYPE_PAYLOADS,
} from '../../src/constants.js';
import { Thread } from '../../src/threads/message.thread.js';

const makeLogger = () => ({
    setThreadId: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
});

const makeThread = (overrides = {}) => {
    const logger = makeLogger();
    const thread = new Thread(
        {
            id: overrides.id ?? 'thread-test-1',
            type: overrides.type ?? THREAD_TYPE_PAYLOADS,
            config: {
                connection: {
                    topic: 'topic',
                    url: 'mqtt://localhost',
                    username: null,
                    password: null,
                    clean: true,
                    clientId: null,
                },
                stateManager: INTERNAL_STATE_MANAGER,
                redis: {
                    host: 'localhost',
                    port: 6379,
                    password: null,
                    pubSubChannel: 'updates-test',
                },
                naeuralBC: {
                    debug: false,
                    secure: true,
                    encrypt: true,
                    key: null,
                },
                commsDiagnostics: {
                    enabled: true,
                    windowMs: 60_000,
                    netMonSampleRate: 10,
                },
                fleet: [ALL_EDGE_NODES],
                ...overrides.config,
            },
            formatters: {},
        },
        null,
        logger,
    );

    return { thread, logger };
};

const trackedThreads = [];

afterEach(() => {
    trackedThreads.forEach((thread) => {
        if (thread.commsWindowTimer) {
            clearInterval(thread.commsWindowTimer);
        }
    });
    trackedThreads.length = 0;
});

describe('Message Thread Comms Diagnostics', () => {
    test('secure=false bypasses signature verification gate', () => {
        const { thread } = makeThread({
            config: {
                naeuralBC: {
                    debug: false,
                    secure: false,
                    encrypt: false,
                    key: null,
                },
            },
        });
        trackedThreads.push(thread);

        const unsigned = JSON.stringify({
            EE_FORMATTER: 'raw',
            DATA: {
                sample: true,
            },
        });

        expect(thread._messageIsSigned(unsigned)).toBe(true);
    });

    test('signature failure increments drop counters and next message still passes signature stage', () => {
        const { thread } = makeThread();
        trackedThreads.push(thread);

        const invalidEnvelope = thread._createFunnelEnvelope([null, null, { payload: Buffer.from('{"bad":"signature"}') }]);
        thread._stageBufferToString(invalidEnvelope);

        expect(thread._stageSignatureGate(invalidEnvelope)).toBe(false);
        expect(thread.commsCounterWindow.signatureFail).toBe(1);
        expect(thread.commsCounterWindow.dropReasons.signature_invalid).toBe(1);

        const signedMessage = thread.naeuralBC.sign(
            {
                EE_FORMATTER: 'raw',
                EE_PAYLOAD_PATH: ['0xai_test', 'p', 'sig', 'inst'],
                EE_EVENT_TYPE: MESSAGE_TYPE_PAYLOAD,
                DATA: {
                    value: 1,
                },
            },
            'json',
        );

        const validEnvelope = thread._createFunnelEnvelope([null, null, { payload: Buffer.from(signedMessage) }]);
        thread._stageBufferToString(validEnvelope);

        expect(thread._stageSignatureGate(validEnvelope)).toBe(true);
        expect(thread.commsCounterWindow.signaturePass).toBe(1);
    });

    test('formatter empty or case-variant is accepted and counted', async () => {
        const { thread } = makeThread();
        trackedThreads.push(thread);

        const baseMessage = {
            EE_PAYLOAD_PATH: ['0xai_test', 'pipeline', 'plugin', 'instance'],
            EE_SENDER: '0xai_test',
            EE_EVENT_TYPE: 'UNKNOWN_EVENT',
            DATA: {
                value: 1,
            },
        };

        const upperCaseEnvelope = {
            message: {
                ...baseMessage,
                EE_FORMATTER: 'RAW',
            },
            traceNetMon: false,
        };
        const emptyFormatterEnvelope = {
            message: {
                ...baseMessage,
                EE_FORMATTER: '',
            },
            traceNetMon: false,
        };

        expect(thread._stageFormatterGate(upperCaseEnvelope)).toBe(true);
        expect(thread._stageFormatterGate(emptyFormatterEnvelope)).toBe(true);

        await expect(
            thread._decodeToInternalFormat({
                ...baseMessage,
                EE_FORMATTER: 'RAW',
            }),
        ).resolves.toBeDefined();
        await expect(
            thread._decodeToInternalFormat({
                ...baseMessage,
                EE_FORMATTER: '',
            }),
        ).resolves.toBeDefined();

        expect(thread.commsCounterWindow.formatPass).toBe(2);
    });

    test('_onFunnelException safely handles non-Error thrown values', () => {
        const { thread, logger } = makeThread();
        trackedThreads.push(thread);

        expect(() => thread._onFunnelException('stage-string', 'boom-string')).not.toThrow();
        expect(() => thread._onFunnelException('stage-object', { bad: 'payload' })).not.toThrow();
        expect(() => thread._onFunnelException('stage-null', null)).not.toThrow();

        expect(thread.commsCounterWindow.funnelException).toBe(3);
        expect(logger.error).toHaveBeenCalledTimes(3);
    });

    test('_stageBufferToString marks NET_MON trace outcome as error on decode failure', () => {
        const { thread } = makeThread();
        trackedThreads.push(thread);
        const traceSpy = jest.spyOn(thread, '_traceNetMonStage');

        const envelope = thread._createFunnelEnvelope([null, null, { payload: null }]);
        thread._stageBufferToString(envelope);

        expect(thread.commsCounterWindow.bufferToStringError).toBe(1);
        expect(thread.commsCounterWindow.dropReasons.buffer_to_string_error).toBe(1);
        expect(traceSpy).toHaveBeenCalledWith(
            expect.any(Object),
            'buffer_to_string',
            'error',
            { reason: 'buffer_to_string_error' },
        );
    });

    test('signature exception with secure=false bypasses without drop classification', () => {
        const { thread } = makeThread({
            config: {
                naeuralBC: {
                    debug: false,
                    secure: false,
                    encrypt: false,
                    key: null,
                },
            },
        });
        trackedThreads.push(thread);

        thread.naeuralBC.verify = jest.fn(() => {
            throw 'verification exploded';
        });

        const envelope = thread._createFunnelEnvelope([null, null, { payload: Buffer.from('anything') }]);
        thread._stageBufferToString(envelope);

        expect(thread._stageSignatureGate(envelope)).toBe(true);
        expect(thread.commsCounterWindow.signatureError).toBe(1);
        expect(thread.commsCounterWindow.signatureBypassOnError).toBe(1);
        expect(thread.commsCounterWindow.bypassReasons.signature_exception_insecure_bypass).toBe(1);
        expect(thread.commsCounterWindow.dropReasons.signature_exception).toBeUndefined();
    });
});
