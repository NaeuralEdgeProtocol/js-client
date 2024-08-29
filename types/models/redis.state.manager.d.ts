import {ObservedNodes} from "./state";

/**
 * @class RedisStateManager
 *
 * This is the implementation of the state manager leveraging Redis as state storage. This is the manager to be used
 * when a multi-process instance of the SDK is needed.
 */
export class RedisStateManager extends EventEmitter2 {
    /**
     * The RedisStateManager constructor.
     *
     * @param {Object} redisOptions
     * @param {Logger} logger
     */
    constructor(redisOptions: any, logger: Logger);
    /**
     * Broadcasts working fleet to all subscribed threads.
     *
     * @param {*} stateChange
     */
    broadcastUpdateFleet(stateChange: any): void;
    /**
     * Broadcasts interest for a specific session id to all the subscribed threads. The session id will be used for
     * correct routing of the received notifications from the network.
     *
     * @param {string} requestId
     * @param {Array<string>} watches
     */
    broadcastRequestId(requestId: string, watches: Array<string>): void;
    /**
     * Signals the subscribed threads to remove the watch for a specific session id.
     *
     * @param {string} requestId
     * @param {Array<string>} watches
     */
    broadcastIgnoreRequestId(requestId: string, watches: Array<string>): void;
    /**
     * Broadcast a sticky id that is to be found in the payloads. Any payload containing this session-id should be
     * routed to this specific process.
     *
     * @param {string} stickySessionId
     */
    broadcastPayloadStickySession(stickySessionId: string): void;
    /**
     * Stores the processed heartbeat data into the Redis cache.
     *
     * @param {Object} info
     * @return {RedisStateManager}
     */
    nodeInfoUpdate(info: any): RedisStateManager;
    /**
     * Returns the list of all observed network nodes. An observed node is any of the nodes that published a
     * payload, notification or heartbeat, which was intercepted by the worker threads, even if that message was
     * discarded because it was not from the controlled working fleet.
     *
     * @return {Promise<ObservedNodes>}
     */
    getUniverse(): Promise<ObservedNodes>;
    /**
     * Will mark a specific node as seen in the dictionary of nodes.
     *
     * @param {string} address
     * @param {number} timestamp
     * @return {Promise<boolean>}
     */
    markNodeAsSeen(address: string, timestamp: number): Promise<boolean>;
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
     * Store information about an observed supervisor in the cache.
     *
     * @param {string} supervisor
     * @return {Promise<boolean>}
     */
    markSupervisor(supervisor: string): Promise<boolean>;
}
import EventEmitter2 from 'eventemitter2';
import {Logger} from "../app.logger";
