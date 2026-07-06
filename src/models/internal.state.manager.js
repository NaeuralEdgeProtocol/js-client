import {
    IN_MEMORY_INBOX_ID, MESSAGE_TYPE_REFRESH_ADDRESSES,
    THREAD_COMMAND_IGNORE_SESSION_ID,
    THREAD_COMMAND_UPDATE_FLEET,
    THREAD_COMMAND_UPDATE_STATE,
    THREAD_COMMAND_WATCH_FOR_SESSION_ID,
    PIPELINE_COMMIT_MARKER_TTL,
    REDIS_LOCK_EXPIRATION_TIME,
    REDIS_LOCK_MAX_RETRIES,
    REDIS_LOCK_RETRY_INTERVAL,
} from '../constants.js';
import EventEmitter2 from 'eventemitter2';

/**
 * @extends EventEmitter2
 *
 * This is the implementation of the state manager leveraging node.js in-memory storage. Its purpose is to allow
 * the correct functioning of the SDK when no Redis is available (or necessary). When using the InternalStateManager
 * be aware that the SDK cannot synchronize across multiple processes.
 */
export class InternalStateManager extends EventEmitter2 {
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
    state = {
        hb: {},
        pending: {},
        universe: {},
        network: {},
    };

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
    commitFence = {
        markers: {},
        locks: {},
    };

    /**
     * Handlers for the message processing threads.
     *
     * @type {Object}
     * @private
     */
    threads = {
        heartbeats: [],
        payloads: [],
        notifications: [],
    };

    /**
     * Logger handler.
     *
     * @type {Logger}
     * @private
     */
    logger;

    /**
     * The InternalStateManager constructor.
     *
     * @constructor
     * @param {Logger} logger
     */
    constructor(logger) {
        super();
        this.logger = logger;
    }

    broadcastUpdateAddresses(addresses) {
        this.logger.log('Address map refreshed. Posting to child threads.');

        [...this.threads.heartbeats, ...this.threads.notifications, ...this.threads.payloads].forEach((thread) => {
            thread.postMessage({
                command: MESSAGE_TYPE_REFRESH_ADDRESSES,
                ...addresses,
            });
        });
    }

    /**
     * Broadcasts working fleet to all registered threads.
     *
     * @param {*} stateChange
     */
    broadcastUpdateFleet(stateChange) {
        this.logger.log(`Change for ${stateChange.node} to be ${stateChange.action > 0 ? 'added to' : 'removed from'} the fleet has been posted to child threads.`);

        [...this.threads.heartbeats, ...this.threads.notifications, ...this.threads.payloads].forEach((thread) => {
            thread.postMessage({
                command: THREAD_COMMAND_UPDATE_FLEET,
                ...stateChange,
            });
        });
    }

    /**
     * Broadcasts interest for a specific session id to all the registered threads. The session id will be used for
     * correct routing of the received notifications from the network.
     *
     * @param {string} requestId
     * @param {Array<string>} watches
     */
    broadcastRequestId(requestId, watches) {
        this.threads.notifications.forEach((thread) => {
            thread.postMessage({
                command: THREAD_COMMAND_WATCH_FOR_SESSION_ID,
                requestId: requestId,
                watches: watches,
                handler: IN_MEMORY_INBOX_ID,
            });
        });
    }

    /**
     * Signals the registered threads to remove the watch for a specific session id.
     *
     * @param {string} requestId
     * @param {Array<string>} watches
     */
    broadcastIgnoreRequestId(requestId, watches) {
        this.threads.notifications.forEach((thread) => {
            thread.postMessage({
                command: THREAD_COMMAND_IGNORE_SESSION_ID,
                requestId: requestId,
                watches: watches,
                handler: IN_MEMORY_INBOX_ID,
            });
        });
    }

    /**
     * Stores the processed heartbeat data into the in-memory storage.
     *
     * @param {Object} info
     * @return {InternalStateManager}
     */
    nodeInfoUpdate(info) {
        const now = new Date().getTime();
        const address = info.EE_SENDER;

        const nodeTime = {
            date: info.EE_TIMESTAMP,
            utc: info.EE_TIMEZONE,
        };
        const data = info.DATA;

        // Update node state indexed by address
        if (!this.state.hb[address]) {
            this.state.hb[address] = {
                lastUpdate: null,
                nodeTime: null,
                data: null,
            };
        }

        this.state.hb[address].lastUpdate = now;
        this.state.hb[address].nodeTime = { ...nodeTime };
        this.state.hb[address].data = { ...data };

        [...this.threads.notifications, ...this.threads.payloads].forEach((thread) => {
            thread.postMessage({
                command: THREAD_COMMAND_UPDATE_STATE,
                address: address,
                state: data.pipelines,
            });
        });

        return this;
    }

    /**
     * Returns the list of all observed network nodes. An observed node is any of the nodes that published a
     * payload, notification or heartbeat, which was intercepted by the worker threads, even if that message was
     * discarded because it was not from the controlled working fleet.
     *
     * @return {Promise<ObservedNodes>}
     */
    async getUniverse() {
        return new Promise((resolve) => {
            resolve(this.state.universe);
        });
    }

    /**
     * Returns the processed heartbeat cached for a specific `address`.
     *
     * @param {string} address
     * @return {Promise<Object>}
     */
    async getNodeInfo(address) {
        return new Promise((resolve) => {
            resolve(this.state.hb[address] !== undefined ? this.state.hb[address] : null);
        });
    }

    /**
     * Reads the pipeline commit fence marker for `(node, pipelineId)`.
     * In-memory parity of `RedisStateManager.getPipelineCommitMarker`; expired
     * markers behave as absent (fail-open, mirrors the Redis TTL).
     *
     * @param {string} node
     * @param {string} pipelineId
     * @return {Promise<number|null>} Epoch ms of the last commit, or null.
     */
    async getPipelineCommitMarker(node, pipelineId) {
        const marker = this.commitFence.markers[`${node}:${pipelineId}`];
        if (!marker || marker.expiresAt <= new Date().getTime()) {
            return null;
        }

        return marker.timestampMs;
    }

    /**
     * Writes the pipeline commit fence marker for `(node, pipelineId)` with
     * the same TTL semantics as the Redis implementation.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @param {number} timestampMs
     * @return {Promise<boolean>}
     */
    async setPipelineCommitMarker(node, pipelineId, timestampMs) {
        this.commitFence.markers[`${node}:${pipelineId}`] = {
            timestampMs,
            expiresAt: new Date().getTime() + PIPELINE_COMMIT_MARKER_TTL * 1000,
        };

        return true;
    }

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
    async acquireNodeCommitLock(node) {
        let retries = 0;
        while (retries < REDIS_LOCK_MAX_RETRIES) {
            const existing = this.commitFence.locks[node];
            const now = new Date().getTime();
            if (!existing || existing.expiresAt <= now) {
                const token = `${now}-${Math.floor(Math.random() * 1e9)}`;
                this.commitFence.locks[node] = {
                    token,
                    expiresAt: now + REDIS_LOCK_EXPIRATION_TIME * 1000,
                };

                return token;
            }

            await new Promise((resolve) => setTimeout(resolve, REDIS_LOCK_RETRY_INTERVAL));
            retries++;
        }

        return null;
    }

    /**
     * Releases the per-node commit fence lock if this caller still owns it.
     *
     * @param {string} node
     * @param {string} token Owner token returned by `acquireNodeCommitLock`.
     * @return {Promise<void>}
     */
    async releaseNodeCommitLock(node, token) {
        if (this.commitFence.locks[node]?.token === token) {
            delete this.commitFence.locks[node];
        }
    }

    /**
     * Local-clock time source (single process — no cross-replica skew to
     * correct for). Parity with `RedisStateManager.getServerTimeMs`.
     *
     * @return {Promise<number>}
     */
    async getServerTimeMs() {
        return new Date().getTime();
    }

    /**
     * Will store the network snapshot as seen from a specific supervisor node.
     *
     * @param {string} supervisor
     * @param {Object} update
     * @return {Promise<boolean>}
     */
    async updateNetworkSnapshot(supervisor, update) {
        this.state.network[supervisor] = update;

        return new Promise((resolve) => {
            resolve(true);
        });
    }

    /**
     * Get the list of observed network supervisors.
     *
     * @return {Promise<string[]>}
     */
    async getNetworkSupervisors() {
        const supervisors = Object.keys(this.state.network);

        return new Promise((resolve) => {
            resolve(supervisors);
        });
    }

    /**
     * Returns the network information as received from the supervisors.
     *
     * @param {string} supervisor
     * @return {Promise<Object>}
     */
    async getNetworkSnapshot(supervisor) {
        const snapshot = this.state.network[supervisor] ?? null;

        return new Promise((resolve) => {
            resolve(snapshot);
        });
    }

    /**
     * Will mark a specific node as seen in the dictionary of nodes.
     *
     * @param node
     * @param timestamp
     * @return {Promise<boolean>}
     */
    async markNodeAsSeen(node, timestamp) {
        this.state.universe[node] = timestamp;

        return new Promise((resolve) => {
            resolve(true);
        });
    }

    /**
     * Registers a worker thread handler for enabling communication from the StateManager towards the thread.
     *
     * @param {string} threadType
     * @param {Object} thread
     * @return {InternalStateManager}
     */
    registerThread(threadType, thread) {
        this.threads[threadType].push(thread);

        return this;
    }
}
