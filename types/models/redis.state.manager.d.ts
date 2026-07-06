/**
 * @class RedisStateManager
 *
 * This is the implementation of the state manager leveraging Redis as state storage. This is the manager to be used
 * when a multiprocess instance of the SDK is needed.
 */
export class RedisStateManager extends EventEmitter2 {
    /**
     * Returns the cache key based on the provided `node` name.
     *
     * @param {string} node
     * @return {string}
     * @private
     */
    private static _getRedisHeartbeatKey;
    /**
     * Returns the cache key holding the pipeline commit fence marker: the epoch
     * ms of the last full `UPDATE_CONFIG` committed for `pipelineId` on `node`.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @return {string}
     * @private
     */
    private static _getRedisCommitMarkerKey;
    /**
     * Returns the cache key used as the per-node commit fence lock.
     *
     * @param {string} node
     * @return {string}
     * @private
     */
    private static _getRedisNodeCommitLockKey;
    /**
     * Returns the cache key name and lock name for the observed universe storage.
     *
     * @return {string[]}
     * @private
     */
    private static _getRedisUniverseKeyAndLock;
    /**
     * Returns the cache key name and lock name for the observed universe addresses storage.
     *
     * @return {string[]}
     * @private
     */
    private static _getRedisUniverseAddressesKeyAndLock;
    /**
     * Returns the cache key and lock name for the list of observed network supervisors.
     *
     * @return {string[]}
     * @private
     */
    private static _getObservedSupervisorsKeyAndLock;
    /**
     * Returns the cache key and lock name for reading and updating information received from a specific `supervisor`.
     *
     * @param {string} supervisor
     * @return {string[]}
     * @private
     */
    private static _getSupervisorKeyAndLock;
    /**
     * The RedisStateManager constructor.
     *
     * @param {Object} redisOptions
     * @param {Logger} logger
     */
    constructor(redisOptions: any, logger: Logger);
    /**
     * The `inboxId` to be read for messages received from other state managers/worker threads.
     *
     * @type {string|null}
     * @private
     */
    private inboxId;
    /**
     * The Redis handler for performing cache updates and reads.
     *
     * @type {Redis|null}
     * @private
     */
    private cache;
    /**
     * The Redis subscription channel for publishing updates to other state managers.
     *
     * @type {Redis|null}
     * @private
     */
    private publishChannel;
    /**
     * The Redis subscription channel for receiving updates from other state managers.
     *
     * @type {Redis|null}
     * @private
     */
    private subscriptionChannel;
    /**
     * The channel to subscribe to.
     *
     * @type {string|null}
     * @private
     */
    private pubSubChannel;
    /**
     * Logger handler.
     *
     * @type {Logger}
     * @private
     */
    private logger;
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
    /**
     * Attempts to acquire the `lock`.
     *
     * @param lock
     * @return {Promise<boolean>}
     * @private
     */
    private _acquireLock;
    /**
     * Waits for aquiring the `lock` for a specified amount of time defined by the `retryInterval` and number of
     * `maxRetries`.
     *
     * @param {string} lock
     * @param {number} retryInterval
     * @param {number} maxRetries
     * @return {Promise<boolean>}
     * @private
     */
    private _waitForLock;
    /**
     * Reads the pipeline commit fence marker for `(node, pipelineId)`.
     *
     * The marker records WHEN the pipeline's config was last committed. A
     * heartbeat-derived view older than this marker must not publish a full
     * `UPDATE_CONFIG` (it would revert the committed change). Markers expire
     * after `PIPELINE_COMMIT_MARKER_TTL` so the fence fails open rather than
     * wedging commits behind a crashed committer.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @return {Promise<number|null>} Epoch ms of the last commit, or null.
     */
    getPipelineCommitMarker(node: string, pipelineId: string): Promise<number | null>;
    /**
     * Writes the pipeline commit fence marker for `(node, pipelineId)`.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @param {number} timestampMs Epoch ms to record as the last-commit time.
     * @return {Promise<boolean>}
     */
    setPipelineCommitMarker(node: string, pipelineId: string, timestampMs: number): Promise<boolean>;
    /**
     * Acquires the per-node commit fence lock, serializing the
     * preflight → publish → mark critical section across all processes
     * sharing this Redis. Owner-token semantics: unlike the legacy
     * `_waitForLock`/`del` pair, release is compare-and-delete on a unique
     * token, so a holder stalled past `REDIS_LOCK_EXPIRATION_TIME` (e.g. a
     * Redis reconnect pause) can never delete a successor's lock and collapse
     * the mutual exclusion. A crashed holder self-heals via the EX expiry.
     *
     * @param {string} node
     * @return {Promise<string|null>} The owner token when acquired, else null.
     */
    acquireNodeCommitLock(node: string): Promise<string | null>;
    /**
     * Releases the per-node commit fence lock if and only if this caller still
     * owns it (Lua compare-and-delete on the owner token).
     *
     * @param {string} node
     * @param {string} token Owner token returned by `acquireNodeCommitLock`.
     * @return {Promise<void>}
     */
    releaseNodeCommitLock(node: string, token: string): Promise<void>;
    /**
     * Returns the Redis server time in epoch ms, falling back to the local
     * clock when the TIME command is unavailable. This removes the
     * COMMITTER's clock from fence marker stamps; heartbeat `lastUpdate`
     * stamps still come from the receiving replica's wall clock, so residual
     * replica-vs-Redis skew remains and is absorbed by
     * `PIPELINE_COMMIT_APPLY_GRACE_MS` (see constants.js).
     *
     * @return {Promise<number>}
     */
    getServerTimeMs(): Promise<number>;
}
import EventEmitter2 from 'eventemitter2';
