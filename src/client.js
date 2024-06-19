/**
 * @typedef {Object.<string, number>} AlertedNodes
 */

/**
 * @typedef {Object} ZxAIClientOptions
 * @property {any} emitterOptions - the EventEmitter2 setup
 * @property {any} initiator - The initiator of the configuration.
 * @property {Object} blockchain - Blockchain related configurations.
 * @property {boolean} blockchain.debug - Indicates if blockchain debugging is enabled.
 * @property {string} blockchain.key - The blockchain key.
 * @property {string} stateManager - Describes the state manager.
 * @property {string} loglevel - Describes the state manager.
 * @property {Object} redis - Redis configuration details.
 * @property {string} redis.host - The Redis server host.
 * @property {number} redis.port - The Redis server port.
 * @property {any} redis.password - The Redis password.
 * @property {string} redis.pubSubChannel - The Redis Pub/Sub channel name.
 * @property {Object} mqttOptions - MQTT connection options.
 * @property {any} mqttOptions.url - The MQTT server URL.
 * @property {any} mqttOptions.username - The MQTT username for authentication.
 * @property {any} mqttOptions.password - The MQTT password for authentication.
 * @property {Object} customFormatters - Custom formatters for configuration.
 * @property {Object} threads - Thread configuration for various tasks.
 * @property {number} threads.heartbeats - The number of heartbeat threads.
 * @property {number} threads.notifications - The number of notification threads.
 * @property {number} threads.payloads - The number of payload processing threads.
 * @property {string[]} fleet - An array of fleet strings.
 */

/**
 * @typedef {Object} AvailableSchemaResponse
 * @property {string} signature - The unique signature.
 * @property {boolean} linkable - Indicates if the entity is linkable.
 * @property {string} name - The name of the entity.
 * @property {string} description - A description of the entity.
 */

/**
 * @typedef {Object} AvailableDCTResponse
 * @property {string} name - The name of the entity.
 * @property {string} description - A description of the entity.
 * @property {string} type - The unique signature.
 */

import { Worker } from 'worker_threads';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as mqtt from 'mqtt';
import EventEmitter2 from 'eventemitter2';
import {
    ZxAI_BC_ADDRESS,
    ZxAI_CLIENT_BOOTED,
    ZxAI_CLIENT_SYS_TOPIC_SUBSCRIBE,
    ZxAI_ENGINE_DEREGISTERED,
    ZxAI_ENGINE_OFFLINE,
    ZxAI_ENGINE_ONLINE,
    ZxAI_ENGINE_REGISTERED,
    ZxAI_RECEIVED_HEARTBEAT_FROM_ENGINE,
    ALL_EDGE_NODES,
    INTERNAL_STATE_MANAGER,
    MESSAGE_TYPE_HEARTBEAT,
    MESSAGE_TYPE_NETWORK_ADDRESSES_REFRESH,
    MESSAGE_TYPE_NETWORK_NODE_DOWN,
    MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE,
    MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD,
    MESSAGE_TYPE_NOTIFICATION,
    MESSAGE_TYPE_OBSERVED_NODE,
    MESSAGE_TYPE_PAYLOAD,
    MESSAGE_TYPE_SUPERVISOR_STATUS,
    MESSAGE_TYPE_THREAD_MEMORY_USAGE,
    NETWORK_STICKY_PAYLOAD_RECEIVED,
    NODE_COMMAND_ARCHIVE_CONFIG,
    NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE,
    NODE_COMMAND_PIPELINE_COMMAND,
    NODE_COMMAND_UPDATE_CONFIG,
    NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
    REDIS_STATE_MANAGER,
    REST_CUSTOM_EXEC_SIGNATURE,
    STICKY_COMMAND_ID_KEY,
    THREAD_COMMAND_MEMORY_USAGE,
    THREAD_COMMAND_START,
    ZxAI_SUPERVISOR_PAYLOAD,
} from './constants.js';
import { ZxAIBC } from './utils/blockchain.js';
import { State } from './models/state.js';
import { filter, fromEvent, map, merge } from 'rxjs';
import { THREAD_START_ERR, THREAD_START_OK } from './threads/message.thread.js';
import { defaultSchemas } from './utils/schema.providers.js';
import { InternalStateManager } from './models/internal.state.manager.js';
import { RedisStateManager } from './models/redis.state.manager.js';
import { Logger } from './app.logger.js';
import { NodeManager } from './node.manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const HEARTBEATS_STREAM = 'heartbeats';
export const PAYLOADS_STREAM = 'payloads';
export const NOTIFICATIONS_STREAM = 'notifications';
/**
 * Enum NaeuralEdgeProtocol Event Stream Types
 * @enum {string}
 */
export const ZxAIEventType = {
    PAYLOAD: PAYLOADS_STREAM,
    HEARTBEAT: HEARTBEATS_STREAM,
    NOTIFICATION: NOTIFICATIONS_STREAM,
};
/**
 * Enum NaeuralEdgeProtocol Client Events
 * @enum {string}
 */
export const ZxAIClientEvent = {
    ZxAI_CLIENT_CONNECTED: 'ZxAICCONNSUCCESS',
    ZxAI_CLIENT_SYS_TOPIC_SUBSCRIBE: 'ZxAICSTS',
    ZxAI_BC_ADDRESS: 'ZxAIBCADDR',
    ZxAI_CLIENT_BOOTED: 'ZxAIBOOT',
    ZxAI_ENGINE_REGISTERED: 'ZxAIEEREG',
    ZxAI_ENGINE_DEREGISTERED: 'ZxAIEEDEREG',
    ZxAI_RECEIVED_HEARTBEAT_FROM_ENGINE: 'ZxAICONEE',
    ZxAI_CLIENT_SYS_TOPIC_UNSUBSCRIBE: 'ZxAICSTUS',
    ZxAI_CLIENT_DISCONNECTED: 'ZxAICDISCONN',
    ZxAI_CLIENT_CONNECTION_ERROR: 'ZxAICCONNERR',
    ZxAI_CLIENT_SHUTDOWN: 'ZxAISHUTDOWN',
    ZxAI_EXCEPTION: 'ZxAIEX',
    ZxAI_ENGINE_OFFLINE: 'ZxAIEEOFF',
};

/**
 * @extends EventEmitter2
 *
 * The main network client.
 */
export class ZxAIClient extends EventEmitter2 {
    /**
     * Dictionary describing the network topics to listen to.
     *
     * @type {{heartbeats: string, payloads: string, notifications: string}}
     * @private
     */
    topicPaths = {
        heartbeats: '$share/$initiator/lummetry/ctrl',
        notifications: '$share/$initiator/lummetry/notif',
        payloads: '$share/$initiator/lummetry/payloads',
    };

    /**
     * The boot options.
     *
     * @type {Object}
     */
    bootOptions = {
        initiator: null,
        blockchain: {
            debug: false,
            key: '',
            encrypt: true,
            secure: true,
        },
        stateManager: INTERNAL_STATE_MANAGER,
        redis: {
            host: 'localhost',
            port: 6379,
            password: null,
            pubSubChannel: 'null',
        },
        mqttOptions: {
            url: null,
            username: null,
            password: null,
        },
        customFormatters: {},
        threads: {
            heartbeats: 1,
            notifications: 1,
            payloads: 1,
        },
        fleet: [ALL_EDGE_NODES],
    };

    /**
     * Internal dictionary keeping references to child threads.
     *
     * @type {{heartbeats: Array, payloads: Array, notifications: Array}}
     * @private
     */
    threads = {
        heartbeats: [],
        payloads: [],
        notifications: [],
    };

    /**
     * The state to update.
     *
     * @type {State|null}
     */
    state = null;

    /**
     * Internal reference to the Blockchain Engine
     *
     * @type {ZxAIBC}
     * @private
     */
    zxAIbc = null;

    /**
     * Internal dictionary keeping references to the streams of events received from the child threads.
     *
     * @type {Object.<string, Observable>}
     * @private
     */
    networkStreams = {
        [`${HEARTBEATS_STREAM}`]: null,
        [`${NOTIFICATIONS_STREAM}`]: null,
        [`${PAYLOADS_STREAM}`]: null,
    };

    /**
     * The repository of schemas to be used when interacting with instances and pipelines.
     *
     * @type {SchemasRepository}
     */
    schemas;

    /**
     * The network connection.
     *
     * @type {MqttClient}
     * @private
     */
    mqttClient = null;

    /**
     * Reference to the logger to use.
     *
     * @type {Logger}
     * @private
     */
    logger;

    /**
     * A dictionary with network addresses associated to node names.
     *
     * @private
     * @type {*}
     */
    universeAddresses = {};

    /**
     * Statistics about the memory used by the SDK.
     *
     * @type {*}
     */
    memoryUsageStats = {
        max: {
            rss: 0,
            heapTotal: 0,
            heapUsed: 0,
            external: 0,
            arrayBuffers: 0,
        },
        aggregated: {
            rss: 0,
            heapTotal: 0,
            heapUsed: 0,
            external: 0,
            arrayBuffers: 0,
        },
        detailed: {},
    };

    /**
     * Dictionary of all alerted nodes.
     *
     * @type {AlertedNodes}
     * @private
     */
    alertedNodes = {};

    /**
     * The network client constructor.
     *
     * @constructor
     * @param {ZxAIClientOptions} options
     * @param {*} logger
     */
    constructor(
        options = {
            emitterOptions: null,
            initiator: undefined,
            blockchain: undefined,
            stateManager: '',
            loglevel: '',
            redis: undefined,
            mqttOptions: undefined,
            customFormatters: undefined,
            threads: undefined,
            fleet: [],
        },
        logger = null,
    ) {
        super(options.emitterOptions ?? {});

        if (!logger) {
            this.logger = new Logger(options.loglevel ?? 'info');
        } else {
            this.logger = logger;
        }

        this.schemas = defaultSchemas();
        this.bootOptions = Object.assign(this.bootOptions, options);
        this.bootOptions.redis.pubSubChannel = `updates-${this.bootOptions.initiator}`;

        if (!options.initiator) {
            this.bootOptions.initiator = uuidv4().substring(0, 13);
        }

        if (!this.bootOptions.stateManager || this.bootOptions.stateManager === INTERNAL_STATE_MANAGER) {
            this.state = new State(INTERNAL_STATE_MANAGER, new InternalStateManager(), {
                fleet: this.bootOptions.fleet,
            });
        } else if (this.bootOptions.stateManager === REDIS_STATE_MANAGER) {
            this.state = new State(REDIS_STATE_MANAGER, new RedisStateManager(this.bootOptions.redis, this.logger), {
                fleet: this.bootOptions.fleet,
            });
        } else {
            throw Error('Incorrect state setup.');
        }

        this.state.on(NETWORK_STICKY_PAYLOAD_RECEIVED, this._onStateMessage(NETWORK_STICKY_PAYLOAD_RECEIVED));

        Object.keys(this.bootOptions.threads).forEach((threadType) => {
            const count = this.topicPaths[threadType] ? parseInt(this.bootOptions.threads[threadType]) : 0;

            for (let i = 0; i < count; i++) {
                const threadId = uuidv4().substring(0, 13);
                const thread = new Worker(path.join(__dirname, 'threads', 'message.thread.js'));

                this.state.registerThread(threadType, thread);
                this.threads[threadType].push({
                    id: threadId,
                    thread: thread,
                });

                thread.on('message', this._onThreadMessage());
            }
        });

        Object.keys(this.threads).forEach((threadType) => {
            const threadObservables = [];
            this.threads[threadType].forEach((handler) => {
                const observable = fromEvent(handler.thread, 'message');
                threadObservables.push(observable);
            });

            this.networkStreams[threadType] = merge(...threadObservables).pipe(
                filter((message) =>
                    [MESSAGE_TYPE_HEARTBEAT, MESSAGE_TYPE_NOTIFICATION, MESSAGE_TYPE_PAYLOAD].includes(message.type),
                ),
                map((message) => ({
                    context: message.context,
                    data: message.data,
                    error: message.error,
                })),
            );
        });

        this.zxAIbc = new ZxAIBC(this.bootOptions.blockchain);
    }

    /**
     * Internal method for compiling the boot status for the subordinated worker threads.
     *
     * @return {FlatArray<Object[], 1>}
     * @private
     */
    checkBootComplete() {
        return Object.keys(this.threads)
            .map((threadType) => this.threads[threadType].map((handler) => handler.booted && handler.running))
            .flat()
            .reduce((ok, status) => ok && status, true);
    }

    /**
     * Internal method for keeping track of worker threads statuses.
     *
     * @param message
     * @private
     */
    markThreadStatus(message) {
        const thread = this.threads[message.threadType].filter((handler) => handler.id === message.threadId)[0];
        thread['booted'] = true;
        thread['running'] = message.type === THREAD_START_OK;
        thread['status'] = message;

        this.emit(ZxAI_CLIENT_SYS_TOPIC_SUBSCRIBE, null, {
            threadId: message.threadId,
            event: message.type,
            status: message.status,
        });

        if (this.checkBootComplete()) {
            this.emit(ZxAI_CLIENT_BOOTED, {
                event: ZxAI_CLIENT_BOOTED,
                status: true,
            });

            this.emit(ZxAI_BC_ADDRESS, {
                address: this.zxAIbc.getAddress(),
            });
        }
    }

    /**
     * Factory method for attaching callbacks on state messages.
     *
     * @param {string} messageType
     * @return {*}
     * @private
     */
    _onStateMessage(messageType) {
        const client = this;

        switch (messageType) {
            case NETWORK_STICKY_PAYLOAD_RECEIVED:
                return (message) => {
                    client.emit(
                        message.context.instance.signature,
                        null, // no error
                        message.context,
                        message.data,
                    );
                };
        }

        return () => {
            client.logger.warn(`UNDEFINED STATE MESSAGE HOOK: ${messageType}.`);
        };
    }

    /**
     * Internal method for processing messages received from the worker threads.
     *
     * @return {*}
     * @private
     */
    _onThreadMessage() {
        const state = this.state;
        const client = this;

        return (message) => {
            switch (message.type) {
                case 'LOGGER':
                    // eslint-disable-next-line no-case-declarations
                    let prefix = '';
                    if (message.threadId !== null) {
                        prefix = `[Thread ${message.threadId}] `;
                    }

                    switch (message.level) {
                        case 0:
                            client.logger.error(`${prefix}${message.message}`, message.context);
                            break;
                        case 1:
                            client.logger.warn(`${prefix}${message.message}`);
                            break;
                        case 2:
                        case 3:
                            client.logger.log(`${prefix}${message.message}`);
                            break;
                        case 4:
                        case 5:
                        case 6:
                            client.logger.debug(
                                `${prefix}${message.message} Context: ${JSON.stringify(message.context)}`,
                            );
                            break;
                    }

                    break;
                case THREAD_START_OK:
                case THREAD_START_ERR:
                    client.markThreadStatus(message);
                    break;
                case MESSAGE_TYPE_NETWORK_NODE_DOWN:
                    // eslint-disable-next-line no-case-declarations
                    const alertedList = message.data;
                    if (Array.isArray(alertedList)) {
                        const currentlyAlerted = [];
                        alertedList.forEach((alertedNode) => {
                            currentlyAlerted.push(alertedNode.node);

                            if (
                                !this.alertedNodes[alertedNode.node] &&
                                (this.bootOptions.fleet.includes(alertedNode.node) ||
                                    this.bootOptions.fleet.includes(ALL_EDGE_NODES))
                            ) {
                                client.emit(ZxAI_ENGINE_OFFLINE, {
                                    node: alertedNode.node,
                                });
                            }

                            this.alertedNodes[alertedNode.node] = alertedNode.lastSeen;
                        });

                        const lastAlerted = Object.keys(this.alertedNodes);
                        lastAlerted.forEach((nodeName) => {
                            if (!currentlyAlerted.includes(nodeName)) {
                                delete this.alertedNodes[nodeName];

                                if (
                                    this.bootOptions.fleet.includes(nodeName) ||
                                    this.bootOptions.fleet.includes(ALL_EDGE_NODES)
                                ) {
                                    client.emit(ZxAI_ENGINE_ONLINE, {
                                        node: nodeName,
                                    });
                                }
                            }
                        });
                    }
                    break;
                case MESSAGE_TYPE_NETWORK_ADDRESSES_REFRESH:
                    this.universeAddresses = Object.assign(this.universeAddresses, message.data);
                    break;
                case MESSAGE_TYPE_THREAD_MEMORY_USAGE:
                    this.memoryUsageStats.detailed[message.threadId] = message.data;
                    break;
                case MESSAGE_TYPE_OBSERVED_NODE:
                    state.markNodeAsSeen(message.data.node, message.data.timestamp);
                    break;
                case MESSAGE_TYPE_SUPERVISOR_STATUS:
                    state.storeNetworkInfo(message.data);
                    break;
                case MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD:
                    client.emit(
                        ZxAI_SUPERVISOR_PAYLOAD,
                        null, // no error
                        message.data,
                        message.context,
                    );
                    break;
                case MESSAGE_TYPE_HEARTBEAT:
                    if (message.success && message.error === null) {
                        state.nodeInfoUpdate(message.data);
                        this.emit(ZxAI_RECEIVED_HEARTBEAT_FROM_ENGINE, {
                            node: message.data?.EE_PAYLOAD_PATH[0] ?? null,
                        });
                    }
                    break;
                case MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE:
                    state.onRequestResponseNotification(state, message);
                    break;
                case MESSAGE_TYPE_NOTIFICATION:
                    // TODO: should emit EXCEPTIONS and ABNORMAL FUNCTIONING
                    break;
                case MESSAGE_TYPE_PAYLOAD:
                    client.emit(
                        message.context.instance.signature,
                        null, // no error
                        message.context,
                        message.data,
                    );
                    break;
            }
        };
    }

    /**
     * This method connects the client to the network and spawns all the threads on the network streams.
     *
     * @return {void}
     */
    boot() {
        Object.keys(this.threads).forEach((threadType) => {
            const topic = this.topicPaths[threadType].replace('$initiator', this.bootOptions.initiator);

            this.threads[threadType].forEach((threadConfig) => {
                this.logger.log(`[Main Thread] Booting ${threadType} thread. Id: ${threadConfig.id} Topic: ${topic}`);
                threadConfig.thread.postMessage({
                    id: threadConfig.id,
                    command: THREAD_COMMAND_START,
                    type: threadType,
                    config: {
                        connection: { ...this.bootOptions.mqttOptions, topic: topic },
                        secure: true,
                        zxaibc: this.bootOptions.blockchain,
                        stateManager: this.bootOptions.stateManager,
                        redis: this.bootOptions.redis,
                        fleet: this.bootOptions.fleet,
                    },
                    formatters: this.bootOptions.customFormatters,
                });
            });
        });

        this.mqttClient = mqtt.connect(this.bootOptions.mqttOptions.url, {
            username: this.bootOptions.mqttOptions.username,
            password: this.bootOptions.mqttOptions.password,
            clean: true,
            clientId: null,
        });

        this.mqttClient.on('connect', () => {
            this.logger.log('[Main Thread] Successfully connected to MQTT.');
        });

        this.mqttClient.on('error', () => {
            this.logger.warn('[Main Thread] Could not connect to MQTT.');
        });

        this.logger.log(`[Main Thread] Blockchain Address: ${this.zxAIbc.getAddress()}`);

        setInterval(() => {
            // eslint-disable-next-line no-undef
            this.memoryUsageStats.detailed['main-thread'] = process.memoryUsage();

            const aggregated = {
                rss: this.memoryUsageStats.detailed['main-thread'].rss,
                heapTotal: 0,
                heapUsed: 0,
                external: 0,
                arrayBuffers: 0,
            };
            Object.keys(this.memoryUsageStats.detailed).forEach((threadId) => {
                aggregated.heapTotal += this.memoryUsageStats.detailed[threadId].heapTotal;
                aggregated.heapUsed += this.memoryUsageStats.detailed[threadId].heapUsed;
                aggregated.external += this.memoryUsageStats.detailed[threadId].external;
                aggregated.arrayBuffers += this.memoryUsageStats.detailed[threadId].arrayBuffers;
            });

            if (this.memoryUsageStats.max.rss < aggregated.rss) {
                this.memoryUsageStats.max.rss = aggregated.rss;
            }

            if (this.memoryUsageStats.max.heapTotal < aggregated.heapTotal) {
                this.memoryUsageStats.max.heapTotal = aggregated.heapTotal;
            }

            if (this.memoryUsageStats.max.heapUsed < aggregated.heapUsed) {
                this.memoryUsageStats.max.heapUsed = aggregated.heapUsed;
            }

            if (this.memoryUsageStats.max.external < aggregated.external) {
                this.memoryUsageStats.max.external = aggregated.external;
            }

            if (this.memoryUsageStats.max.arrayBuffers < aggregated.arrayBuffers) {
                this.memoryUsageStats.max.arrayBuffers = aggregated.arrayBuffers;
            }

            this.memoryUsageStats.aggregated = aggregated;

            Object.keys(this.threads).forEach((threadType) => {
                this.threads[threadType].forEach((threadConfig) => {
                    threadConfig.thread.postMessage({
                        command: THREAD_COMMAND_MEMORY_USAGE,
                    });
                });
            });
        }, 10000);

        // TODO: should listen for OK signal received from each thread
        // TODO: should emit booted
    }

    /**
     * Returns the snapshot of the memory usage.
     *
     * @return {Object}
     */
    getMemoryStats() {
        return this.memoryUsageStats;
    }

    // TODO: implement shutdown
    shutdown() {}

    /**
     * This method returns the initiator name used for the connection.
     *
     * @return {string} initiator name
     */
    getName() {
        return this.bootOptions.initiator;
    }

    loadIdentity(identityPrivateKey) {
        return this.zxAIbc.loadIdentity(identityPrivateKey);
    }

    /**
     * This method returns the NaeuralEdgeProtocol Network unique blockchain address.
     *
     * @return {string} NaeuralEdgeProtocol Network address
     */
    getBlockChainAddress() {
        return this.zxAIbc.getAddress();
    }

    // TODO: implement register message decoder
    registerMessageDecoder(name, path) {
        console.log(name, path);
    }

    /**
     * Method for registering a new network node without rebooting the client.
     *
     * @param {string} node The node to register.
     * @return {void}
     */
    registerEdgeNode(node) {
        if (!this.bootOptions.fleet.includes(node)) {
            this.bootOptions.fleet.push(node);
            this.state.broadcastUpdateFleet(this.bootOptions.fleet);
            this.emit(ZxAI_ENGINE_REGISTERED, {
                executionEngine: node, // deprecated
                node: node,
            });
        }
    }

    /**
     * Method for deregistering a network node without rebooting the client.
     *
     * @param {string} node The node to register.
     * @return {void}
     */
    deregisterEdgeNode(node) {
        if (this.bootOptions.fleet.includes(node)) {
            this.bootOptions.fleet.splice(this.bootOptions.fleet.indexOf(node), 1);
            this.state.broadcastUpdateFleet(this.bootOptions.fleet);

            this.emit(ZxAI_ENGINE_DEREGISTERED, {
                executionEngine: node, // deprecated
                node: node,
            });
        }
    }

    /**
     * Method for retrieving the status of the fleet of network nodes that are processed by this instance.
     *
     * @return {Promise<Array<NodeStatus>>} The Fleet Status
     */
    async getFleet() {
        return this.state.getFleet();
    }

    /**
     * Returns the current network status as seen by the specified supervisor.
     * If `supervisor` is null, it returns the latest information received.
     *
     * @param supervisor
     * @return {Promise<Object>}
     */
    async getNetworkStatus(supervisor = null) {
        return this.state.getNetworkStatus(supervisor);
    }

    /**
     * Get the list of network supervisors.
     *
     * @return {Promise<string[]>}
     */
    async getSupervisors() {
        return this.state.getNetworkSupervisors();
    }

    /**
     * Returns a list of all the registered DCT Schemas.
     *
     * @return {Array<AvailableDCTResponse>}
     */
    getRegisteredDCTTypes() {
        return Object.keys(this.schemas.dct).map((key) => ({
            type: this.schemas.dct[key].type,
            name: this.schemas.dct[key].name,
            description: this.schemas.dct[key].description,
        }));
    }

    /**
     * Allows for hot registration of a new DCT Schema to be used by the network client.
     *
     * @param {string} name
     * @param {SchemaDefinition} schema
     * @return {ZxAIClient}
     */
    registerDCTType(name, schema) {
        if (!this.schemas.dct) {
            this.schemas.dct = {};
        }

        this.schemas.dct[name] = schema;

        // TODO: hot registration should notify child threads and other processes
        return this;
    }

    /**
     * Returns the schema associated to a DCT name.
     *
     * @param {string} dctName
     * @return {SchemaDefinition|null}
     */
    getDCTSchema(dctName) {
        return this.schemas?.dct[dctName] ?? null;
    }

    /**
     * Returns the list of Plugin Schemas associated to this network client.
     *
     * @return {Array<AvailableSchemaResponse>}
     */
    getRegisteredPluginTypes() {
        return Object.keys(this.schemas.plugins)
            .filter((signature) => signature !== REST_CUSTOM_EXEC_SIGNATURE)
            .map((signature) => ({
                signature,
                name: this.schemas.plugins[signature].name,
                description: this.schemas.plugins[signature].description,
                linkable: this.schemas.plugins[signature].options?.linkable ?? false,
            }));
    }

    /**
     * Returns the loaded schema for a specific plugin `signature`.
     *
     * @param signature
     * @return {SchemaDefinition|null}
     */
    getPluginSchema(signature) {
        return this.schemas?.plugins[signature] ?? null;
    }

    /**
     * Associates a schema with a plugin `signature`.
     *
     * @param {string} signature
     * @param {Object} schema
     * @return {ZxAIClient}
     */
    registerPluginSchema(signature, schema) {
        this.schemas.plugins[signature] = schema;

        this.logger.log(`[Main Thread] Successfully registered schema for ${signature}.`);

        return this;
    }

    /**
     * Returns a specific stream of events in the network. It can offer a window inside all the messages published
     * in a specific message type category.
     *
     * @param stream
     * @return {Observable|null} a subscribable stream with the selected event type.
     */
    getStream(stream) {
        return this.networkStreams[stream] ?? null;
    }

    /**
     * Returns the client's observable universe: all the hosts that sent a heartbeat that are outside
     * this client's fleet.
     *
     * @return {Promise<ObservedNodes>}
     */
    async getUniverse() {
        return this.state.getUniverse();
    }

    /**
     * Returns a `NodeManager` for a specific node.
     *
     * @param node
     * @return {Promise<NodeManager|null>}
     */
    async getNodeManager(node) {
        if (await this._checkNode(node)) {
            return NodeManager.getNodeManager(this, node, this.logger);
        }

        return null;
    }

    /**
     * Method for publishing a message for an NaeuralEdgeProtocol Node.
     *
     * @param {string} node
     * @param {Object} message
     * @param {Array<Array<string>>} extraWatches
     * @return {Promise<unknown>}
     */
    publish(node, message, extraWatches = []) {
        if (!message) {
            return new Promise((resolve) => {
                resolve({
                    data: {
                        notification: 'Already closed.',
                    },
                });
            });
        }

        message['INITIATOR_ID'] = this.bootOptions.initiator;
        message['EE_ID'] = node;
        message['TIME'] = new Date();

        const watches = [];
        if (extraWatches.length > 0) {
            extraWatches.forEach((watch) => {
                watches.push(watch);
            });
        }

        let stickyId = null;
        switch (message['ACTION']) {
            case NODE_COMMAND_UPDATE_PIPELINE_INSTANCE:
                if (
                    Object.hasOwn(message.PAYLOAD, 'INSTANCE_CONFIG') &&
                    Object.hasOwn(message.PAYLOAD.INSTANCE_CONFIG, 'INSTANCE_COMMAND') &&
                    message.PAYLOAD.INSTANCE_CONFIG.INSTANCE_COMMAND[STICKY_COMMAND_ID_KEY] !== undefined
                ) {
                    stickyId = message.PAYLOAD.INSTANCE_CONFIG.INSTANCE_COMMAND[STICKY_COMMAND_ID_KEY];
                }

                watches.push([
                    node,
                    message['PAYLOAD']['NAME'],
                    message['PAYLOAD']['SIGNATURE'],
                    message['PAYLOAD']['INSTANCE_ID'],
                ]);
                break;
            case NODE_COMMAND_UPDATE_CONFIG:
            case NODE_COMMAND_PIPELINE_COMMAND:
                if (
                    Object.hasOwn(message.PAYLOAD, 'PIPELINE_COMMAND') &&
                    message.PAYLOAD.PIPELINE_COMMAND[STICKY_COMMAND_ID_KEY] !== undefined
                ) {
                    stickyId = message.PAYLOAD.PIPELINE_COMMAND[STICKY_COMMAND_ID_KEY];
                }

                watches.push([node, message['PAYLOAD']['NAME'], null, null]);

                break;
            case NODE_COMMAND_ARCHIVE_CONFIG:
                watches.push([node, message['PAYLOAD'], null, null]);

                break;
            case NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE:
                message['PAYLOAD'].forEach((updateInstanceCommand) => {
                    watches.push([
                        node,
                        updateInstanceCommand['NAME'],
                        updateInstanceCommand['SIGNATURE'],
                        updateInstanceCommand['INSTANCE_ID'],
                    ]);
                });

                break;
        }

        const mqttConnection = this.mqttClient;
        const blockchainEngine = this.zxAIbc;

        return new Promise((resolve, reject) => {
            const request = this.state.registerMessage(message, watches, resolve, reject);

            if (stickyId) {
                this.state.broadcastPayloadStickySession(stickyId);
            }

            message['SESSION_ID'] = request.getId();

            let toSend = { ...message };
            if (this.bootOptions.blockchain.encrypt === true) {
                const encrypted = blockchainEngine.encrypt(
                    JSON.stringify({
                        ACTION: message.ACTION,
                        PAYLOAD: message.PAYLOAD,
                    }),
                    this.universeAddresses[node],
                );

                toSend = {
                    EE_IS_ENCRYPTED: true,
                    EE_ENCRYPTED_DATA: encrypted,
                    INITIATOR_ID: message.INITIATOR_ID,
                    SESSION_ID: message.SESSION_ID,
                    EE_ID: message.EE_ID,
                    TIME: message.TIME,
                };
            }

            mqttConnection.publish(`lummetry/${node}/config`, blockchainEngine.sign(toSend));

            if (watches.length === 0) {
                resolve({
                    DATA: {
                        NOTIFICATION: `${message['ACTION']} command sent.`,
                    },
                });
            }
        });
    }

    /**
     * Private method for checking if a specified node is in the controlled fleet or if it's heartbeat has been
     * witnessed.
     *
     * @param {string} node
     * @return {Promise<boolean>}
     * @private
     */
    async _checkNode(node) {
        let filtered = true;
        if (this.bootOptions.fleet.length === 1 && this.bootOptions.fleet[0] === ALL_EDGE_NODES) {
            filtered = false;
        }

        if (filtered && !this.bootOptions.fleet.includes(node)) {
            this.logger.error(`[Main Thread] Node ${node} is not registered in the working fleet.`);

            return false;
        }

        if (this.alertedNodes[node]) {
            this.logger.error(`[Main Thread] Node ${node} is offline.`);

            return false;
        }

        const universe = await this.getUniverse();
        if (!universe[node]) {
            this.logger.error(`[Main Thread] Node ${node} is either offline or no heartbeat has been witnessed yet.`);

            return false;
        }

        return true;
    }
}
