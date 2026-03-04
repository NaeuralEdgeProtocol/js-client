import { parentPort } from 'worker_threads';
import * as mqtt from 'mqtt';
import { catchError, concatMap, EMPTY, filter, from, fromEvent, map, tap } from 'rxjs';
import { processHeartbeat } from './heartbeat.processor.js';
import { notificationProcessor } from './notification.processor.js';
import { payloadProcessor } from './payload.processor.js';
import { rawIn } from '../formatters/raw.formatter.js';
import { identityFormatter } from '../formatters/identity.formatter.js';
import {
    ALL_EDGE_NODES,
    INTERNAL_STATE_MANAGER,
    MESSAGE_TYPE_HEARTBEAT,
    MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE,
    MESSAGE_TYPE_NOTIFICATION,
    MESSAGE_TYPE_OBSERVED_NODE,
    MESSAGE_TYPE_PAYLOAD,
    MESSAGE_TYPE_SUPERVISOR_STATUS,
    REDIS_STATE_MANAGER,
    STICKY_COMMAND_ID_KEY,
    THREAD_COMMAND_IGNORE_SESSION_ID,
    THREAD_COMMAND_START,
    THREAD_COMMAND_UPDATE_FLEET,
    THREAD_COMMAND_UPDATE_STATE,
    THREAD_COMMAND_WATCH_FOR_SESSION_ID,
    THREAD_COMMAND_WATCH_FOR_STICKY_SESSION_ID,
    THREAD_TYPE_HEARTBEATS,
    THREAD_TYPE_NOTIFICATIONS,
    THREAD_TYPE_PAYLOADS,
    THREAD_TYPE_UNKNOWN,
    logLevels,
    THREAD_COMMAND_MEMORY_USAGE,
    MESSAGE_TYPE_THREAD_MEMORY_USAGE,
    MESSAGE_TYPE_NETWORK_NODE_DOWN,
    MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD,
    MESSAGE_TYPE_THREAD_LOG, ADDRESSES_UPDATES_INBOX, MESSAGE_TYPE_REFRESH_ADDRESSES, ADMIN_PIPELINE_NAME,
    NETMON_SIGNATURE,
} from '../constants.js';
import { NaeuralBC } from '../utils/blockchain.js';
import {hasFleetFilter, isAddress} from '../utils/helper.functions.js';
import EventEmitter2 from 'eventemitter2';
import { getRedisConnection } from '../utils/redis.connection.provider.js';

export const THREAD_START_OK = 'thread.start.ok';
export const THREAD_START_ERR = 'thread.start.err';

const COMMS_DIAGNOSTIC_WINDOW_MS = 60_000;
const NETMON_TRACE_SAMPLE_RATE = 10;

class ThreadLogger {
    /**
     * @type {MessagePort}
     */
    mainThread;

    threadId = null;

    constructor() {
        this.mainThread = parentPort;
    }

    setThreadId(threadId) {
        this.threadId = threadId;
    }

    log(message, context) {
        this.mainThread.postMessage({
            threadId: this.threadId,
            type: MESSAGE_TYPE_THREAD_LOG,
            level: logLevels.info,
            message,
            context,
        });
    }

    error(message, context) {
        this.mainThread.postMessage({
            threadId: this.threadId,
            type: MESSAGE_TYPE_THREAD_LOG,
            level: logLevels.error,
            message,
            context,
        });
    }

    warn(message, context) {
        this.mainThread.postMessage({
            threadId: this.threadId,
            type: MESSAGE_TYPE_THREAD_LOG,
            level: logLevels.warn,
            message,
            context,
        });
    }

    debug(message, context) {
        this.mainThread.postMessage({
            threadId: this.threadId,
            type: MESSAGE_TYPE_THREAD_LOG,
            level: logLevels.debug,
            message,
            context,
        });
    }

    verbose(message, context) {
        this.mainThread.postMessage({
            threadId: this.threadId,
            type: MESSAGE_TYPE_THREAD_LOG,
            level: logLevels.verbose,
            message,
            context,
        });
    }
}

const logger = new ThreadLogger();

const bootStatus = {
    mqtt: {
        connection: null,
        topic: null,
    },
    redis: {
        cache: null,
        publishChannel: null,
        subscriptionChannel: null,
        topic: null,
    },
};

const bootSeqCompleted = () => {
    return (
        bootStatus.mqtt.connection !== null &&
        bootStatus.mqtt.topic !== null &&
        bootStatus.redis.cache !== null &&
        bootStatus.redis.publishChannel !== null &&
        bootStatus.redis.subscriptionChannel !== null &&
        bootStatus.redis.topic !== null
    );
};

const bootedSuccessfully = () => {
    return (
        bootStatus.mqtt.connection === true &&
        bootStatus.mqtt.topic === true &&
        bootStatus.redis.cache === true &&
        bootStatus.redis.publishChannel === true &&
        bootStatus.redis.subscriptionChannel === true &&
        bootStatus.redis.topic === true
    );
};

const markBootUpdate = (path, status, threadId, threadType) => {
    const [module, component] = path.split('.');
    bootStatus[module][component] = status;

    let event = THREAD_START_OK;
    if (bootSeqCompleted()) {
        if (!bootedSuccessfully()) {
            event = THREAD_START_ERR;
        }

        parentPort.postMessage({
            threadId: threadId,
            threadType: threadType,
            type: event,
            status: bootStatus,
        });
    }
};

export class Thread extends EventEmitter2 {
    /**
     * The main thread connection.
     *
     * @type {MessagePort}
     */
    mainThread;

    pubSubChannel = 'unknown';

    threadId = 'none';

    /**
     * The network connection.
     *
     * @type {mqtt.MqttClient}
     */
    mqttClient = null;

    threadType = THREAD_TYPE_UNKNOWN;

    startupOptions = {
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
            host: 'localhost',
            port: 6379,
            password: null,
            pubSubChannel: 'null',
        },
        secure: false,
        naeuralBC: {
            debug: false,
            key: null,
            encrypt: true,
            secure: true,
        },
        commsDiagnostics: {
            enabled: true,
            windowMs: COMMS_DIAGNOSTIC_WINDOW_MS,
            netMonSampleRate: NETMON_TRACE_SAMPLE_RATE,
        },
        fleet: [ALL_EDGE_NODES],
    };

    state = {};

    addressToNodeName = {};

    nodeNameToAddress = {};

    cache = null;

    publishChannel = null;

    subscriptionChannel = null;

    formatters = {
        raw: { in: rawIn },
        '0xai1.0': { in: identityFormatter },
    };

    /**
     * The NaeuralEdgeProtocol Blockchain Engine
     *
     * @type {NaeuralBC}
     */
    naeuralBC = null;

    watchlist = {};

    stickySessions = {};

    logger;

    /**
     * Flag for signaling if messages should be encrypted.
     *
     * @type {boolean}
     * @private
     */
    encryptCommunication = true;

    /**
     * Flag for signaling if unsafe messages should be processed.
     *
     * @private
     * @type {boolean}
     */
    secure = true;

    signatureDebugEnabled = false;

    commsDiagnostics = {
        enabled: true,
        windowMs: COMMS_DIAGNOSTIC_WINDOW_MS,
        netMonSampleRate: NETMON_TRACE_SAMPLE_RATE,
    };

    commsCounterWindow = null;

    commsWindowStartedAt = 0;

    commsWindowTimer = null;

    commsSequence = 0;

    netMonSeen = 0;

    constructor(options, redisOptions, logger) {
        super();
        this.logger = logger;
        this.logger.setThreadId(options.id);

        this.mainThread = parentPort;
        this.threadId = options.id;
        this.threadType = options.type;
        this.startupOptions = Object.assign(this.startupOptions, options.config);
        this.startupOptions.commsDiagnostics = Object.assign(
            {},
            this.startupOptions.commsDiagnostics,
            options.config?.commsDiagnostics ?? {},
        );
        this.startupOptions.naeuralBC = Object.assign({}, this.startupOptions.naeuralBC, {
            debug: this.startupOptions.naeuralBC?.debug ?? this.startupOptions.naeuralBC?.debugMode ?? false,
        });
        this.naeuralBC = new NaeuralBC(this.startupOptions.naeuralBC);

        this.encryptCommunication = this.startupOptions.naeuralBC.encrypt ?? true;
        this.secure = this.startupOptions.naeuralBC.secure ?? true;
        this.signatureDebugEnabled = this.startupOptions.naeuralBC.debug === true;
        this.commsDiagnostics.enabled = this.startupOptions.commsDiagnostics.enabled !== false;
        this.commsDiagnostics.windowMs = Number.isFinite(this.startupOptions.commsDiagnostics.windowMs)
            ? Math.max(1_000, this.startupOptions.commsDiagnostics.windowMs)
            : COMMS_DIAGNOSTIC_WINDOW_MS;
        this.commsDiagnostics.netMonSampleRate = Number.isFinite(this.startupOptions.commsDiagnostics.netMonSampleRate)
            ? Math.max(1, this.startupOptions.commsDiagnostics.netMonSampleRate)
            : NETMON_TRACE_SAMPLE_RATE;
        this._resetCommsDiagnosticsWindow();
        this._scheduleCommsDiagnosticsWindow();
        this.logger.log(
            `${this._commsPrefix()} startup secure=${this.secure} signatureDebugEnabled=${this.signatureDebugEnabled} commsDiagnostics.enabled=${this.commsDiagnostics.enabled} windowMs=${this.commsDiagnostics.windowMs} netMonSampleRate=${this.commsDiagnostics.netMonSampleRate}`,
        );

        this.logger.log(
            `Starting new ${options.type} thread with ${this.startupOptions.stateManager} state manager...`,
        );

        if (this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
            this.logger.log('... configuring Redis state manager');

            this.pubSubChannel = this.startupOptions.redis.pubSubChannel;
            this.cache = getRedisConnection(redisOptions, this.logger, `Redis cache [Thread ${this.threadId}]`);
            this.publishChannel = getRedisConnection(redisOptions, this.logger, `Redis publisher [Thread ${this.threadId}]`);
            this.subscriptionChannel = getRedisConnection(redisOptions, this.logger, `Redis subscriber [Thread ${this.threadId}]`);
        }

        const formatters = this.formatters;

        if (options.formatters !== undefined && typeof options.formatters === 'object') {
            Object.keys(options.formatters).forEach((formatterName) => {
                this.logger.log(`... loading custom formatters: ${formatterName}`);
                const normalizedFormatter = this._normalizeFormatterKey(formatterName);
                // Dynamic import of the formatter
                import(options.formatters[formatterName]).then(
                    (module) => {
                        if (Object.keys(module).includes('_in')) {
                            if (!formatters[normalizedFormatter]) {
                                formatters[normalizedFormatter] = {};
                            }
                            formatters[normalizedFormatter].in = module._in;

                            this.logger.log(`... loaded ${normalizedFormatter}:_in`);
                        }

                        if (Object.keys(module).includes('_out')) {
                            if (!formatters[normalizedFormatter]) {
                                formatters[normalizedFormatter] = {};
                            }
                            formatters[normalizedFormatter].out = module._out;

                            this.logger.log(`... loaded ${normalizedFormatter}:_out`);
                        }
                    },
                    (err) => {
                        this.logger.warn(`... error while importing ${formatterName}.`);
                        this.logger.debug('... stacktrace: ', err);
                    },
                );
            });
        }

        this.logger.log('... configuration complete.');
    }

    run(mqttClient) {
        this.mqttClient = mqttClient;
        this.mqttClient.on('connect', () => {
            this.logger.log('Successfully connected to MQTT.');
            markBootUpdate('mqtt.connection', true, this.threadId, this.threadType);
            this.mqttClient.subscribe(this.startupOptions.connection.topic, { qos: 2 },(err) => {
                if (!err) {
                    this.logger.log(`Successfully subscribed to ${this.startupOptions.connection.topic}.`);
                    markBootUpdate('mqtt.topic', true, this.threadId, this.threadType);

                    return;
                }

                this.logger.error(`Could not subscribe to ${this.startupOptions.connection.topic}.`);
                markBootUpdate('mqtt.topic', false, this.threadId, this.threadType);
            });
        });

        this.mqttClient.on('error', (err) => {
            this.logger.error(`MQTT client on thread ${this.threadId} error:`, err);
        });

        this.mqttClient.on('disconnect', () => {
            this.logger.error(`MQTT client on thread ${this.threadId} disconnected`);
        });

        this.mqttClient.on('offline', () => {
            this.logger.error(`MQTT client on thread ${this.threadId}  is offline`);
        });

        this.mqttClient.on('reconnect', () => {
            this.logger.warn(`MQTT client on thread ${this.threadId} attempting to reconnect...`);
        });

        this.mqttClient.on('close', () => {
            this.logger.warn(`MQTT client on thread ${this.threadId} connection closed`);
        });

        this.mqttClient.on('end', () => {
            this.logger.warn(`MQTT client on thread ${this.threadId} connection ended`);
        });

        if (this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
            markBootUpdate('redis.subscriptionChannel', !!this.subscriptionChannel, this.threadId, this.threadType);
            markBootUpdate('redis.publishChannel', !!this.publishChannel, this.threadId, this.threadType);
            markBootUpdate('redis.cache', !!this.cache, this.threadId, this.threadType);

            this.subscriptionChannel.subscribe(this.pubSubChannel, (err) => {
                if (err) {
                    this.logger.debug('Redis PubSub Stacktrace:', err);
                    markBootUpdate('redis.topic', false, this.threadId, this.threadType);
                } else {
                    markBootUpdate('redis.topic', true, this.threadId, this.threadType);
                }
            });

            this.subscriptionChannel.subscribe(ADDRESSES_UPDATES_INBOX, (err) => {
                if (err) {
                    this.logger.debug(`Topic: ${ADDRESSES_UPDATES_INBOX} Redis PubSub Stacktrace:`, err);
                }
            });

            this.subscriptionChannel.on('message', (channel, message) => {
                const parsed = JSON.parse(message);
                this.do(parsed.command, parsed);
            });
        } else {
            markBootUpdate('redis.subscriptionChannel', true, this.threadId, this.threadType);
            markBootUpdate('redis.publishChannel', true, this.threadId, this.threadType);
            markBootUpdate('redis.cache', true, this.threadId, this.threadType);
            markBootUpdate('redis.topic', true, this.threadId, this.threadType);
        }

        fromEvent(this.mqttClient, 'message')
            .pipe(
                map((message) => this._createFunnelEnvelope(message)),
                map((envelope) => this._stageBufferToString(envelope)),
                filter((envelope) => this._stageSignatureGate(envelope)),
                map((envelope) => this._stageJsonParse(envelope)),
                filter((envelope) => envelope.message !== null),
                filter((envelope) => this._stageEdgeNodeGate(envelope)),
                tap((envelope) => this._processSupervisorPayload(envelope.message, envelope)),
                filter((envelope) => this._stageFleetGate(envelope)),
                filter((envelope) => this._stageFormatterGate(envelope)),
                concatMap((envelope) =>
                    from(this._stageDecode(envelope)).pipe(
                        filter((decodedEnvelope) => decodedEnvelope !== null),
                        catchError((error) => {
                            this._incrementCommsCounter('decodeError');
                            this._registerDropReason('decode_exception');
                            this._traceNetMonStage(envelope, 'decode', 'error', {
                                reason: 'decode_exception',
                            });
                            this._onFunnelException('decode', error, envelope);

                            return EMPTY;
                        }),
                    ),
                ),
                catchError((error, caught) => {
                    this._onFunnelException('stream', error, null);

                    return caught;
                }),
            )
            .subscribe({
                next: (envelope) => {
                    this._emitDecodedMessage(envelope.message);
                },
                error: (error) => {
                    this._onFunnelException('subscription', error, null);
                },
            });
    }

    _emitDecodedMessage(message) {
        try {
            const context = this._makeContext(message.EE_PAYLOAD_PATH, message.EE_SENDER);
            let data = message;

            // route heartbeats as they come
            if (this.threadType === THREAD_TYPE_HEARTBEATS) {
                this._postToMain({
                    threadId: this.threadId,
                    type: message.EE_EVENT_TYPE,
                    success: true,
                    error: null,
                    data,
                    context,
                });

                return;
            }

            // build the data and the context for this message
            data = { ...message.DATA };
            delete message.DATA;
            context.metadata = message;
            context.metadata.SESSION_ID = data.SESSION_ID;

            // add notification metadata to context
            if (message.EE_EVENT_TYPE === MESSAGE_TYPE_NOTIFICATION) {
                context.metadata.NOTIFICATION_CODE = data.NOTIFICATION_CODE;
                context.metadata.NOTIFICATION_TAG = data.NOTIFICATION_TAG;
                context.metadata.NOTIFICATION_TYPE = data.NOTIFICATION_TYPE;
            }

            const sessionId = context.metadata.SESSION_ID;
            let path = [...context.metadata.EE_PAYLOAD_PATH];
            path[0] = this._getAddress(path[0]);
            path = path.join(':');

            // for notifications, route responses to expecting inboxes for transaction handling
            // then bubble the notification for the consumer
            if (this.threadType === THREAD_TYPE_NOTIFICATIONS) {
                // notification is relevant for another thread
                if ((sessionId !== null && !!this.watchlist[sessionId]) || !!this.watchlist[path]) {
                    if (this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
                        const receivers = this.watchlist[sessionId] ? [this.watchlist[sessionId]] : this.watchlist[path];
                        receivers.forEach((receiver) => {
                            this._publishToRedis(
                                receiver,
                                {
                                    type: MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE,
                                    data,
                                    context,
                                },
                                MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE,
                            );
                        });
                    } else {
                        this._postToMain({
                            threadId: this.threadId,
                            type: MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE,
                            success: true,
                            error: null,
                            data,
                            context,
                        });
                    }
                }

                this._postToMain({
                    threadId: this.threadId,
                    type: message.EE_EVENT_TYPE,
                    success: true,
                    error: null,
                    data,
                    context,
                });

                return;
            }

            if (this.threadType === THREAD_TYPE_PAYLOADS) {
                if (
                    (Object.hasOwn(data, 'COMMAND_PARAMS') && !!data.COMMAND_PARAMS[STICKY_COMMAND_ID_KEY]) ||
                    (Object.hasOwn(data, 'ON_COMMAND_REQUEST') && !!data.ON_COMMAND_REQUEST[STICKY_COMMAND_ID_KEY])
                ) {
                    const stickyId = data.COMMAND_PARAMS !== undefined
                        ? data.COMMAND_PARAMS[STICKY_COMMAND_ID_KEY]
                        : data.ON_COMMAND_REQUEST[STICKY_COMMAND_ID_KEY];

                    const receiver = this.stickySessions[stickyId];

                    if (receiver && this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
                        this._publishToRedis(
                            receiver,
                            {
                                threadId: this.threadId,
                                type: message.EE_EVENT_TYPE,
                                success: true,
                                error: null,
                                data,
                                context,
                            },
                            message.EE_EVENT_TYPE,
                        );

                        return;
                    }
                }

                this._postToMain({
                    threadId: this.threadId,
                    type: message.EE_EVENT_TYPE,
                    success: true,
                    error: null,
                    data,
                    context,
                });
            }
        } catch (error) {
            this._onFunnelException('emit_decoded', error, { message });
        }
    }

    do(command, message) {
        this.logger.debug(`Received command "${command}"`);

        switch (command) {
            case THREAD_COMMAND_UPDATE_FLEET:
                this._updateFleet(message);
                break;
            case THREAD_COMMAND_UPDATE_STATE:
                this._updateState(message);
                break;
            case THREAD_COMMAND_WATCH_FOR_SESSION_ID:
                this._watchForSessionId(message);
                break;
            case THREAD_COMMAND_IGNORE_SESSION_ID:
                this._ignoreSessionId(message);
                break;
            case THREAD_COMMAND_WATCH_FOR_STICKY_SESSION_ID:
                this._watchForStickySessionId(message);
                break;
            case THREAD_COMMAND_MEMORY_USAGE:
                this._reportMemoryUsage();
                break;
            case MESSAGE_TYPE_REFRESH_ADDRESSES:
                this._refreshAddresses(message);
                break;
        }
    }

    /*************************************
     * Internal thread operations
     *************************************/

    _refreshAddresses(message) {
        this.logger.debug('Refreshed addresses in consumer thread.');

        if (message.nodes !== undefined && message.nodes !== null) {
            this.nodeNameToAddress = message.nodes;
        }

        if (message.addresses !== undefined && message.addresses !== null) {
            this.addressToNodeName = message.addresses;
        }
    }

    _reportMemoryUsage() {
        this._postToMain({
            threadId: this.threadId,
            type: MESSAGE_TYPE_THREAD_MEMORY_USAGE,
            success: true,
            error: null,
            // eslint-disable-next-line no-undef
            data: process.memoryUsage(),
        });
    }

    _updateState(data) {
        if (this.threadType === THREAD_TYPE_HEARTBEATS) {
            // heartbeats threads don't need the state
            return;
        }

        if (!this.state[data.address]) {
            this.state[data.address] = {};
        }

        this.state[data.address] = data.state;
    }

    _updateFleet(eventData) {
        this.logger.log(`Change for ${eventData.node} to be ${eventData.action > 0 ? 'added to' : 'removed from'} the fleet has been received.`);

        if (eventData.action > 0 && !this.startupOptions.fleet.includes(eventData.node)) {
            this.startupOptions.fleet.push(eventData.node);
        } else if (eventData.action < 0 && this.startupOptions.fleet.includes(eventData.node)) {
            this.startupOptions.fleet = this.startupOptions.fleet.filter(item => item !== eventData.node);
        }
    }

    _watchForSessionId(data) {
        if (this.threadType !== THREAD_TYPE_NOTIFICATIONS) {
            return;
        }

        this.watchlist[data.requestId] = data.handler;
        data.watches.forEach((path) => {
            const key = path.join(':');
            if (!this.watchlist[key]) {
                this.watchlist[key] = [];
            }

            this.watchlist[key].push(data.handler);
        });
    }

    _removePathFromWatchlist(watchlist, path) {
        const index = watchlist.indexOf(path);
        if (index > -1) {
            return watchlist.filter((item) => item !== path);
        }

        return watchlist;
    }

    _ignoreSessionId(data) {
        if (this.threadType !== THREAD_TYPE_NOTIFICATIONS) {
            return;
        }

        if (this.watchlist[data.requestId]) {
            delete this.watchlist[data.requestId];
        }

        data.watches.forEach((path) => {
            const key = path.join(':');
            if (!this.watchlist[key]) {
                this.watchlist[key] = [];
            }

            this.watchlist[key] = this._removePathFromWatchlist(this.watchlist[key], data.handler);
            if (this.watchlist[key].length === 0) {
                delete this.watchlist[key];
            }
        });
    }

    _watchForStickySessionId(data) {
        if (this.threadType !== THREAD_TYPE_PAYLOADS) {
            return;
        }

        this.stickySessions[data.stickyId] = data.handler;
    }

    _makeContext(path, address) {
        const context = {
            address: address,
            node: this._getNodeForAddress(address),
            pipeline: null,
            instance: null,
            metadata: null,
        };

        if (path[1] !== null) {
            // needs pipeline context
            const pipeline = this.state[address] && this.state[address][path[1]] ? this.state[address][path[1]] : null;
            if (pipeline) {
                context.pipeline = {
                    name: path[1],
                    type: pipeline.config.TYPE,
                    config: { ...pipeline.config },
                    stats: { ...pipeline.stats },
                    pluginsCount: Object.keys(pipeline.plugins)
                        .map((signature) => Object.keys(pipeline.plugins[signature]).length)
                        .reduce((r, v) => r + v, 0),
                };
            }
        }

        if (path[2] !== null && path[3] !== null) {
            // needs instance context
            const signature = path[2];
            const instanceId = path[3];
            const instance =
                !!this.state[address] &&
                !!this.state[address][path[1]]?.plugins[signature] &&
                !!this.state[address][path[1]]?.plugins[signature][instanceId]
                    ? this.state[address][path[1]].plugins[signature][instanceId]
                    : null;

            let config = {};
            if (instance !== null && instance?.config !== undefined) {
                config = { ...instance.config };
            }

            let stats = {};
            if (instance !== null && instance?.stats !== undefined) {
                stats = { ...instance.stats };
            }

            context.instance = {
                name: instanceId,
                signature,
                config: config,
                stats: stats,
            };
        }

        return context;
    }

    _postToMain(message) {
        this._incrementCommsTypeCounter('postedToMainByType', message.type ?? 'unknown');
        this.mainThread?.postMessage(message);
    }

    _publishToRedis(channel, message, typeHint = null) {
        const type = typeHint ?? message.type ?? message.command ?? 'unknown';
        this._incrementCommsTypeCounter('postedToRedisByType', type);
        this.publishChannel?.publish(channel, JSON.stringify(message));
    }

    _commsPrefix() {
        return `[COMMS][JSCLIENT][thread=${this.threadId}][type=${this.threadType}]`;
    }

    _createCommsCounterWindow() {
        return {
            mqttMessageReceived: 0,
            bufferToStringOk: 0,
            bufferToStringError: 0,
            signaturePass: 0,
            signatureFail: 0,
            signatureError: 0,
            signatureBypassOnError: 0,
            jsonParseOk: 0,
            jsonParseFail: 0,
            edgeNodePass: 0,
            edgeNodeDrop: 0,
            fleetPass: 0,
            fleetDrop: 0,
            formatPass: 0,
            formatDrop: 0,
            decodeOk: 0,
            decodeError: 0,
            supervisorAdminSeen: 0,
            supervisorNetMonSeen: 0,
            netMonCandidateSeen: 0,
            netMonDropSignature: 0,
            netMonDropParse: 0,
            netMonDropFleet: 0,
            netMonDropFormatter: 0,
            netMonDropDecode: 0,
            netMonDecodePass: 0,
            netMonSupervisorSeen: 0,
            netMonCurrentNetworkMissing: 0,
            netMonCurrentNetworkMalformed: 0,
            netMonSignaturePathMismatch: 0,
            funnelException: 0,
            postedToMainByType: {},
            postedToRedisByType: {},
            dropReasons: {},
            bypassReasons: {},
        };
    }

    _resetCommsDiagnosticsWindow() {
        this.commsCounterWindow = this._createCommsCounterWindow();
        this.commsWindowStartedAt = Date.now();
    }

    _scheduleCommsDiagnosticsWindow() {
        if (!this.commsDiagnostics.enabled) {
            return;
        }

        if (this.commsWindowTimer) {
            clearInterval(this.commsWindowTimer);
        }

        this.commsWindowTimer = setInterval(() => {
            this._flushCommsDiagnosticsWindow();
        }, this.commsDiagnostics.windowMs);
    }

    _flushCommsDiagnosticsWindow() {
        if (!this.commsDiagnostics.enabled || this.commsCounterWindow === null) {
            return;
        }

        const windowMs = Date.now() - this.commsWindowStartedAt;
        this.logger.log(
            `${this._commsPrefix()} summary windowMs=${windowMs} counters=${JSON.stringify(this.commsCounterWindow)}`,
        );
        this._resetCommsDiagnosticsWindow();
    }

    _incrementCommsCounter(counter, amount = 1) {
        if (!this.commsDiagnostics.enabled || this.commsCounterWindow === null) {
            return;
        }

        if (!Object.hasOwn(this.commsCounterWindow, counter)) {
            this.commsCounterWindow[counter] = 0;
        }
        this.commsCounterWindow[counter] += amount;
    }

    _incrementCommsTypeCounter(bucket, type) {
        if (!this.commsDiagnostics.enabled || this.commsCounterWindow === null) {
            return;
        }

        if (!Object.hasOwn(this.commsCounterWindow[bucket], type)) {
            this.commsCounterWindow[bucket][type] = 0;
        }
        this.commsCounterWindow[bucket][type] += 1;
    }

    _registerDropReason(reason) {
        if (!this.commsDiagnostics.enabled || this.commsCounterWindow === null) {
            return;
        }

        if (!Object.hasOwn(this.commsCounterWindow.dropReasons, reason)) {
            this.commsCounterWindow.dropReasons[reason] = 0;
        }
        this.commsCounterWindow.dropReasons[reason] += 1;
    }

    _registerBypassReason(reason) {
        if (!this.commsDiagnostics.enabled || this.commsCounterWindow === null) {
            return;
        }

        if (!Object.hasOwn(this.commsCounterWindow.bypassReasons, reason)) {
            this.commsCounterWindow.bypassReasons[reason] = 0;
        }
        this.commsCounterWindow.bypassReasons[reason] += 1;
    }

    _normalizeFormatterKey(formatter) {
        if (typeof formatter !== 'string') {
            return 'raw';
        }

        const key = formatter.trim().toLowerCase();
        return key === '' ? 'raw' : key;
    }

    _buildSafeTraceIdentifiers(message, rawMessage = null) {
        let safeMessage = message;

        if ((!safeMessage || typeof safeMessage !== 'object') && typeof rawMessage === 'string') {
            try {
                safeMessage = JSON.parse(rawMessage);
            } catch {
                safeMessage = null;
            }
        }

        const path = Array.isArray(safeMessage?.EE_PAYLOAD_PATH) ? safeMessage.EE_PAYLOAD_PATH : [];
        return {
            sender: safeMessage?.EE_SENDER ?? null,
            payloadPathHead: path[0] ?? null,
            payloadPathSignature: path[2] ?? null,
            messageId: safeMessage?.EE_MESSAGE_ID ?? null,
            messageSeq: safeMessage?.EE_MESSAGE_SEQ ?? null,
        };
    }

    _isNetMonRawCandidate(rawMessage) {
        if (typeof rawMessage !== 'string') {
            return false;
        }

        return rawMessage.toLowerCase().includes(NETMON_SIGNATURE.toLowerCase());
    }

    _isNetMonMessage(message) {
        const signature = Array.isArray(message?.EE_PAYLOAD_PATH) ? message.EE_PAYLOAD_PATH[2] : null;
        return typeof signature === 'string' && signature.toLowerCase() === NETMON_SIGNATURE.toLowerCase();
    }

    _markNetMonSampling(envelope) {
        if (!envelope.netMonCandidate || envelope.netMonSamplingMarked) {
            return;
        }

        this._incrementCommsCounter('netMonCandidateSeen');
        this.netMonSeen += 1;
        envelope.netMonSamplingMarked = true;
        envelope.traceNetMon = this.netMonSeen % this.commsDiagnostics.netMonSampleRate === 0;
    }

    _traceNetMonStage(envelope, stage, outcome, extra = {}) {
        if (!envelope.traceNetMon) {
            return;
        }

        const safe = this._buildSafeTraceIdentifiers(envelope.message, envelope.rawMessage);
        this.logger.debug(
            `${this._commsPrefix()} netmonTrace ${JSON.stringify({
                seq: envelope.seq,
                stage,
                outcome,
                ...safe,
                ...extra,
            })}`,
        );
    }

    _normalizeThrownError(error) {
        if (error instanceof Error) {
            return {
                name: error.name || 'Error',
                message: error.message || 'Unknown error',
                stack: error.stack ?? null,
                thrownType: 'Error',
            };
        }

        if (typeof error === 'string') {
            return {
                name: 'NonErrorThrow',
                message: error,
                stack: null,
                thrownType: 'string',
            };
        }

        if (error === null || error === undefined) {
            return {
                name: 'NonErrorThrow',
                message: 'Thrown value was nullish',
                stack: null,
                thrownType: String(error),
            };
        }

        if (typeof error === 'object') {
            let message = 'Non-error object thrown';
            try {
                message = typeof error.message === 'string' ? error.message : JSON.stringify(error);
            } catch {
                message = 'Non-serializable thrown object';
            }

            return {
                name: typeof error.name === 'string' ? error.name : 'NonErrorThrow',
                message,
                stack: typeof error.stack === 'string' ? error.stack : null,
                thrownType: 'object',
            };
        }

        return {
            name: 'NonErrorThrow',
            message: String(error),
            stack: null,
            thrownType: typeof error,
        };
    }

    _onFunnelException(stage, error, envelope = null) {
        try {
            const normalized = this._normalizeThrownError(error);
            this._incrementCommsCounter('funnelException');
            const safe = envelope ? this._buildSafeTraceIdentifiers(envelope.message, envelope.rawMessage) : {};
            this.logger.error(`${this._commsPrefix()} funnelException stage=${stage} message="${normalized.message}"`, {
                seq: envelope?.seq ?? null,
                ...safe,
                stack: normalized.stack,
                thrownName: normalized.name,
                thrownType: normalized.thrownType,
            });
        } catch (internalError) {
            try {
                const fallbackError = this._normalizeThrownError(internalError);
                this.logger.error(
                    `${this._commsPrefix()} funnelException stage=${stage} message="funnel-exception-logger-failed: ${fallbackError.message}"`,
                );
            } catch {
                // Ensure diagnostics never throw from logging path.
            }
        }
    }

    _createFunnelEnvelope(message) {
        this._incrementCommsCounter('mqttMessageReceived');
        return {
            seq: ++this.commsSequence,
            mqttMessage: message,
            rawMessage: null,
            message: null,
            netMonCandidate: false,
            netMonSamplingMarked: false,
            traceNetMon: false,
        };
    }

    _stageBufferToString(envelope) {
        let bufferError = false;

        try {
            envelope.rawMessage = this._bufferToString(envelope.mqttMessage);
            this._incrementCommsCounter('bufferToStringOk');
        } catch (error) {
            bufferError = true;
            envelope.rawMessage = '{ EE_FORMATTER: \'ignore-this\'}';
            this._incrementCommsCounter('bufferToStringError');
            this._registerDropReason('buffer_to_string_error');
            this._onFunnelException('buffer_to_string', error, envelope);
        }

        envelope.netMonCandidate = this._isNetMonRawCandidate(envelope.rawMessage);
        this._markNetMonSampling(envelope);
        this._traceNetMonStage(
            envelope,
            'buffer_to_string',
            bufferError ? 'error' : 'pass',
            bufferError ? { reason: 'buffer_to_string_error' } : {},
        );

        return envelope;
    }

    _stageSignatureGate(envelope) {
        try {
            const verified = this._messageIsSigned(envelope.rawMessage);
            if (verified) {
                this._incrementCommsCounter('signaturePass');
                this._traceNetMonStage(envelope, 'signature_gate', 'pass');
                return true;
            }

            this._incrementCommsCounter('signatureFail');
            if (envelope.netMonCandidate) {
                this._incrementCommsCounter('netMonDropSignature');
            }
            this._registerDropReason('signature_invalid');
            this._traceNetMonStage(envelope, 'signature_gate', 'drop', { reason: 'signature_invalid' });
            return false;
        } catch (error) {
            const bypassed = !this.secure;
            this._incrementCommsCounter('signatureError');
            if (bypassed) {
                this._incrementCommsCounter('signatureBypassOnError');
                this._incrementCommsCounter('signaturePass');
                this._registerBypassReason('signature_exception_insecure_bypass');
                this._traceNetMonStage(envelope, 'signature_gate', 'bypass_on_error', {
                    reason: 'signature_exception_insecure_bypass',
                });
            } else {
                if (envelope.netMonCandidate) {
                    this._incrementCommsCounter('netMonDropSignature');
                }
                this._registerDropReason('signature_exception');
                this._traceNetMonStage(envelope, 'signature_gate', 'error', {
                    reason: 'signature_exception',
                });
            }
            this._onFunnelException('signature_gate', error, envelope);
            return bypassed;
        }
    }

    _stageJsonParse(envelope) {
        try {
            envelope.message = this._toJSON(envelope.rawMessage, {
                throwOnError: true,
            });
            this._incrementCommsCounter('jsonParseOk');
            if (this._isNetMonMessage(envelope.message)) {
                envelope.netMonCandidate = true;
                this._markNetMonSampling(envelope);
            }
            this._traceNetMonStage(envelope, 'json_parse', 'pass');
        } catch (error) {
            envelope.message = null;
            this._incrementCommsCounter('jsonParseFail');
            if (envelope.netMonCandidate) {
                this._incrementCommsCounter('netMonDropParse');
            }
            this._registerDropReason('parse_error');
            this._traceNetMonStage(envelope, 'json_parse', 'drop', { reason: 'parse_error' });
        }

        return envelope;
    }

    _stageEdgeNodeGate(envelope) {
        const pass = this._messageIsFromEdgeNode(envelope.message);
        if (pass) {
            this._incrementCommsCounter('edgeNodePass');
            this._traceNetMonStage(envelope, 'edge_node_gate', 'pass');
            return true;
        }

        this._incrementCommsCounter('edgeNodeDrop');
        this._registerDropReason('not_edge_node');
        this._traceNetMonStage(envelope, 'edge_node_gate', 'drop', { reason: 'not_edge_node' });
        return false;
    }

    _stageFleetGate(envelope) {
        const pass = this._messageFromControlledFleet(envelope.message);
        if (pass) {
            this._incrementCommsCounter('fleetPass');
            this._traceNetMonStage(envelope, 'fleet_gate', 'pass');
            return true;
        }

        this._incrementCommsCounter('fleetDrop');
        if (envelope.netMonCandidate) {
            this._incrementCommsCounter('netMonDropFleet');
        }
        this._registerDropReason('fleet_filtered');
        this._traceNetMonStage(envelope, 'fleet_gate', 'drop', { reason: 'fleet_filtered' });
        return false;
    }

    _stageFormatterGate(envelope) {
        const pass = this._messageHasKnownFormat(envelope.message);
        if (pass) {
            this._incrementCommsCounter('formatPass');
            this._traceNetMonStage(envelope, 'formatter_gate', 'pass');
            return true;
        }

        this._incrementCommsCounter('formatDrop');
        if (envelope.netMonCandidate) {
            this._incrementCommsCounter('netMonDropFormatter');
        }
        this._registerDropReason('unknown_formatter');
        this._traceNetMonStage(envelope, 'formatter_gate', 'drop', { reason: 'unknown_formatter' });
        return false;
    }

    async _stageDecode(envelope) {
        try {
            envelope.message = await this._decodeToInternalFormat(envelope.message);
            this._incrementCommsCounter('decodeOk');
            if (envelope.netMonCandidate) {
                this._incrementCommsCounter('netMonDecodePass');
            }
            this._traceNetMonStage(envelope, 'decode', 'pass');
            return envelope;
        } catch (error) {
            this._incrementCommsCounter('decodeError');
            if (envelope.netMonCandidate) {
                this._incrementCommsCounter('netMonDropDecode');
            }
            this._registerDropReason('decode_exception');
            this._traceNetMonStage(envelope, 'decode', 'drop', { reason: 'decode_exception' });
            this._onFunnelException('decode', error, envelope);
            return null;
        }
    }

    /*************************************
     * Network messages funnel methods
     *************************************/

    _bufferToString(message) {
        return message[2].payload.toString('utf-8');
    }

    _messageIsSigned(message) {
        const verify = this.naeuralBC.verify(message);
        if (!verify && this.signatureDebugEnabled) {
            const safe = this._buildSafeTraceIdentifiers(null, message);
            this.logger.debug(`${this._commsPrefix()} signatureInvalid ${JSON.stringify(safe)}`);
        }

        return !this.secure || verify;
    }

    _toJSON(message, options = {}) {
        let parsedMessage;

        try {
            parsedMessage = JSON.parse(message);
            if (parsedMessage.EE_IS_ENCRYPTED !== undefined && parsedMessage.EE_IS_ENCRYPTED === true) {
                const decrypted = this.naeuralBC.decrypt(parsedMessage.EE_ENCRYPTED_DATA ?? null, parsedMessage.EE_SENDER);

                if (decrypted === null) {
                    throw new Error('Could not decrypt message.');
                }

                this.logger.debug(`Decrypted message from ${parsedMessage.EE_SENDER}...`);

                const content = JSON.parse(decrypted);
                Object.keys(content).forEach((key) => {
                    parsedMessage[key] = content[key];
                });
            }
        } catch (error) {
            if (options.throwOnError === true) {
                throw error;
            }

            return { EE_FORMATTER: 'ignore-this' };
        }

        return parsedMessage;
    }

    _messageIsFromEdgeNode(message) {
        return !!message?.EE_PAYLOAD_PATH;
    }

    _processSupervisorPayload(message, envelope = null) {
        if (
            this.threadType !== THREAD_TYPE_PAYLOADS ||
            message.EE_PAYLOAD_PATH[1]?.toLowerCase() !== ADMIN_PIPELINE_NAME.toLowerCase()
        ) {
            return;
        }

        const isNetMonCandidate = this._isNetMonMessage(message) || envelope?.netMonCandidate === true;
        this._incrementCommsCounter('supervisorAdminSeen');
        this.logger.log(`Processing supervisor payload from ${message.EE_PAYLOAD_PATH[0]}:${message.EE_PAYLOAD_PATH[2]}`);

        const duplicate = { ...message };
        if (!this._messageHasKnownFormat(duplicate)) {
            return;
        }

        this._decodeToInternalFormat(duplicate)
            .then((decoded) => {
                if (decoded.EE_PAYLOAD_PATH[2]?.toLowerCase() === NETMON_SIGNATURE.toLowerCase()) {
                    this._incrementCommsCounter('supervisorNetMonSeen');
                    this._incrementCommsCounter('netMonSupervisorSeen');
                    this._traceNetMonStage(envelope ?? { traceNetMon: false }, 'supervisor_side_path', 'seen');
                    const addressToNode = {};
                    const nodeToAddress = {};

                    const currentNetwork = decoded.DATA?.CURRENT_NETWORK;
                    if (currentNetwork === undefined) {
                        this._incrementCommsCounter('netMonCurrentNetworkMissing');
                        this.logger.warn(
                            `${this._commsPrefix()} netmonSupervisor CURRENT_NETWORK missing`,
                            this._buildSafeTraceIdentifiers(decoded),
                        );
                    } else if (typeof currentNetwork !== 'object' || currentNetwork === null || Array.isArray(currentNetwork)) {
                        this._incrementCommsCounter('netMonCurrentNetworkMalformed');
                        this.logger.warn(
                            `${this._commsPrefix()} netmonSupervisor CURRENT_NETWORK malformed`,
                            {
                                ...this._buildSafeTraceIdentifiers(decoded),
                                currentNetworkType: Array.isArray(currentNetwork) ? 'array' : typeof currentNetwork,
                            },
                        );
                    }

                    const payloadPathSignature = Array.isArray(decoded.EE_PAYLOAD_PATH) ? decoded.EE_PAYLOAD_PATH[2] : null;
                    const dataSignature = decoded.DATA?.SIGNATURE;
                    const normalizedPayloadPathSignature = typeof payloadPathSignature === 'string'
                        ? payloadPathSignature.toLowerCase()
                        : null;
                    const normalizedDataSignature = typeof dataSignature === 'string'
                        ? dataSignature.toLowerCase()
                        : null;
                    if (normalizedPayloadPathSignature !== normalizedDataSignature) {
                        this._incrementCommsCounter('netMonSignaturePathMismatch');
                        this.logger.warn(
                            `${this._commsPrefix()} netmonSupervisor signature mismatch between EE_PAYLOAD_PATH[2] and DATA.SIGNATURE`,
                            {
                                ...this._buildSafeTraceIdentifiers(decoded),
                                payloadPathSignature,
                                dataSignature,
                            },
                        );
                    }

                    if (decoded.DATA?.CURRENT_NETWORK !== undefined) {
                        this._postToMain({
                            threadId: this.threadId,
                            type: MESSAGE_TYPE_SUPERVISOR_STATUS,
                            success: true,
                            error: null,
                            data: { ...decoded.DATA, EE_SENDER: decoded.EE_SENDER },
                        });

                        Object.keys(decoded.DATA.CURRENT_NETWORK ?? {}).forEach((nodeName) => {
                            nodeToAddress[nodeName] = decoded.DATA.CURRENT_NETWORK[nodeName].address;
                            addressToNode[decoded.DATA.CURRENT_NETWORK[nodeName].address] = nodeName;
                        });

                        if (this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
                            this._publishToRedis(
                                ADDRESSES_UPDATES_INBOX,
                                {
                                    command: MESSAGE_TYPE_REFRESH_ADDRESSES,
                                    nodes: nodeToAddress,
                                    addresses: addressToNode,
                                },
                                MESSAGE_TYPE_REFRESH_ADDRESSES,
                            );
                        } else {
                            this._postToMain({
                                threadId: this.threadId,
                                type: MESSAGE_TYPE_REFRESH_ADDRESSES,
                                success: true,
                                error: null,
                                nodes: nodeToAddress,
                                addresses: addressToNode,
                            });
                        }
                    }

                    if (decoded.DATA?.CURRENT_ALERTED) {
                        // TODO: this should be indexed by node addresses as well
                        const alerted = Object.keys(decoded.DATA.CURRENT_ALERTED).map((nodeName) => ({
                            node: nodeName,
                            address: nodeToAddress[nodeName] ?? null,
                            lastSeen: decoded.DATA.CURRENT_ALERTED[nodeName].last_seen_sec,
                        }));

                        this._postToMain({
                            threadId: this.threadId,
                            type: MESSAGE_TYPE_NETWORK_NODE_DOWN,
                            success: true,
                            error: null,
                            data: alerted,
                        });
                    }
                }

                const context = {
                    address: decoded.EE_SENDER,
                    name: this._getNodeForAddress(decoded.EE_SENDER),
                    metadata: {},
                    pipeline: {},
                    instance: {},
                };
                const data = { ...decoded.DATA };
                delete decoded.DATA;
                context.metadata = decoded;
                context.metadata.SESSION_ID = data.SESSION_ID;
                context.pipeline = {
                    name: context.metadata.EE_PAYLOAD_PATH[1],
                };
                context.instance = {
                    name: context.metadata.EE_PAYLOAD_PATH[3],
                };

                if (
                    (Object.hasOwn(data, 'COMMAND_PARAMS') && !!data.COMMAND_PARAMS[STICKY_COMMAND_ID_KEY]) ||
                    (Object.hasOwn(data, 'ON_COMMAND_REQUEST') && !!data.ON_COMMAND_REQUEST[STICKY_COMMAND_ID_KEY])
                ) {
                    const stickyId = data.COMMAND_PARAMS !== undefined
                        ? data.COMMAND_PARAMS[STICKY_COMMAND_ID_KEY]
                        : data.ON_COMMAND_REQUEST[STICKY_COMMAND_ID_KEY];

                    const receiver = this.stickySessions[stickyId];

                    if (receiver && this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
                        this._publishToRedis(
                            receiver,
                            {
                                threadId: this.threadId,
                                type: MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD,
                                success: true,
                                error: null,
                                data,
                                context,
                            },
                            MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD,
                        );

                        return;
                    }
                }

                this._postToMain({
                    threadId: this.threadId,
                    type: MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD,
                    success: true,
                    error: null,
                    data,
                    context,
                });
            })
            .catch((error) => {
                this._incrementCommsCounter('decodeError');
                if (isNetMonCandidate) {
                    this._incrementCommsCounter('netMonDropDecode');
                }
                this._registerDropReason('decode_exception');
                this._onFunnelException('supervisor_decode', error, envelope);
            });
    }

    _messageFromControlledFleet(message) {
        if (this.threadType === THREAD_TYPE_HEARTBEATS) {
            this._postToMain({
                threadId: this.threadId,
                type: MESSAGE_TYPE_OBSERVED_NODE,
                success: true,
                error: null,
                data: {
                    node: this._getNodeForAddress(message.EE_SENDER),
                    address: message.EE_SENDER,
                    timestamp: new Date().getTime(),
                },
            });
        }

        return !hasFleetFilter(this.startupOptions.fleet) || this.startupOptions.fleet.includes(message.EE_SENDER);
    }

    _messageHasKnownFormat(message) {
        const formatter = this._normalizeFormatterKey(message?.EE_FORMATTER);
        const knownFormat = !!this.formatters[formatter];

        if (!knownFormat) {
            this.logger.debug(`Unknown format ${message.EE_FORMATTER}. Message dropped.`);
        }

        return knownFormat;
    }

    async _decodeToInternalFormat(message) {
        const formatter = this._normalizeFormatterKey(message?.EE_FORMATTER);
        const formatterInput = this.formatters[formatter] ?? this.formatters.raw;
        if (!formatterInput || typeof formatterInput.in !== 'function') {
            throw new Error(`Formatter "${formatter}" is not available.`);
        }

        const internalMessage = formatterInput.in(message);

        switch (internalMessage.EE_EVENT_TYPE) {
            case MESSAGE_TYPE_HEARTBEAT:
                internalMessage.DATA = await processHeartbeat(internalMessage.DATA);
                break;
            case MESSAGE_TYPE_NOTIFICATION:
                internalMessage.DATA = notificationProcessor(internalMessage.DATA);
                break;
            case MESSAGE_TYPE_PAYLOAD:
                internalMessage.DATA = payloadProcessor(internalMessage.DATA);
                break;
        }

        return internalMessage;
    }

    /**
     * Returns the address for a given value if the value is a node name, returns the value if the value is already
     * and address.
     *
     * @param {string} value
     * @return {string|null}
     * @private
     */
    _getAddress(value) {
        if (isAddress(value)) {
            return value;
        }

        return this._getAddressForNode(value);
    }

    /**
     * Returns the node name for a given address. Returns null if address has not been observed.
     *
     * @param {string} address
     * @return {string|null}
     * @private
     */
    _getNodeForAddress(address) {
        return this.addressToNodeName[address] ?? null;
    }

    /**
     * Returns the address for a given node name. Returns null if node has not been observed.
     *
     * @param {string} node
     * @return {string|null}
     * @private
     */
    _getAddressForNode(node) {
        return this.nodeNameToAddress[node] ?? null;
    }
}

let thread = null;
parentPort?.on('message', (message) => {
    logger.verbose('Thread received message: ', message);

    if (message.command === THREAD_COMMAND_START) {
        const startupOptions = message.config;

        let redisOptions = null;
        if (startupOptions.stateManager === REDIS_STATE_MANAGER) {
            redisOptions = startupOptions.redis;
        }

        thread = new Thread(message, redisOptions, logger);

        const mqttOptions = {
            username: startupOptions.connection.username,
            password: startupOptions.connection.password,
            clean: startupOptions.connection.clean !== false,
            clientId: (startupOptions.connection.clientId !== undefined && startupOptions.connection.clientId !== null)
                ? `${startupOptions.connection.prefix}_${startupOptions.connection.clientId}_${startupOptions.connection.suffix}`
                : null,
        };

        const mqttClient = mqtt.connect(startupOptions.connection.url, mqttOptions);

        logger.log(`Configured MQTT connection at "${startupOptions.connection.url}" with (clean=${JSON.stringify(mqttOptions.clean)};clientId=${mqttOptions.clientId})`);

        thread.run(mqttClient);
    }

    if (message.command === THREAD_COMMAND_UPDATE_STATE) {
        thread.do(THREAD_COMMAND_UPDATE_STATE, message);
    }

    if (message.command === THREAD_COMMAND_UPDATE_FLEET) {
        thread.do(THREAD_COMMAND_UPDATE_FLEET, message);
    }

    if (message.command === THREAD_COMMAND_WATCH_FOR_SESSION_ID) {
        thread.do(THREAD_COMMAND_WATCH_FOR_SESSION_ID, message);
    }

    if (message.command === THREAD_COMMAND_IGNORE_SESSION_ID) {
        thread.do(THREAD_COMMAND_IGNORE_SESSION_ID, message);
    }

    if (message.command === THREAD_COMMAND_MEMORY_USAGE) {
        thread.do(THREAD_COMMAND_MEMORY_USAGE);
    }
});
