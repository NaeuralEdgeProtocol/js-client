import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import {
    Thread,
    THREAD_CONNECTED_REDIS_OK,
    THREAD_SUBSCRIBED_MQTT_ERR,
    THREAD_SUBSCRIBED_MQTT_OK, THREAD_SUBSCRIBED_REDIS_OK,
} from '../../src/threads/message.thread.js';
import { ZxAIBC } from '../../src/utils/blockchain.js';
import {
    ALL_EDGE_NODES,
    INTERNAL_STATE_MANAGER, MESSAGE_TYPE_OBSERVED_NODE,
    REDIS_STATE_MANAGER, THREAD_TYPE_HEARTBEATS,
    THREAD_TYPE_UNKNOWN, ZxAI_CLIENT_CONNECTED,
} from '../../src/constants.js';
import eventemitter from 'eventemitter2';

const { EventEmitter2 } = eventemitter;

const mqttOpMocks = {
    subscribe: jest.fn((topic, callback) => {
        callback(null, 'mocked message');
    }),
    publish: jest.fn(),
    end: jest.fn(),
};

class MqttMock extends EventEmitter2 {
    constructor() {
        super();
        this.subscribe = mqttOpMocks.subscribe;
        this.publish = mqttOpMocks.publish;
        this.end = mqttOpMocks.end;
    }
}

describe('Thread Class', () => {
    const options = {
        id: '123',
        type: THREAD_TYPE_UNKNOWN,
        config: {
            connection: {
                topic: 'mock/topic',
                url: 'http://mock.url',
                username: 'mock-user',
                password: 'mock-pass',
                clean: true,
                clientId: null,
            },
            stateManager: REDIS_STATE_MANAGER,
            redis: {
                host: 'localhost',
                port: 6379,
                pubSubChannel: 'channel',
            },
            secure: false,
            zxaibc: {
                fromFile: false,
                debugMode: false,
                keyPair: null,
            },
            fleet: [ ALL_EDGE_NODES ],
        },
        formatters: {},
    };

    const mockRedis = {
        get: jest.fn(),
        set: jest.fn(),
        subscribe: jest.fn((topic, callback) => {
            callback(null);
        }),
        on: jest.fn(),
    };

    let clientMock;

    beforeEach(() => {
        jest.clearAllMocks();
        clientMock = new MqttMock();
    });

    describe('constructor', () => {
        test('should set properties correctly when redis state manager is used', () => {
            const parentPort = jest.fn();
            const thread = new Thread(parentPort, options, mockRedis);

            // expect(thread.mainThread).toBe(parentPort);
            expect(thread.threadId).toBe(options.id);
            expect(thread.threadType).toBe(options.type);
            expect(thread.startupOptions).toEqual(options.config);
            expect(thread.zxaibc).toBeInstanceOf(ZxAIBC);
            expect(thread.pubSubChannel).toBe(options.config.redis.pubSubChannel);
        });

        test('Thread runs correctly with Redis state manager', () => {
            const parentPort = jest.fn();
            const thread = new Thread(parentPort, options, mockRedis);
            const threadEmitterSpy = jest.spyOn(thread, 'emit');

            thread.run(clientMock);
            clientMock.emit('connect', { dummy: 'data' });

            expect(mockRedis.subscribe.mock.calls[0][0]).toBe('channel');
            expect(typeof mockRedis.subscribe.mock.calls[0][1]).toBe('function');
            expect(mockRedis.on.mock.calls[0][0]).toBe('message');
            expect(typeof mockRedis.subscribe.mock.calls[0][1]).toBe('function');
            expect(mqttOpMocks.subscribe.mock.calls[0][0]).toBe('mock/topic');
            expect(typeof mockRedis.subscribe.mock.calls[0][1]).toBe('function');

            expect(threadEmitterSpy).toHaveBeenCalledWith(THREAD_SUBSCRIBED_MQTT_OK, {
                error: false,
                thread: '123',
                message: options.config.connection.topic,
            });

            expect(threadEmitterSpy).toHaveBeenCalledWith(THREAD_CONNECTED_REDIS_OK, {
                error: false,
                thread: '123',
                message: 'Redis connected.',
            });

            expect(threadEmitterSpy).toHaveBeenCalledWith(THREAD_SUBSCRIBED_REDIS_OK, {
                error: false,
                thread: '123',
                message: 'channel',
            });
        });

        test('should set properties correctly when redis state manager is not used', () => {
            const parentPort = jest.fn();
            const options = {
                id: '456',
                type: 'worker',
                config: {
                    connection: {
                        topic: null,
                        url: null,
                        username: null,
                        password: null,
                        clean: true,
                        clientId: null,
                    },
                    stateManager: INTERNAL_STATE_MANAGER,
                    redis: {
                    },
                    secure: false,
                    zxaibc: {
                        fromFile: false,
                        debugMode: false,
                        keyPair: null,
                    },
                    fleet: [ ALL_EDGE_NODES ],
                },
                formatters: {},
            };

            const thread = new Thread(parentPort, options);

            expect(thread.threadId).toBe(options.id);
            expect(thread.threadType).toBe(options.type);
            expect(thread.startupOptions).toEqual(options.config);
            expect(thread.zxaibc).toBeInstanceOf(ZxAIBC);
            expect(thread.redis).toBeNull();
            expect(thread.pubSubChannel).toBe('unknown');
        });
    });

    describe('toJSON method', () => {
        test('should return parsed message when valid JSON is provided', () => {
            const thread = new Thread(null, options);

            const inputMessage = '{"key": "value"}';
            const result = thread.toJSON(inputMessage);

            expect(result).toEqual({ key: 'value' });
        });
    });

    describe('messageIsFromEdgeNode method', () => {
        test('should return true if the message has EE_PAYLOAD_PATH property', () => {
            const thread = new Thread(null, options);

            const messageWithPayloadPath = {
                EE_PAYLOAD_PATH: ['node', null, null, null],
                otherProperty: 'value',
            };

            const result = thread.messageIsFromEdgeNode(messageWithPayloadPath);

            expect(result).toBe(true);
        });

        test('should return false if the message does not have EE_PAYLOAD_PATH property', () => {
            const thread = new Thread(null, options);

            const messageWithoutPayloadPath = {
                otherProperty: 'value',
            };

            const result = thread.messageIsFromEdgeNode(messageWithoutPayloadPath);

            expect(result).toBe(false);
        });
    });

    describe('messageFromControlledFleet method', () => {
        // test('should return true and post a message if the message is from a controlled fleet node', () => {
        //     const mainThread = { postMessage: jest.fn() };
        //     const opt = { ...options };
        //     opt.type = THREAD_TYPE_HEARTBEATS;
        //     opt.config.fleet = ['node1', 'node2'];
        //     const thread = new Thread(mainThread, opt);
        //
        //     const message = {
        //         EE_PAYLOAD_PATH: ['node1', 'subpath'],
        //     };
        //
        //     const postMessageMock = jest.spyOn(mainThread, 'postMessage');
        //     const result = thread.messageFromControlledFleet(message);
        //     expect(result).toBe(true);
        //     expect(postMessageMock).toHaveBeenCalledWith({
        //         threadId: thread.threadId,
        //         type: MESSAGE_TYPE_OBSERVED_NODE,
        //         success: true,
        //         error: null,
        //         data: {
        //             node: 'node1',
        //             timestamp: expect.any(Number),
        //         },
        //     });
        //
        //     postMessageMock.mockRestore();
        // });

        test('should return false and not post a message if the message is not from a controlled fleet node', () => {
            const mainThread = { postMessage: jest.fn() };
            const opt = { ...options };
            opt.config.fleet = ['node1', 'node2'];
            const thread = new Thread(mainThread, opt);

            const message = {
                EE_PAYLOAD_PATH: ['uncontrolledNode', 'subpath'],
            };

            // Mock the postMessage method
            const postMessageMock = jest.spyOn(mainThread, 'postMessage');

            const result = thread.messageFromControlledFleet(message);

            expect(result).toBe(false);
            expect(postMessageMock).not.toHaveBeenCalled();

            postMessageMock.mockRestore();
        });
    });

});
