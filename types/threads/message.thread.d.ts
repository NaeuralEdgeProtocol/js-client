export const THREAD_START_OK: "thread.start.ok";
export const THREAD_START_ERR: "thread.start.err";
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
        naeuralBC: {
            debug: boolean;
            key: any;
            encrypt: boolean;
            secure: boolean;
        };
        commsDiagnostics: {
            enabled: boolean;
            windowMs: number;
            netMonSampleRate: number;
        };
        fleet: string[];
    };
    state: {};
    addressToNodeName: {};
    nodeNameToAddress: {};
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
     * The NaeuralEdgeProtocol Blockchain Engine
     *
     * @type {NaeuralBC}
     */
    naeuralBC: NaeuralBC;
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
    signatureDebugEnabled: boolean;
    commsDiagnostics: {
        enabled: boolean;
        windowMs: number;
        netMonSampleRate: number;
    };
    commsCounterWindow: any;
    commsWindowStartedAt: number;
    commsWindowTimer: any;
    commsSequence: number;
    netMonSeen: number;
    run(mqttClient: any): void;
    _emitDecodedMessage(message: any): void;
    do(command: any, message: any): void;
    /*************************************
     * Internal thread operations
     *************************************/
    _refreshAddresses(message: any): void;
    _reportMemoryUsage(): void;
    _updateState(data: any): void;
    _updateFleet(eventData: any): void;
    _watchForSessionId(data: any): void;
    _removePathFromWatchlist(watchlist: any, path: any): any;
    _ignoreSessionId(data: any): void;
    _watchForStickySessionId(data: any): void;
    _makeContext(path: any, address: any): {
        address: any;
        node: string;
        pipeline: any;
        instance: any;
        metadata: any;
    };
    _postToMain(message: any): void;
    _publishToRedis(channel: any, message: any, typeHint?: any): void;
    _commsPrefix(): string;
    _createCommsCounterWindow(): {
        mqttMessageReceived: number;
        bufferToStringOk: number;
        bufferToStringError: number;
        signaturePass: number;
        signatureFail: number;
        signatureError: number;
        signatureBypassOnError: number;
        jsonParseOk: number;
        jsonParseFail: number;
        edgeNodePass: number;
        edgeNodeDrop: number;
        fleetPass: number;
        fleetDrop: number;
        formatPass: number;
        formatDrop: number;
        decodeOk: number;
        decodeError: number;
        supervisorAdminSeen: number;
        supervisorNetMonSeen: number;
        netMonCandidateSeen: number;
        netMonDropSignature: number;
        netMonDropParse: number;
        netMonDropFleet: number;
        netMonDropFormatter: number;
        netMonDropDecode: number;
        netMonDecodePass: number;
        netMonSupervisorSeen: number;
        netMonCurrentNetworkMissing: number;
        netMonCurrentNetworkMalformed: number;
        netMonSignaturePathMismatch: number;
        funnelException: number;
        postedToMainByType: {};
        postedToRedisByType: {};
        dropReasons: {};
        bypassReasons: {};
    };
    _resetCommsDiagnosticsWindow(): void;
    _scheduleCommsDiagnosticsWindow(): void;
    _flushCommsDiagnosticsWindow(): void;
    _incrementCommsCounter(counter: any, amount?: number): void;
    _incrementCommsTypeCounter(bucket: any, type: any): void;
    _registerDropReason(reason: any): void;
    _registerBypassReason(reason: any): void;
    _normalizeFormatterKey(formatter: any): string;
    _buildSafeTraceIdentifiers(message: any, rawMessage?: any): {
        sender: any;
        payloadPathHead: any;
        payloadPathSignature: any;
        messageId: any;
        messageSeq: any;
    };
    _isNetMonRawCandidate(rawMessage: any): boolean;
    _isNetMonMessage(message: any): boolean;
    _markNetMonSampling(envelope: any): void;
    _traceNetMonStage(envelope: any, stage: any, outcome: any, extra?: {}): void;
    _normalizeThrownError(error: any): {
        name: any;
        message: string;
        stack: any;
        thrownType: string;
    };
    _onFunnelException(stage: any, error: any, envelope?: any): void;
    _createFunnelEnvelope(message: any): {
        seq: number;
        mqttMessage: any;
        rawMessage: any;
        message: any;
        netMonCandidate: boolean;
        netMonSamplingMarked: boolean;
        traceNetMon: boolean;
    };
    _stageBufferToString(envelope: any): any;
    _stageSignatureGate(envelope: any): boolean;
    _stageJsonParse(envelope: any): any;
    _stageEdgeNodeGate(envelope: any): boolean;
    _stageFleetGate(envelope: any): boolean;
    _stageFormatterGate(envelope: any): boolean;
    _stageDecode(envelope: any): Promise<any>;
    /*************************************
     * Network messages funnel methods
     *************************************/
    _bufferToString(message: any): any;
    _messageIsSigned(message: any): boolean;
    _toJSON(message: any, options?: {}): any;
    _messageIsFromEdgeNode(message: any): boolean;
    _processSupervisorPayload(message: any, envelope?: any): void;
    _messageFromControlledFleet(message: any): boolean;
    _messageHasKnownFormat(message: any): boolean;
    _decodeToInternalFormat(message: any): Promise<any>;
    /**
     * Returns the address for a given value if the value is a node name, returns the value if the value is already
     * and address.
     *
     * @param {string} value
     * @return {string|null}
     * @private
     */
    private _getAddress;
    /**
     * Returns the node name for a given address. Returns null if address has not been observed.
     *
     * @param {string} address
     * @return {string|null}
     * @private
     */
    private _getNodeForAddress;
    /**
     * Returns the address for a given node name. Returns null if node has not been observed.
     *
     * @param {string} node
     * @return {string|null}
     * @private
     */
    private _getAddressForNode;
}
export function forwardCommandToThread(threadInstance: any, command: any, message: any, threadLogger: any): void;
import EventEmitter2 from 'eventemitter2';
import * as mqtt from 'mqtt';
import { NaeuralBC } from '../utils/blockchain.js';
