/**
 * @typedef {Object.<string, number>} ObservedNodes
 */
/**
 * @typedef {{name: string, status: { online: boolean, lastSeen: Date}}} NodeStatus
 */
import { NetworkRequest, NetworkRequestsHandler } from "./network.requests.handler";
/**
 * @extends EventEmitter2
 *
 * This is the model handling the state operations. It leverages either the {InternalStateManager} or the
 * {RedisStateManager} and offers support for callbacks and hooks on state changes.
 */
export class State extends EventEmitter2 {
    /**
     * The `State` constructor. Will attach any needed listeners.
     *
     * @param {string} type
     * @param {InternalStateManager|RedisStateManager} manager
     * @param {Object} options
     */
    constructor(type: string, manager: InternalStateManager | RedisStateManager, options: any);
    /**
     * Method for storing the processed heartbeat into the state.
     *
     * @param {Object} info
     * @return {InternalStateManager}
     */
    nodeInfoUpdate(info: any): InternalStateManager;
    /**
     * Pushes the received message to the transaction handler watching the message target.
     *
     * @param {State} self
     * @param {Object} message
     */
    onRequestResponseNotification(self: State, message: any): void;
    /**
     * A method that returns all the nodes observed from the heartbeat stream with the observation timestamps.
     *
     * @return {Promise<ObservedNodes>}
     */
    getUniverse(): Promise<ObservedNodes>;
    /**
     * Retrieves the cached heartbeat info.
     *
     * @param node
     * @return {Promise<Object>}
     */
    getNodeInfo(node: any): Promise<any>;
    /**
     * Returns the configuration of a specific pipeline running on the requested node.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @return {Promise<Object>}
     */
    getRunningPipelineConfig(node: string, pipelineId: string): Promise<any>;
    /**
     * Returns the configuration of a specific instance deployed on a pipeline running on the provided node.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @param {string} instanceId
     * @return {Promise<Object>}
     */
    getRunningInstanceConfig(node: string, pipelineId: string, instanceId: string): Promise<any>;
    /**
     * Will mark a specific node as seen in the dictionary of nodes.
     *
     * @param {string} node
     * @param {number} timestamp
     * @return {Promise<boolean>}
     */
    markNodeAsSeen(node: string, timestamp: number): Promise<boolean>;
    /**
     * Update fleet and notify other interested parties (managed threads or other observing processes) about the update.
     *
     * @param {Array<string>} fleet
     */
    broadcastUpdateFleet(fleet: Array<string>): void;
    /**
     * Broadcast a sticky id that is to be found in the payloads. Any payload containing this session-id should be
     * routed to this specific process.
     *
     * @param {string} stickySessionId
     */
    broadcastPayloadStickySession(stickySessionId: string): void;
    /**
     * Return the status of the controlled fleet.
     *
     * @return {Promise<Array<NodeStatus>>}
     */
    getFleet(): Promise<Array<NodeStatus>>;
    /**
     * Store the network snapshot as provided by the network supervisor.
     *
     * @param {Object} data
     * @return {Promise<boolean>}
     */
    storeNetworkInfo(data: any): Promise<boolean>;
    /**
     * Get the list of observed supervisor nodes.
     *
     * @return {Promise<string[]>}
     */
    getNetworkSupervisors(): Promise<string[]>;
    /**
     * Returns the network as seen by the `supervisor` node.
     *
     * @param {string} supervisor
     * @return {Promise<Object>}
     */
    getNetworkStatus(supervisor?: string): Promise<any>;
    /**
     * Registers a thread into the InternalStateManager if that is the state manager loaded.
     *
     * @param {string} threadType
     * @param {Object} thread
     * @return {State}
     */
    registerThread(threadType: string, thread: any): State;
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
    registerMessage(message: any, watches: Array<Array<string>>, onSuccess: Function, onFail: Function): NetworkRequest;
}
export type ObservedNodes = {
    [x: string]: number;
};
export type NodeStatus = {
    name: string;
    status: {
        online: boolean;
        lastSeen: Date;
    };
};
import EventEmitter2 from 'eventemitter2';
import { InternalStateManager } from './internal.state.manager.js';
import { RedisStateManager } from './redis.state.manager.js';
