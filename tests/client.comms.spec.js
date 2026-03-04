import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { Naeural } from '../src/client.js';
import { INTERNAL_STATE_MANAGER } from '../src/constants.js';
import { THREAD_START_ERR, THREAD_START_OK } from '../src/threads/message.thread.js';

const trackedClients = [];

const makeLogger = () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
});

const makeClient = (overrides = {}) => {
    const client = new Naeural(
        {
            initiator: overrides.initiator,
            stateManager: INTERNAL_STATE_MANAGER,
            mqttOptions: {
                url: 'mqtt://localhost',
                username: null,
                password: null,
                clean: true,
                clientId: null,
                prefix: 'jsclient',
                ...(overrides.mqttOptions ?? {}),
            },
            redis: {
                host: 'localhost',
                port: 6379,
                password: null,
                pubSubChannel: 'null',
                ...(overrides.redis ?? {}),
            },
            threads: {
                heartbeats: 0,
                notifications: 0,
                payloads: 0,
                ...(overrides.threads ?? {}),
            },
            blockchain: {
                debug: false,
                key: '',
                encrypt: true,
                secure: true,
                ...(overrides.blockchain ?? {}),
            },
            fleet: overrides.fleet ?? [],
            ...(overrides.options ?? {}),
        },
        makeLogger(),
    );

    trackedClients.push(client);
    return client;
};

afterEach(() => {
    trackedClients.forEach((client) => {
        if (client.mainCommsWindowTimer) {
            clearInterval(client.mainCommsWindowTimer);
        }
    });
    trackedClients.length = 0;
});

describe('Main Thread Comms Setup', () => {
    test('THREAD_START_ERR differs from THREAD_START_OK and marks thread as non-running', () => {
        expect(THREAD_START_ERR).not.toBe(THREAD_START_OK);

        const client = makeClient();
        client.threads.heartbeats.push({
            id: 'thread-1',
            thread: {},
        });

        client.markThreadStatus({
            threadType: 'heartbeats',
            threadId: 'thread-1',
            type: THREAD_START_ERR,
            status: {
                mqtt: {
                    connection: true,
                    topic: false,
                },
                redis: {
                    cache: true,
                    publishChannel: true,
                    subscriptionChannel: true,
                    topic: true,
                },
            },
        });

        expect(client.threads.heartbeats[0].booted).toBe(true);
        expect(client.threads.heartbeats[0].running).toBe(false);
    });

    test('pubSubChannel is built from resolved initiator when initiator is omitted', () => {
        const client = makeClient({
            initiator: undefined,
        });

        expect(client.bootOptions.initiator).toBeTruthy();
        expect(client.bootOptions.redis.pubSubChannel).toBe(`updates-${client.bootOptions.initiator}`);
        expect(client.bootOptions.redis.pubSubChannel).not.toBe('updates-null');
    });
});
