import {
    FLEET_UPDATE_EVENT,
    INTERNAL_STATE_MANAGER,
    NETWORK_REQUEST_RESPONSE_NOTIFICATION,
    NETWORK_STICKY_PAYLOAD_RECEIVED,
    NODE_OFFLINE_CUTOFF_TIME,
    REDIS_STATE_MANAGER,
    TIMEOUT_MAX_REQUEST_TIME,
    TIMEOUT_TO_FIRST_RESPONSE,
    UNKNOWN_STATE_MANAGER,
} from '../constants.js';
import { hasFleetFilter } from '../utils/helper.functions.js';
import { NetworkRequestsHandler } from './network.requests.handler.js';
import EventEmitter2 from 'eventemitter2';

/**
 * @typedef {Object.<string, number>} ObservedNodes
 */

/**
 * @typedef {{name: string, status: { online: boolean, lastSeen: Date}}} NodeStatus
 */

/**
 * @extends EventEmitter2
 *
 * This is the model handling the state operations. It leverages either the {InternalStateManager} or the
 * {RedisStateManager} and offers support for callbacks and hooks on state changes.
 */
export class State extends EventEmitter2 {
    /**
     * The type of manager to use. It can be either INTERNAL_STATE_MANAGER or REDIS_STATE_MANAGER.
     *
     * @type {string}
     * @private
     */
    type = UNKNOWN_STATE_MANAGER;

    /**
     * The state manager to use for storing and applying state operations.
     *
     * @type {RedisStateManager|InternalStateManager}
     * @private
     */
    manager = null;

    /**
     * The fleet to follow.
     *
     * @type {string[]}
     * @private
     */
    fleet = [];

    /**
     * The open network transactions handler.
     *
     * @type {NetworkRequestsHandler}
     * @private
     */
    networkRequestsHandler;

    /**
     * The `State` constructor. Will attach any needed listeners.
     *
     * @param {string} type
     * @param {InternalStateManager|RedisStateManager} manager
     * @param {Object} options
     */
    constructor(type, manager, options) {
        super();

        this.fleet = options.fleet;
        this.type = type;
        this.manager = manager;
        this.networkRequestsHandler = new NetworkRequestsHandler();

        const self = this;
        this.manager.on(NETWORK_REQUEST_RESPONSE_NOTIFICATION, (message) => {
            self.onRequestResponseNotification(self, message);
        });

        this.manager.on(NETWORK_STICKY_PAYLOAD_RECEIVED, (message) => {
            self.emit(NETWORK_STICKY_PAYLOAD_RECEIVED, message);
        });

        this.manager.on(FLEET_UPDATE_EVENT, (message) => {
            self.onRemoteFleetUpdateReceived(message);
        });
    }

    /**
     * Method for storing the processed heartbeat into the state.
     *
     * @param {Object} info
     * @return {InternalStateManager}
     */
    nodeInfoUpdate(info) {
        return this.manager.nodeInfoUpdate(info);
    }

    /**
     * Pushes the received message to the transaction handler watching the message target.
     *
     * @param {State} self
     * @param {Object} message
     */
    onRequestResponseNotification(self, message) {
        const request = self.networkRequestsHandler.find(message.context.metadata.EE_PAYLOAD_PATH);
        if (request) {
            request.process(message);
            if (request.isClosed()) {
                self.manager.broadcastIgnoreRequestId(request.getId(), request.listWatches());
                self.networkRequestsHandler.destroy(message.context.metadata.EE_PAYLOAD_PATH);
            }
        }
    }

    onRemoteFleetUpdateReceived(eventData) {
        if (eventData.action > 0 && !this.fleet.includes(eventData.node)) {
            this.fleet.push(eventData.node);
        } else if (eventData.action < 0 && this.fleet.includes(eventData.node)) {
            this.fleet = this.fleet.filter(item => item !== eventData.node);
        }
    }

    /**
     * A method that returns all the nodes observed from the heartbeat stream with the observation timestamps.
     *
     * @return {Promise<ObservedNodes>}
     */
    getUniverse() {
        return this.manager.getUniverse();
    }

    /**
     * Retrieves the cached heartbeat info.
     *
     * @param node
     * @return {Promise<Object>}
     */
    async getNodeInfo(node) {
        return this.manager.getNodeInfo(node);
    }

    /**
     * Returns the configuration of a specific pipeline running on the requested node.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @return {Promise<Object>}
     */
    async getRunningPipelineConfig(node, pipelineId) {
        const nodeInfo = await this.getNodeInfo(node);
        const pipelines = nodeInfo?.data?.pipelines;
        if (pipelines && pipelines[pipelineId] !== undefined) {
            return pipelines[pipelineId].config;
        }
        return null;
    }

    /**
     * Returns the configuration of a specific instance deployed on a pipeline running on the provided node.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @param {string} instanceId
     * @return {Promise<Object>}
     */
    async getRunningInstanceConfig(node, pipelineId, instanceId) {
        const nodeInfo = await this.getNodeInfo(node);
        const pipelines = nodeInfo?.data?.pipelines;
        if (pipelines && pipelines[pipelineId] !== undefined) {
            for (const signature of Object.keys(pipelines[pipelineId].plugins)) {
                const instance = pipelines[pipelineId].plugins[signature][instanceId];
                if (instance) {
                    return instance.config;
                }
            }
        }
        return null;
    }

    /**
     * Will mark a specific node as seen in the dictionary of nodes.
     *
     * @param {string} node
     * @param {number} timestamp
     * @return {Promise<boolean>}
     */
    markNodeAsSeen(node, timestamp) {
        return this.manager.markNodeAsSeen(node, timestamp);
    }

    /**
     * Update fleet and notify other interested parties (managed threads or other observing processes) about the update.
     *
     * @param {Array<string>} fleet
     * @param {*} stateChange
     */
    broadcastUpdateFleet(fleet, stateChange) {
        this.fleet = fleet;

        this.manager.broadcastUpdateFleet(fleet, stateChange);
    }

    /**
     * Broadcast a sticky id that is to be found in the payloads. Any payload containing this session-id should be
     * routed to this specific process.
     *
     * @param {string} stickySessionId
     */
    broadcastPayloadStickySession(stickySessionId) {
        if (this.type === REDIS_STATE_MANAGER) {
            this.manager.broadcastPayloadStickySession(stickySessionId);
        }
    }

    getFleetNodes() {
        return this.fleet;
    }

    /**
     * Return the status of the controlled fleet.
     *
     * @return {Promise<Array<NodeStatus>>}
     */
    async getFleet() {
        const knownUniverse = await this.getUniverse();
        if (hasFleetFilter(this.fleet)) {
            return this.fleet.map((node) => {
                if (knownUniverse[node] !== undefined) {
                    return {
                        name: node,
                        status: {
                            online: new Date().getTime() - knownUniverse[node] < NODE_OFFLINE_CUTOFF_TIME,
                            lastSeen: new Date(knownUniverse[node]),
                        },
                    };
                }

                return {
                    name: node,
                    status: {
                        online: false,
                        lastSeen: null,
                    },
                };
            });
        } else {
            return Object.keys(knownUniverse).map((node_1) => ({
                name: node_1,
                status: {
                    online: new Date().getTime() - knownUniverse[node_1] < NODE_OFFLINE_CUTOFF_TIME,
                    lastSeen: new Date(knownUniverse[node_1]),
                },
            }));
        }
    }

    /**
     * Store the network snapshot as provided by the network supervisor.
     *
     * @param {Object} data
     * @return {Promise<boolean>}
     */
    async storeNetworkInfo(data) {
        const keys = Object.keys(data.CURRENT_NETWORK ?? {});
        if (keys.length > 0) {
            const update = {
                name: data.EE_ID,
                status: data.CURRENT_NETWORK,
                timestamp: data.TIMESTAMP_EXECUTION,
            };

            return this.manager.updateNetworkSnapshot(data.EE_ID, update);
        }
    }

    /**
     * Get the list of observed supervisor nodes.
     *
     * @return {Promise<string[]>}
     */
    async getNetworkSupervisors() {
        return this.manager.getNetworkSupervisors();
    }

    /**
     * Returns the network as seen by the `supervisor` node.
     *
     * @param {string} supervisor
     * @return {Promise<Object>}
     */
    async getNetworkStatus(supervisor = null) {
        if (supervisor) {
            // asking for info from a specific supervisor.
            return this.manager.getNetworkSnapshot(supervisor);
        }

        const supervisors = [];
        const supervisorNames = await this.manager.getNetworkSupervisors();

        for (const supervisor of supervisorNames) {
            const snapshot = await this.manager.getNetworkSnapshot(supervisor);
            supervisors.push(snapshot);
        }

        if (!supervisors.length) {
            return null;
        }

        // Sort by length DESC
        supervisors.sort((a, b) => {
            const entriesA = Object.keys(a.status).length;
            const entriesB = Object.keys(b.status).length;

            return entriesB - entriesA;
        });

        let mostRecent = {
            timestamp: '2004-04-24 10:33:37.082124',
        };
        // Search for the most recent (less than 30s) data
        for (let i = 0; i < supervisors.length; i++) {
            if (Date.parse(mostRecent.timestamp) - Date.parse(supervisors[i].timestamp) < 0) {
                mostRecent = supervisors[i];
            }

            if ((new Date().getTime() - Date.parse(mostRecent.timestamp)) / 1000 < 30) {
                return mostRecent;
            }
        }

        // all are older than 30s, return the freshest
        return mostRecent;
    }

    /**
     * Registers a thread into the InternalStateManager if that is the state manager loaded.
     *
     * @param {string} threadType
     * @param {Object} thread
     * @return {State}
     */
    registerThread(threadType, thread) {
        if (this.type === INTERNAL_STATE_MANAGER) {
            this.manager.registerThread(threadType, thread);
        }

        return this;
    }

    /**
     * Creates and configures a new transaction that will follow the completion of the request published to the
     * network.
     *
     * @param {Object} message
     * @param {Array<Array<string>>} watches
     * @param {function} onSuccess
     * @param {function} onFail
     * @return {NetworkRequest}
     */
    registerMessage(message, watches, onSuccess, onFail) {
        const request = this.networkRequestsHandler.createRequest(message['ACTION'], onSuccess, onFail);
        watches.forEach((watchPath) => {
            request.watch(watchPath);
        });

        this.manager.broadcastRequestId(request.getId(), request.listWatches());

        const firstResponseTimeout = setTimeout(() => {
            request.timeout();
        }, TIMEOUT_TO_FIRST_RESPONSE);
        const completeTimeout = setTimeout(() => {
            request.timeout();
        }, TIMEOUT_MAX_REQUEST_TIME);
        request.setTimeoutIds(firstResponseTimeout, completeTimeout);

        return request;
    }
}
