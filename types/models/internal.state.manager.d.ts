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
     * In-memory pipeline commit fence storage (single-process parity with
     * `RedisStateManager`): `markers` maps `node:pipelineId` → `{ timestampMs,
     * expiresAt }`; `locks` holds currently-held per-node commit locks. Even in
     * one process, two concurrent operations on the same pipeline race the
     * heartbeat window — the fence semantics stay identical.
     *
     * @type {{markers: Object, locks: Object}}
     * @private
     */
    private commitFence;
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
     * Reads the pipeline commit fence marker for `(node, pipelineId)`.
     * In-memory parity of `RedisStateManager.getPipelineCommitMarker`; expired
     * markers behave as absent (fail-open, mirrors the Redis TTL).
     *
     * @param {string} node
     * @param {string} pipelineId
     * @return {Promise<number|null>} Epoch ms of the last commit, or null.
     */
    getPipelineCommitMarker(node: string, pipelineId: string): Promise<number | null>;
    /**
     * Writes the pipeline commit fence marker for `(node, pipelineId)` with
     * the same TTL semantics as the Redis implementation.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @param {number} timestampMs
     * @return {Promise<boolean>}
     */
    setPipelineCommitMarker(node: string, pipelineId: string, timestampMs: number): Promise<boolean>;
    /**
     * Acquires the per-node commit fence lock. Single-process, but with the
     * same owner-token + expiry semantics as the Redis implementation: a
     * holder whose release never runs frees the lock after
     * `REDIS_LOCK_EXPIRATION_TIME`, and release is compare-and-delete on the
     * token so a stale holder cannot free a successor's lock.
     *
     * @param {string} node
     * @return {Promise<string|null>} The owner token when acquired, else null.
     */
    acquireNodeCommitLock(node: string): Promise<string | null>;
    /**
     * Releases the per-node commit fence lock if this caller still owns it.
     *
     * @param {string} node
     * @param {string} token Owner token returned by `acquireNodeCommitLock`.
     * @return {Promise<void>}
     */
    releaseNodeCommitLock(node: string, token: string): Promise<void>;
    /**
     * Local-clock time source (single process — no cross-replica skew to
     * correct for). Parity with `RedisStateManager.getServerTimeMs`.
     *
     * @return {Promise<number>}
     */
    getServerTimeMs(): Promise<number>;
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
