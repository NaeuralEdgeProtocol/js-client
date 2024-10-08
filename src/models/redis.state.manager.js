import {
    REDIS_LOCK_EXPIRATION_TIME,
    THREAD_COMMAND_UPDATE_STATE,
    REDIS_LOCK_MAX_RETRIES,
    REDIS_LOCK_RETRY_INTERVAL,
    THREAD_COMMAND_UPDATE_FLEET,
    NETWORK_REQUEST_RESPONSE_NOTIFICATION,
    THREAD_COMMAND_WATCH_FOR_SESSION_ID,
    THREAD_COMMAND_IGNORE_SESSION_ID,
    THREAD_COMMAND_WATCH_FOR_STICKY_SESSION_ID,
    MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE,
    NETWORK_STICKY_PAYLOAD_RECEIVED,
    FLEET_UPDATES_INBOX,
    FLEET_UPDATE_EVENT, ADDRESSES_UPDATES_INBOX, ADDRESS_UPDATE_EVENT, MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD
} from "../constants.js";
import { generateId, sleep } from '../utils/helper.functions.js';
import { getRedisConnection } from '../utils/redis.connection.provider.js';
import EventEmitter2 from 'eventemitter2';

/**
 * @class RedisStateManager
 *
 * This is the implementation of the state manager leveraging Redis as state storage. This is the manager to be used
 * when a multiprocess instance of the SDK is needed.
 */
export class RedisStateManager extends EventEmitter2 {
    /**
     * The `inboxId` to be read for messages received from other state managers/worker threads.
     *
     * @type {string|null}
     * @private
     */
    inboxId = null;

    /**
     * The Redis handler for performing cache updates and reads.
     *
     * @type {Redis|null}
     * @private
     */
    cache = null;

    /**
     * The Redis subscription channel for publishing updates to other state managers.
     *
     * @type {Redis|null}
     * @private
     */
    publishChannel = null;

    /**
     * The Redis subscription channel for receiving updates from other state managers.
     *
     * @type {Redis|null}
     * @private
     */
    subscriptionChannel = null;

    /**
     * The channel to subscribe to.
     *
     * @type {string|null}
     * @private
     */
    pubSubChannel = null;

    /**
     * Logger handler.
     *
     * @type {Logger}
     * @private
     */
    logger;

    /**
     * The RedisStateManager constructor.
     *
     * @param {Object} redisOptions
     * @param {Logger} logger
     */
    constructor(redisOptions, logger) {
        super();
        const inboxId = generateId();
        this.pubSubChannel = redisOptions.pubSubChannel;
        this.cache = getRedisConnection(redisOptions);
        this.subscriptionChannel = getRedisConnection(redisOptions);
        this.publishChannel = getRedisConnection(redisOptions);
        this.inboxId = inboxId;
        this.logger = logger;

        this.subscriptionChannel.subscribe(this.inboxId, (err) => {
            if (err) {
                this.logger.error(`[Redis State Manager] Error while subscribing to inbox (id: ${this.inboxId}}).`);
            } else {
                this.logger.log(`[Redis State Manager] Inbox subscription ok (id: ${this.inboxId}}).`);
            }
        });

        this.subscriptionChannel.subscribe(FLEET_UPDATES_INBOX, (err) => {
            if (err) {
                this.logger.error(`[Redis State Manager] Error while subscribing to fleet updates inbox (id: ${FLEET_UPDATES_INBOX}}).`);
            } else {
                this.logger.log(`[Redis State Manager] Inbox subscription ok (id: ${FLEET_UPDATES_INBOX}}).`);
            }
        });

        this.subscriptionChannel.subscribe(ADDRESSES_UPDATES_INBOX, (err) => {
            if (err) {
                this.logger.error(`[Redis State Manager] Error while subscribing to address updates inbox (id: ${ADDRESSES_UPDATES_INBOX}}).`);
            } else {
                this.logger.log(`[Redis State Manager] Inbox subscription ok (id: ${ADDRESSES_UPDATES_INBOX}}).`);
            }
        });


        this.subscriptionChannel.on('message', (channel, strMessage) => {
            if (channel === inboxId) {
                const message = JSON.parse(strMessage);
                if (message.type === MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE) {
                    this.emit(NETWORK_REQUEST_RESPONSE_NOTIFICATION, message);
                } else if (message.type === MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD){
                    this.emit(MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD, message);
                } else {
                    this.emit(NETWORK_STICKY_PAYLOAD_RECEIVED, message);
                }
            } else if (channel === FLEET_UPDATES_INBOX) {
                this.emit(FLEET_UPDATE_EVENT, JSON.parse(strMessage));
            } else if (channel === ADDRESSES_UPDATES_INBOX) {
                this.emit(ADDRESS_UPDATE_EVENT, JSON.parse(strMessage));
            }
        });
    }

    /**
     * Broadcasts working fleet to all subscribed threads.
     *
     * @param {*} stateChange
     */
    broadcastUpdateFleet(stateChange) {
        this.logger.log(`Change for ${stateChange.node} to be ${stateChange.action > 0 ? 'added to' : 'removed from'} the fleet has been posted to child threads.`);

        this.publishChannel.publish(
            FLEET_UPDATES_INBOX,
            JSON.stringify(stateChange),
        );

        this.publishChannel.publish(
            this.pubSubChannel,
            JSON.stringify({
                command: THREAD_COMMAND_UPDATE_FLEET,
                ...stateChange,
            }),
        );
    }

    /**
     * Broadcasts interest for a specific session id to all the subscribed threads. The session id will be used for
     * correct routing of the received notifications from the network.
     *
     * @param {string} requestId
     * @param {Array<string>} watches
     */
    broadcastRequestId(requestId, watches) {
        this.publishChannel.publish(
            this.pubSubChannel,
            JSON.stringify({
                command: THREAD_COMMAND_WATCH_FOR_SESSION_ID,
                requestId: requestId,
                watches: watches,
                handler: this.inboxId,
            }),
        );
    }

    /**
     * Signals the subscribed threads to remove the watch for a specific session id.
     *
     * @param {string} requestId
     * @param {Array<string>} watches
     */
    broadcastIgnoreRequestId(requestId, watches) {
        this.publishChannel.publish(
            this.pubSubChannel,
            JSON.stringify({
                command: THREAD_COMMAND_IGNORE_SESSION_ID,
                watches: watches,
                requestId: requestId,
                handler: this.inboxId,
            }),
        );
    }

    /**
     * Broadcast a sticky id that is to be found in the payloads. Any payload containing this session-id should be
     * routed to this specific process.
     *
     * @param {string} stickySessionId
     */
    broadcastPayloadStickySession(stickySessionId) {
        this.publishChannel.publish(
            this.pubSubChannel,
            JSON.stringify({
                command: THREAD_COMMAND_WATCH_FOR_STICKY_SESSION_ID,
                stickyId: stickySessionId,
                handler: this.inboxId,
            }),
        );
    }

    /**
     * Stores the processed heartbeat data into the Redis cache.
     *
     * @param {Object} info
     * @return {RedisStateManager}
     */
    nodeInfoUpdate(info) {
        const now = new Date().getTime();
        const address = info.EE_SENDER;

        const nodeTime = {
            date: info.EE_TIMESTAMP,
            utc: info.EE_TIMEZONE,
        };
        const data = info.DATA;

        const state = {
            lastUpdate: now,
            nodeTime: nodeTime,
            data: data,
        };

        this.cache.set(RedisStateManager._getRedisHeartbeatKey(address), JSON.stringify(state), 'EX', 180);
        this.publishChannel.publish(
            this.pubSubChannel,
            JSON.stringify({
                command: THREAD_COMMAND_UPDATE_STATE,
                address: address,
                state: data.pipelines,
            }),
        );
    }

    /**
     * Returns the list of all observed network nodes. An observed node is any of the nodes that published a
     * payload, notification or heartbeat, which was intercepted by the worker threads, even if that message was
     * discarded because it was not from the controlled working fleet.
     *
     * @return {Promise<ObservedNodes>}
     */
    async getUniverse() {
        const [key] = RedisStateManager._getRedisUniverseKeyAndLock();

        return this.cache.get(key).then((value) => {
            if (!value || typeof value !== 'string') {
                return {};
            }

            return JSON.parse(value);
        });
    }

    /**
     * Will mark a specific node as seen in the dictionary of nodes.
     *
     * @param {string} address
     * @param {number} timestamp
     * @return {Promise<boolean>}
     */
    async markNodeAsSeen(address, timestamp) {
        const [key, lock] = RedisStateManager._getRedisUniverseKeyAndLock();
        const lockAcquired = await this._waitForLock(lock, REDIS_LOCK_RETRY_INTERVAL, REDIS_LOCK_MAX_RETRIES);

        if (lockAcquired) {
            try {
                await this.cache.get(key).then((value) => {
                    let knownUniverse;
                    if (!value || typeof value !== 'string') {
                        knownUniverse = {};
                    } else {
                        knownUniverse = JSON.parse(value);
                    }

                    knownUniverse[address] = timestamp;

                    return this.cache.set(key, JSON.stringify(knownUniverse), 'EX', 3600);
                });

                return true;
            } catch (error) {
                this.logger.error(`[Redis State Manager] Error updating Redis key "${key}". Reason: ${error.message}`);
            } finally {
                await this.cache.del(lock);
            }
        }

        return false;
    }

    /**
     * Returns the processed heartbeat cached for a specific `address`.
     *
     * @param {string} address
     * @return {Promise<Object>}
     */
    async getNodeInfo(address) {
        return this.cache.get(RedisStateManager._getRedisHeartbeatKey(address)).then((value) => {
            if (!value || typeof value !== 'string') {
                return null;
            }

            return JSON.parse(value);
        });
    }

    /**
     * Will store the network snapshot as seen from a specific supervisor node.
     *
     * @param {string} supervisor
     * @param {Object} update
     * @return {Promise<boolean>}
     */
    async updateNetworkSnapshot(supervisor, update) {
        const [key, lock] = RedisStateManager._getSupervisorKeyAndLock(supervisor);
        const lockAcquired = await this._waitForLock(lock, REDIS_LOCK_RETRY_INTERVAL, REDIS_LOCK_MAX_RETRIES);

        if (lockAcquired) {
            try {
                await this.cache.set(key, JSON.stringify(update), 'EX', 3600 * 24 * 7);

                return this.markSupervisor(supervisor); // TODO: keep supervisors based on network snapshot
            } catch (error) {
                this.logger.error(`[Redis State Manager] Error updating Redis key "${key}". Reason: ${error.message}`);
            } finally {
                await this.cache.del(lock);
            }
        }

        return false;
    }

    /**
     * Get the list of observed network supervisors.
     *
     * @return {Promise<string[]>}
     */
    async getNetworkSupervisors() {
        const [key] = RedisStateManager._getObservedSupervisorsKeyAndLock();

        return this.cache.get(key).then((value) => {
            if (!value || typeof value !== 'string') {
                return [];
            }

            return JSON.parse(value);
        });
    }

    /**
     * Returns the network information as received from the supervisors.
     *
     * @param {string} supervisor
     * @return {Promise<Object>}
     */
    async getNetworkSnapshot(supervisor) {
        const [key] = RedisStateManager._getSupervisorKeyAndLock(supervisor);

        return this.cache.get(key).then((value) => {
            if (!value || typeof value !== 'string') {
                return null;
            }

            return JSON.parse(value);
        });
    }

    /**
     * Store information about an observed supervisor in the cache.
     *
     * @param {string} supervisor
     * @return {Promise<boolean>}
     */
    async markSupervisor(supervisor) {
        const [key, lock] = RedisStateManager._getObservedSupervisorsKeyAndLock();
        const lockAcquired = await this._waitForLock(lock, REDIS_LOCK_RETRY_INTERVAL, REDIS_LOCK_MAX_RETRIES);

        if (lockAcquired) {
            try {
                await this.cache.get(key).then((value) => {
                    const knownSupervisors = !value || typeof value !== 'string' ? [] : JSON.parse(value);
                    if (!knownSupervisors.includes(supervisor)) {
                        knownSupervisors.push(supervisor);

                        return this.cache.set(key, JSON.stringify(knownSupervisors), 'EX', 3600 * 24 * 7);
                    }
                });

                return true;
            } catch (error) {
                this.logger.error(`[Redis State Manager] Error updating Redis key "${key}". Reason: ${error.message}`);
            } finally {
                await this.cache.del(lock);
            }
        }

        return false;
    }

    /**
     * Attempts to acquire the `lock`.
     *
     * @param lock
     * @return {Promise<boolean>}
     * @private
     */
    async _acquireLock(lock) {
        const result = await this.cache.setnx(lock, true);
        if (result === 1) {
            await this.cache.expire(lock, REDIS_LOCK_EXPIRATION_TIME);

            return true;
        }

        return false;
    }

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
    async _waitForLock(lock, retryInterval = 100, maxRetries = 10) {
        let retries = 0;
        while (retries < maxRetries) {
            const lockAcquired = await this._acquireLock(lock);
            if (lockAcquired) {
                return true;
            }

            await sleep(retryInterval);

            retries++;
        }

        return false;
    }

    /**
     * Returns the cache key based on the provided `node` name.
     *
     * @param {string} node
     * @return {string}
     * @private
     */
    static _getRedisHeartbeatKey(node) {
        return `state:${node}:heartbeat`;
    }

    /**
     * Returns the cache key name and lock name for the observed universe storage.
     *
     * @return {string[]}
     * @private
     */
    static _getRedisUniverseKeyAndLock() {
        return ['known:universe', 'known:universe:lock'];
    }

    /**
     * Returns the cache key name and lock name for the observed universe addresses storage.
     *
     * @return {string[]}
     * @private
     */
    static _getRedisUniverseAddressesKeyAndLock() {
        return ['known:universe-addrs', 'known:universe-addrs:lock'];
    }

    /**
     * Returns the cache key and lock name for the list of observed network supervisors.
     *
     * @return {string[]}
     * @private
     */
    static _getObservedSupervisorsKeyAndLock() {
        return ['network:supervisors', 'network:supervisors:lock'];
    }

    /**
     * Returns the cache key and lock name for reading and updating information received from a specific `supervisor`.
     *
     * @param {string} supervisor
     * @return {string[]}
     * @private
     */
    static _getSupervisorKeyAndLock(supervisor) {
        return [`network:snapshot:${supervisor}`, `network:snapshot:${supervisor}:lock`];
    }
}
