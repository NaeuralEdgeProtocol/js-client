import {
    ADDRESS_UPDATE_EVENT,
    FLEET_UPDATE_EVENT,
    INTERNAL_STATE_MANAGER, MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD,
    NETWORK_REQUEST_RESPONSE_NOTIFICATION,
    NETWORK_STICKY_PAYLOAD_RECEIVED,
    NODE_OFFLINE_CUTOFF_TIME,
    REDIS_STATE_MANAGER,
    TIMEOUT_MAX_REQUEST_TIME,
    TIMEOUT_TO_FIRST_RESPONSE,
    UNKNOWN_STATE_MANAGER
} from '../constants.js';
import {hasFleetFilter, isAddress} from '../utils/helper.functions.js';
import { NetworkRequestsHandler } from './network.requests.handler.js';
import EventEmitter2 from 'eventemitter2';

/**
 * @typedef {Object.<string, number>} ObservedNodes
 */

/**
 * @typedef {{name: string, status: { online: boolean, lastSeen: Date}}} NodeStatus
 */

/**
 * @typedef {Object} NetworkStatusSnapshot
 * @property {string|null} [name] Supervisor name.
 * @property {string|null} [address] Supervisor address.
 * @property {Object.<string, Object>} status Node status map.
 * @property {string} timestamp Original E2 local wall-clock timestamp.
 * @property {string|null} [timestampUtc] Normalized UTC instant.
 * @property {string|null} [timezone] E2 UTC-offset label.
 * @property {string|null} [timezoneName] E2 IANA timezone name.
 */

const NETWORK_TIMESTAMP_PATTERN =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:(Z)|([+-])(\d{2}):?(\d{2}))?$/i;
const NETWORK_UTC_OFFSET_PATTERN = /^UTC(?:([+-])(\d{1,2})(?::?(\d{2}))?)?$/i;
const MILLISECONDS_PER_MINUTE = 60_000;
const NETWORK_STATUS_FRESHNESS_MS = 30_000;
const NETWORK_STATUS_MAX_FUTURE_SKEW_MS = 30_000;

/**
 * Parses the E2 `UTC+N` offset contract into signed minutes.
 *
 * @param {unknown} timezone
 * @return {number|null}
 */
const parseNetworkUtcOffset = (timezone) => {
    if (typeof timezone !== 'string') {
        return null;
    }

    const offsetMatch = NETWORK_UTC_OFFSET_PATTERN.exec(timezone);
    if (!offsetMatch) {
        return null;
    }

    const offsetHours = Number(offsetMatch[2] ?? 0);
    const offsetMinutes = Number(offsetMatch[3] ?? 0);
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) {
        return null;
    }

    const offsetDirection = offsetMatch[1] === '-' ? -1 : 1;
    return offsetDirection * (offsetHours * 60 + offsetMinutes);
};

/**
 * Converts a NET_MON local wall-clock timestamp and its explicit UTC offset to
 * an ISO-8601 UTC instant. Existing timestamps that already carry an offset
 * remain supported. Invalid or incomplete inputs return `null` so callers do
 * not silently assign the SDK process timezone.
 *
 * @param {unknown} timestamp Local NET_MON execution timestamp.
 * @param {unknown} timezone E2 offset such as `UTC+3` or `UTC-5`.
 * @return {string|null}
 */
const normalizeNetworkTimestampToUtc = (timestamp, timezone) => {
    if (typeof timestamp !== 'string') {
        return null;
    }

    const timestampMatch = NETWORK_TIMESTAMP_PATTERN.exec(timestamp);
    if (!timestampMatch) {
        return null;
    }

    const [
        ,
        yearText,
        monthText,
        dayText,
        hourText,
        minuteText,
        secondText,
        fractionText = '',
        utcDesignator,
        explicitOffsetSign,
        explicitOffsetHours,
        explicitOffsetMinutes,
    ] = timestampMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const millisecond = Number(fractionText.padEnd(3, '0').slice(0, 3));

    let totalOffsetMinutes = 0;
    if (!utcDesignator && explicitOffsetSign) {
        const offsetHours = Number(explicitOffsetHours);
        const offsetMinutes = Number(explicitOffsetMinutes);
        if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) {
            return null;
        }

        const offsetDirection = explicitOffsetSign === '-' ? -1 : 1;
        totalOffsetMinutes = offsetDirection * (offsetHours * 60 + offsetMinutes);
    } else if (!utcDesignator) {
        const metadataOffsetMinutes = parseNetworkUtcOffset(timezone);
        if (metadataOffsetMinutes === null) {
            return null;
        }
        totalOffsetMinutes = metadataOffsetMinutes;
    }

    if (typeof timezone === 'string' && parseNetworkUtcOffset(timezone) !== totalOffsetMinutes) {
        return null;
    }

    if (year < 1000) {
        return null;
    }

    const localWallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
    const validatedLocalTime = new Date(localWallClockAsUtc);
    if (
        validatedLocalTime.getUTCFullYear() !== year ||
        validatedLocalTime.getUTCMonth() !== month - 1 ||
        validatedLocalTime.getUTCDate() !== day ||
        validatedLocalTime.getUTCHours() !== hour ||
        validatedLocalTime.getUTCMinutes() !== minute ||
        validatedLocalTime.getUTCSeconds() !== second
    ) {
        return null;
    }

    return new Date(localWallClockAsUtc - totalOffsetMinutes * MILLISECONDS_PER_MINUTE).toISOString();
};

/**
 * Returns the comparable instant for a cached supervisor snapshot.
 *
 * Only normalized instants participate in freshness and ordering. Legacy
 * snapshots remain returnable as shape-compatible fallbacks, but their local
 * wall-clock strings cannot outrank a normalized snapshot.
 *
 * @param {Object} snapshot
 * @return {number}
 */
const getNetworkSnapshotTime = (snapshot) => {
    return typeof snapshot.timestampUtc === 'string' ? Date.parse(snapshot.timestampUtc) : Number.NaN;
};

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

    addressToNodeName = {};

    nodeNameToAddress = {};

    /**
     * {Logger} logger
     */
    logger;

    /**
     * The `State` constructor. Will attach any needed listeners.
     *
     * @param {string} type
     * @param {InternalStateManager|RedisStateManager} manager
     * @param {Object} options
     * @param {Logger} logger
     */
    constructor(type, manager, options, logger) {
        super();

        this.fleet = options.fleet;
        this.type = type;
        this.manager = manager;
        this.networkRequestsHandler = new NetworkRequestsHandler();
        this.logger = logger;

        const self = this;
        this.manager.on(NETWORK_REQUEST_RESPONSE_NOTIFICATION, (message) => {
            self.onRequestResponseNotification(self, message);
        });

        this.manager.on(NETWORK_STICKY_PAYLOAD_RECEIVED, (message) => {
            self.emit(NETWORK_STICKY_PAYLOAD_RECEIVED, message);
        });

        this.manager.on(MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD, (message) => {
            self.emit(MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD, message);
        });

        this.manager.on(FLEET_UPDATE_EVENT, (message) => {
            self._onRemoteFleetUpdateReceived(message);
        });

        this.manager.on(ADDRESS_UPDATE_EVENT, (message) => {
            self.onAddressesUpdateReceived(message);
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
        const path = [...message.context.metadata.EE_PAYLOAD_PATH];
        path[0] = this.getAddress(path[0]);

        const request = self.networkRequestsHandler.find(path);
        if (request) {
            request.process(message);
            if (request.isClosed()) {
                self.manager.broadcastIgnoreRequestId(request.getId(), request.listWatches());
                self.networkRequestsHandler.destroy(path);
            }
        }
    }

    /**
     *
     * @param eventData
     * @private
     */
    _onRemoteFleetUpdateReceived(eventData) {
        if (eventData.action > 0 && !this.fleet.includes(eventData.node)) {
            this.fleet.push(eventData.node);
        } else if (eventData.action < 0 && this.fleet.includes(eventData.node)) {
            this.fleet = this.fleet.filter(item => item !== eventData.node);
        }
    }

    onAddressesUpdateReceived(eventData) {
        this._refreshAddresses(eventData);

        if (this.type === INTERNAL_STATE_MANAGER) {
            this.manager.broadcastUpdateAddresses(eventData);
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
        return this.manager.getNodeInfo(this.getAddress(node));
    }

    /**
     * Pipeline commit fence pass-throughs.
     *
     * `NodeManager.commit()` reaches the fence through `client.state` — this
     * facade — NOT through the underlying manager. These delegates (with the
     * same node→address translation as `getNodeInfo`) are therefore
     * load-bearing: without them the fence's capability probe would see
     * missing methods and silently fall back to unfenced commits in every
     * real deployment.
     */

    /**
     * Capability probe for the pipeline commit fence. The facade always
     * exposes the fence methods, so `NodeManager` must ask THIS method — which
     * checks the wrapped manager — instead of probing method existence, or a
     * custom manager without fence APIs would crash mid-commit rather than
     * taking the documented legacy (unfenced) fallback.
     *
     * @return {boolean}
     */
    supportsCommitFence() {
        return (
            typeof this.manager?.acquireNodeCommitLock === 'function' &&
            typeof this.manager?.releaseNodeCommitLock === 'function' &&
            typeof this.manager?.getPipelineCommitMarker === 'function' &&
            typeof this.manager?.setPipelineCommitMarker === 'function'
        );
    }

    /**
     * Acquires the per-node commit fence lock on the wrapped manager.
     *
     * @param {string} node
     * @return {Promise<string|null>} Owner token when acquired, else null.
     */
    async acquireNodeCommitLock(node) {
        return this.manager.acquireNodeCommitLock(this.getAddress(node));
    }

    /**
     * Releases the per-node commit fence lock owned by `token`.
     *
     * @param {string} node
     * @param {string} token
     * @return {Promise<void>}
     */
    async releaseNodeCommitLock(node, token) {
        return this.manager.releaseNodeCommitLock(this.getAddress(node), token);
    }

    /**
     * Reads the pipeline commit fence marker.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @return {Promise<number|null>}
     */
    async getPipelineCommitMarker(node, pipelineId) {
        return this.manager.getPipelineCommitMarker(this.getAddress(node), pipelineId);
    }

    /**
     * Writes the pipeline commit fence marker.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @param {number} timestampMs
     * @return {Promise<boolean>}
     */
    async setPipelineCommitMarker(node, pipelineId, timestampMs) {
        return this.manager.setPipelineCommitMarker(this.getAddress(node), pipelineId, timestampMs);
    }

    /**
     * Shared-clock time source for fence marker stamps.
     *
     * @return {Promise<number>}
     */
    async getServerTimeMs() {
        return this.manager.getServerTimeMs();
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
     * @param {string} address
     * @param {number} timestamp
     * @return {Promise<boolean>}
     */
    async markAsSeen(address, timestamp) {
        await this.manager.markNodeAsSeen(address, timestamp);

        return true;
    }

    /**
     * Update fleet and notify other interested parties (managed threads or other observing processes) about the update.
     *
     * @param {*} stateChange
     */
    broadcastUpdateFleet(stateChange) {
        if (stateChange.action > 0 && !this.fleet.includes(stateChange.node)) {
            this.fleet.push(stateChange.node);
        } else if (stateChange.action < 0 && this.fleet.includes(stateChange.node)) {
            this.fleet = this.fleet.filter(item => item !== stateChange.node);
        }

        this.manager.broadcastUpdateFleet(stateChange);
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
            return this.fleet.map((address) => {
                if (knownUniverse[address] !== undefined) {
                    return {
                        node: this.getNodeForAddress(address),
                        address: address,
                        status: {
                            online: new Date().getTime() - knownUniverse[address] < NODE_OFFLINE_CUTOFF_TIME,
                            lastSeen: new Date(knownUniverse[address]),
                        },
                    };
                }

                return {
                    node: this.getNodeForAddress(address),
                    address: address,
                    status: {
                        online: false,
                        lastSeen: null,
                    },
                };
            });
        } else {
            return Object.keys(knownUniverse).map((address) => ({
                node: this.getNodeForAddress(address),
                address: address,
                status: {
                    online: new Date().getTime() - knownUniverse[address] < NODE_OFFLINE_CUTOFF_TIME,
                    lastSeen: new Date(knownUniverse[address]),
                },
            }));
        }
    }

    /**
     * Store the network snapshot as provided by the network supervisor.
     *
     * The original local timestamp remains available for compatibility, while
     * `timestampUtc` is the only value suitable for cross-timezone ordering.
     *
     * @param {Object} data
     * @return {Promise<boolean>}
     */
    async storeNetworkInfo(data) {
        const keys = Object.keys(data.CURRENT_NETWORK ?? {});
        if (keys.length > 0) {
            const update = {
                name: data.EE_ID,
                address: data.EE_SENDER,
                status: data.CURRENT_NETWORK,
                timestamp: data.TIMESTAMP_EXECUTION,
                timestampUtc: normalizeNetworkTimestampToUtc(data.TIMESTAMP_EXECUTION, data.EE_TIMEZONE),
                timezone: data.EE_TIMEZONE ?? null,
                timezoneName: data.EE_TZ ?? null,
            };

            return this.manager.updateNetworkSnapshot(data.EE_SENDER, update);
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
     * @return {Promise<NetworkStatusSnapshot|null>}
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

        let mostRecent = null;
        let mostRecentTime = Number.NaN;
        let legacyFallback = null;
        const now = new Date().getTime();
        // Prefer the largest normalized snapshot inside the freshness window.
        for (let i = 0; i < supervisors.length; i++) {
            const supervisorTime = getNetworkSnapshotTime(supervisors[i]);
            if (!Number.isFinite(supervisorTime)) {
                legacyFallback ??= supervisors[i];
                continue;
            }

            const age = now - supervisorTime;
            if (age < -NETWORK_STATUS_MAX_FUTURE_SKEW_MS) {
                continue;
            }

            if (age <= NETWORK_STATUS_FRESHNESS_MS) {
                return supervisors[i];
            }

            if (!Number.isFinite(mostRecentTime) || mostRecentTime < supervisorTime) {
                mostRecent = supervisors[i];
                mostRecentTime = supervisorTime;
            }
        }

        // Return the freshest trusted snapshot, or a real legacy snapshot when
        // no normalized instant is available yet during a rolling deployment.
        return mostRecent ?? legacyFallback;
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

    /**
     * Returns the address for a given value if the value is a node name, returns the value if the value is already
     * and address.
     *
     * @param {string} value
     * @return {string|null}
     */
    getAddress(value) {
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
     */
    getNodeForAddress(address) {
        return this.addressToNodeName[address] ?? null;
    }

    /**
     *
     * @param message
     * @private
     */
    _refreshAddresses(message) {
        this.logger.debug('Refreshed addresses in state.');

        if (message.nodes !== undefined && message.nodes !== null) {
            this.nodeNameToAddress = message.nodes;
        }

        if (message.addresses !== undefined && message.addresses !== null) {
            this.addressToNodeName = message.addresses;
        }
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
