export const THREAD_START_OK: "thread.start.ok";
export const THREAD_START_ERR: "thread.start.ok";
export class Thread extends EventEmitter2 {
    constructor(options: any, redisOptions: any, logger: any);
    /**
     * The main thread connection.
     *
     * @type {MessagePort}
     */
    mainThread: MessagePort;
    pubSubChannel: string;
    threadId: string;
    /**
     * The network connection.
     *
     * @type {mqtt.MqttClient}
     */
    mqttClient: mqtt.MqttClient;
    threadType: string;
    startupOptions: {
        connection: {
            topic: any;
            url: any;
            username: any;
            password: any;
            clean: boolean;
            clientId: any;
        };
        stateManager: string;
        redis: {
            host: string;
            port: number;
            password: any;
            pubSubChannel: string;
        };
        secure: boolean;
        zxaibc: {
            debug: boolean;
            key: any;
            encrypt: boolean;
            secure: boolean;
        };
        fleet: string[];
    };
    state: {};
    cache: any;
    publishChannel: any;
    subscriptionChannel: any;
    formatters: {
        raw: {
            in: (message: any) => any;
        };
        '0xai1.0': {
            in: (message: any) => any;
        };
    };
    /**
     * The DecentrAI Blockchain Engine
     *
     * @type {ZxAIBC}
     */
    zxaibc: ZxAIBC;
    watchlist: {};
    stickySessions: {};
    logger: any;
    /**
     * Flag for signaling if messages should be encrypted.
     *
     * @type {boolean}
     * @private
     */
    private encryptCommunication;
    /**
     * Flag for signaling if unsafe messages should be processed.
     *
     * @private
     * @type {boolean}
     */
    private secure;
    run(mqttClient: any): void;
    do(command: any, message: any): void;
    /*************************************
     * Internal thread operations
     *************************************/
    _reportMemoryUsage(): void;
    _updateState(data: any): void;
    _updateFleet(data: any): void;
    _watchForSessionId(data: any): void;
    _removePathFromWatchlist(watchlist: any, path: any): any;
    _ignoreSessionId(data: any): void;
    _watchForStickySessionId(data: any): void;
    _makeContext(path: any): {
        pipeline: any;
        instance: any;
        metadata: any;
    };
    _onError(err: any): void;
    /*************************************
     * Network messages funnel methods
     *************************************/
    _bufferToString(message: any): string;
    _messageIsSigned(message: any): boolean;
    _toJSON(message: any): any;
    _messageIsFromEdgeNode(message: any): boolean;
    _processSupervisorPayload(message: any): void;
    _messageFromControlledFleet(message: any): boolean;
    _messageHasKnownFormat(message: any): boolean;
    _decodeToInternalFormat(message: any): Promise<any>;
}
import EventEmitter2 from 'eventemitter2';
import * as mqtt from 'mqtt';
import { ZxAIBC } from '../utils/blockchain.js';
