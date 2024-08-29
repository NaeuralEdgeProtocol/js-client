import {Logger} from "../app.logger";

/**
 * @extends EventEmitter2
 *
 * This is the implementation of the state manager leveraging node.js in-memory storage. Its purpose is to allow
 * the correct functioning of the SDK when no Redis is available (or necessary). When using the InternalStateManager
 * be aware that the SDK cannot synchronize across multiple processes.
 */
export class InternalStateManager extends EventEmitter2 {
    /**
     * The InternalStateManager constructor.
     *
     * @constructor
     * @param {Logger} logger
     */
    constructor(logger: Logger);
    /**
     * The internal state to be stored and updated by this instance. The `state` property will hold:
     * - heartbeat information to be passed to worker threads for context
     * - other observed nodes (not registered in the working fleet)
     * - pending transactions (updates communicated to the node without any responses)
     * - network status as provided by the network supervisor
     *
     * @type {Object}
     * @private
     */
    private state;
    /**
     * Handlers for the message processing threads.
     *
     * @type {Object}
     * @private
     */
    private threads;
    /**
     * Logger handler.
     *
     * @type {Logger}
     * @private
     */
    private logger;
    broadcastUpdateAddresses(addresses: any): void;
    /**
     * Broadcasts working fleet to all registered threads.
     *
     * @param {*} stateChange
     */
    broadcastUpdateFleet(stateChange: any): void;
    /**
     * Broadcasts interest for a specific session id to all the registered threads. The session id will be used for
     * correct routing of the received notifications from the network.
     *
     * @param {string} requestId
     * @param {Array<string>} watches
     */
    broadcastRequestId(requestId: string, watches: Array<string>): void;
    /**
     * Signals the registered threads to remove the watch for a specific session id.
     *
     * @param {string} requestId
     * @param {Array<string>} watches
     */
    broadcastIgnoreRequestId(requestId: string, watches: Array<string>): void;
    /**
     * Stores the processed heartbeat data into the in-memory storage.
     *
     * @param {Object} info
     * @return {InternalStateManager}
     */
    nodeInfoUpdate(info: any): InternalStateManager;
    /**
     * Returns the list of all observed network nodes. An observed node is any of the nodes that published a
     * payload, notification or heartbeat, which was intercepted by the worker threads, even if that message was
     * discarded because it was not from the controlled working fleet.
     *
     * @return {Promise<ObservedNodes>}
     */
    getUniverse(): Promise<ObservedNodes>;
    /**
     * Returns the processed heartbeat cached for a specific `address`.
     *
     * @param {string} address
     * @return {Promise<Object>}
     */
    getNodeInfo(address: string): Promise<any>;
    /**
     * Will store the network snapshot as seen from a specific supervisor node.
     *
     * @param {string} supervisor
     * @param {Object} update
     * @return {Promise<boolean>}
     */
    updateNetworkSnapshot(supervisor: string, update: any): Promise<boolean>;
    /**
     * Get the list of observed network supervisors.
     *
     * @return {Promise<string[]>}
     */
    getNetworkSupervisors(): Promise<string[]>;
    /**
     * Returns the network information as received from the supervisors.
     *
     * @param {string} supervisor
     * @return {Promise<Object>}
     */
    getNetworkSnapshot(supervisor: string): Promise<any>;
    /**
     * Will mark a specific node as seen in the dictionary of nodes.
     *
     * @param node
     * @param timestamp
     * @return {Promise<boolean>}
     */
    markNodeAsSeen(node: any, timestamp: any): Promise<boolean>;
    /**
     * Registers a worker thread handler for enabling communication from the StateManager towards the thread.
     *
     * @param {string} threadType
     * @param {Object} thread
     * @return {InternalStateManager}
     */
    registerThread(threadType: string, thread: any): InternalStateManager;
}
import EventEmitter2 from 'eventemitter2';
import {ObservedNodes} from "./state";
