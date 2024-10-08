import { parentPort } from 'worker_threads';
import * as mqtt from 'mqtt';
import { concatMap, filter, fromEvent, map, tap } from 'rxjs';
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
    MESSAGE_TYPE_THREAD_LOG, ADDRESSES_UPDATES_INBOX, MESSAGE_TYPE_REFRESH_ADDRESSES,
} from '../constants.js';
import { NaeuralBC } from '../utils/blockchain.js';
import {hasFleetFilter, isAddress} from '../utils/helper.functions.js';
import EventEmitter2 from 'eventemitter2';
import { getRedisConnection } from '../utils/redis.connection.provider.js';

export const THREAD_START_OK = 'thread.start.ok';
export const THREAD_START_ERR = 'thread.start.ok';

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

    constructor(options, redisOptions, logger) {
        super();
        this.logger = logger;
        this.logger.setThreadId(options.id);

        this.mainThread = parentPort;
        this.threadId = options.id;
        this.threadType = options.type;
        this.startupOptions = Object.assign(this.startupOptions, options.config);
        this.naeuralBC = new NaeuralBC(this.startupOptions.naeuralBC);

        this.encryptCommunication = this.startupOptions.naeuralBC.encrypt || true;
        this.secure = this.startupOptions.naeuralBC.secure || true;

        this.logger.log(
            `Starting new ${options.type} thread with ${this.startupOptions.stateManager} state manager...`,
        );

        if (this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
            this.logger.log('... configuring Redis state manager');

            this.pubSubChannel = this.startupOptions.redis.pubSubChannel;
            this.cache = getRedisConnection(redisOptions);
            this.publishChannel = getRedisConnection(redisOptions);
            this.subscriptionChannel = getRedisConnection(redisOptions);
        }

        const formatters = this.formatters;

        if (options.formatters !== undefined && typeof options.formatters === 'object') {
            Object.keys(options.formatters).forEach((formatterName) => {
                this.logger.log(`... loading custom formatters: ${formatterName}`);
                // Dynamic import of the formatter
                import(options.formatters[formatterName]).then(
                    (module) => {
                        if (Object.keys(module).includes('_in')) {
                            if (!formatters[formatterName]) {
                                formatters[formatterName] = {};
                            }
                            formatters[formatterName]['in'] = module['_in'];

                            this.logger.log(`... loaded ${formatterName}:_in`);
                        }

                        if (Object.keys(module).includes('_out')) {
                            if (!formatters[formatterName]) {
                                formatters[formatterName] = {};
                            }
                            formatters[formatterName]['out'] = module['_out'];

                            this.logger.log(`... loaded ${formatterName}:_out`);
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

        // TODO: onError => communications error => should gracefully stop thread
        this.mqttClient.on('error', this._onError);

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
                map((message) => this._bufferToString(message)),
                filter((message) => {
                    return this._messageIsSigned(message);
                }),
                map((message) => this._toJSON(message)),
                filter((message) => this._messageIsFromEdgeNode(message)),
                tap((message) => this._processSupervisorPayload(message)),
                filter((message) => this._messageFromControlledFleet(message)),
                filter((message) => this._messageHasKnownFormat(message)),
                concatMap((message) => this._decodeToInternalFormat(message)),
            )
            .subscribe((message) => {
                const context = this._makeContext(message.EE_PAYLOAD_PATH, message.EE_SENDER);
                let data = message;

                // route heartbeats as they come
                if (this.threadType === THREAD_TYPE_HEARTBEATS) {
                    this.mainThread.postMessage({
                        threadId: this.threadId,
                        type: message.EE_EVENT_TYPE,
                        success: true,
                        error: null,
                        data: data,
                        context,
                    });

                    return;
                }

                // build the data and the context for this message
                data = { ...message.DATA };
                delete message.DATA;
                context.metadata = message;
                context.metadata['SESSION_ID'] = data['SESSION_ID'];

                // add notification metadata to context
                if (message.EE_EVENT_TYPE === MESSAGE_TYPE_NOTIFICATION) {
                    context.metadata['NOTIFICATION_CODE'] = data['NOTIFICATION_CODE'];
                    context.metadata['NOTIFICATION_TAG'] = data['NOTIFICATION_TAG'];
                    context.metadata['NOTIFICATION_TYPE'] = data['NOTIFICATION_TYPE'];
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
                            const receivers = this.watchlist[sessionId]
                                ? [this.watchlist[sessionId]]
                                : this.watchlist[path];
                            receivers.forEach((receiver) => {
                                this.publishChannel.publish(
                                    receiver,
                                    JSON.stringify({
                                        type: MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE,
                                        data: data,
                                        context,
                                    }),
                                );
                            });
                        } else {
                            this.mainThread.postMessage({
                                threadId: this.threadId,
                                type: MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE,
                                success: true,
                                error: null,
                                data: data,
                                context,
                            });
                        }
                    }

                    this.mainThread.postMessage({
                        threadId: this.threadId,
                        type: message.EE_EVENT_TYPE,
                        success: true,
                        error: null,
                        data: data,
                        context,
                    });

                    return;
                }

                if (this.threadType === THREAD_TYPE_PAYLOADS) {
                    if (
                      (Object.hasOwn(data, 'COMMAND_PARAMS') && !!data.COMMAND_PARAMS[STICKY_COMMAND_ID_KEY]) ||
                      (Object.hasOwn(data, 'ON_COMMAND_REQUEST') && !!data.ON_COMMAND_REQUEST[STICKY_COMMAND_ID_KEY])
                    ) {
                        const stickyId = data.COMMAND_PARAMS !== undefined ?
                          data.COMMAND_PARAMS[STICKY_COMMAND_ID_KEY] :
                          data.ON_COMMAND_REQUEST[STICKY_COMMAND_ID_KEY];

                        const receiver = this.stickySessions[stickyId];

                        if (receiver && this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
                            this.publishChannel.publish(
                                receiver,
                                JSON.stringify({
                                    threadId: this.threadId,
                                    type: message.EE_EVENT_TYPE,
                                    success: true,
                                    error: null,
                                    data: data,
                                    context,
                                }),
                            );

                            return;
                        }
                    }

                    this.mainThread.postMessage({
                        threadId: this.threadId,
                        type: message.EE_EVENT_TYPE,
                        success: true,
                        error: null,
                        data: data,
                        context,
                    });
                }
            });
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
        this.mainThread.postMessage({
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

    _onError(err) {
        console.log(err);
    }

    /*************************************
     * Network messages funnel methods
     *************************************/

    _bufferToString(message) {
        let stringMessage = '{ EE_FORMATTER: \'ignore-this\'}';
        try {
            stringMessage = message[2].payload.toString('utf-8');
        } catch (e) {
            this.logger.debug('Message funnel _bufferToString error:', e);
        }

        return stringMessage;
    }

    _messageIsSigned(message) {
        let verify = this.naeuralBC.verify(message);
        if (!verify && this.startupOptions.naeuralBC.debugMode) {
            this.logger.debug('Unverifiable message', message);
        }

        return !this.secure || verify;
    }

    _toJSON(message) {
        let parsedMessage;

        try {
            parsedMessage = JSON.parse(message);
            if (parsedMessage.EE_IS_ENCRYPTED !== undefined && parsedMessage.EE_IS_ENCRYPTED === true) {
                const decrypted = this.naeuralBC.decrypt(parsedMessage.EE_ENCRYPTED_DATA ?? null, parsedMessage.EE_SENDER);

                if (decrypted === null) {
                    return { EE_FORMATTER: 'ignore-this' };
                }

                this.logger.debug(`Decrypted message from ${parsedMessage.EE_SENDER}...`);

                const content = JSON.parse(decrypted);
                Object.keys(content).forEach((key) => {
                    parsedMessage[key] = content[key];
                });
            }
        } catch (e) {
            return { EE_FORMATTER: 'ignore-this' };
        }

        return parsedMessage;
    }

    _messageIsFromEdgeNode(message) {
        return !!message.EE_PAYLOAD_PATH;
    }

    _processSupervisorPayload(message) {
        if (
            this.threadType === THREAD_TYPE_PAYLOADS &&
            message.EE_PAYLOAD_PATH[1]?.toLowerCase() === 'admin_pipeline'
        ) {
            const duplicate = { ...message };
            if (this._messageHasKnownFormat(duplicate)) {
                this._decodeToInternalFormat(duplicate).then((decoded) => {
                    if (decoded.EE_PAYLOAD_PATH[2]?.toLowerCase() === 'net_mon_01') {
                        const addressToNode = {};
                        const nodeToAddress = {};
                        if (decoded.DATA?.CURRENT_NETWORK !== undefined) {
                            this.mainThread.postMessage({
                                threadId: this.threadId,
                                type: MESSAGE_TYPE_SUPERVISOR_STATUS,
                                success: true,
                                error: null,
                                data: {...decoded.DATA, EE_SENDER: decoded.EE_SENDER },
                            });

                            Object.keys(decoded.DATA.CURRENT_NETWORK ?? {}).forEach((nodeName) => {
                                nodeToAddress[nodeName] = decoded.DATA.CURRENT_NETWORK[nodeName].address;
                                addressToNode[decoded.DATA.CURRENT_NETWORK[nodeName].address] = nodeName;
                            });

                            if (this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
                                this.publishChannel.publish(
                                    ADDRESSES_UPDATES_INBOX,
                                    JSON.stringify({
                                        command: MESSAGE_TYPE_REFRESH_ADDRESSES,
                                        nodes: nodeToAddress,
                                        addresses: addressToNode,
                                    }),
                                );
                            } else {
                                this.mainThread.postMessage({
                                    threadId: this.threadId,
                                    type: MESSAGE_TYPE_REFRESH_ADDRESSES,
                                    success: true,
                                    error: null,
                                    nodes: nodeToAddress,
                                    addresses: addressToNode,
                                });
                            }
                        }

                        if (!!decoded.DATA?.CURRENT_ALERTED) {
                            // TODO: this should be indexed by node addresses as well
                            const alerted = Object.keys(decoded.DATA.CURRENT_ALERTED).map((nodeName) => ({
                                node: nodeName,
                                address: nodeToAddress[nodeName] ?? null,
                                lastSeen: decoded.DATA.CURRENT_ALERTED[nodeName]['last_seen_sec'],
                            }));

                            this.mainThread.postMessage({
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
                    context.metadata['SESSION_ID'] = data['SESSION_ID'];
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
                        const stickyId = data.COMMAND_PARAMS !== undefined ?
                          data.COMMAND_PARAMS[STICKY_COMMAND_ID_KEY] :
                          data.ON_COMMAND_REQUEST[STICKY_COMMAND_ID_KEY];

                        const receiver = this.stickySessions[stickyId];

                        if (receiver && this.startupOptions.stateManager === REDIS_STATE_MANAGER) {
                            this.publishChannel.publish(
                              receiver,
                              JSON.stringify({
                                  threadId: this.threadId,
                                  type: MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD,
                                  success: true,
                                  error: null,
                                  data: data,
                                  context,
                              }),
                            );

                            return;
                        }
                    }

                    this.mainThread.postMessage({
                        threadId: this.threadId,
                        type: MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD,
                        success: true,
                        error: null,
                        data: data,
                        context: context,
                    });
                });
            }
        }
    }

    _messageFromControlledFleet(message) {
        if (this.threadType === THREAD_TYPE_HEARTBEATS) {
            this.mainThread.postMessage({
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
        let knownFormat =
            message.EE_FORMATTER === '' ||
            !message.EE_FORMATTER ||
            !!this.formatters[message.EE_FORMATTER.toLowerCase()];

        if (!knownFormat) {
            this.logger.debug(`Unknown format ${message.EE_FORMATTER}. Message dropped.`);
        }

        return knownFormat;
    }

    async _decodeToInternalFormat(message) {
        const format = message.EE_FORMATTER ?? 'raw';
        const internalMessage = this.formatters[format].in(message);

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
