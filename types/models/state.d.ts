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
     * The `State` constructor. Will attach any needed listeners.
     *
     * @param {string} type
     * @param {InternalStateManager|RedisStateManager} manager
     * @param {Object} options
     * @param {Logger} logger
     */
    constructor(type: string, manager: InternalStateManager | RedisStateManager, options: any, logger: Logger);
    /**
     * The type of manager to use. It can be either INTERNAL_STATE_MANAGER or REDIS_STATE_MANAGER.
     *
     * @type {string}
     * @private
     */
    private type;
    /**
     * The state manager to use for storing and applying state operations.
     *
     * @type {RedisStateManager|InternalStateManager}
     * @private
     */
    private manager;
    /**
     * The fleet to follow.
     *
     * @type {string[]}
     * @private
     */
    private fleet;
    /**
     * The open network transactions handler.
     *
     * @type {NetworkRequestsHandler}
     * @private
     */
    private networkRequestsHandler;
    addressToNodeName: {};
    nodeNameToAddress: {};
    /**
     * {Logger} logger
     */
    logger: Logger;
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
     *
     * @param eventData
     * @private
     */
    private _onRemoteFleetUpdateReceived;
    onAddressesUpdateReceived(eventData: any): void;
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
    supportsCommitFence(): boolean;
    /**
     * Acquires the per-node commit fence lock on the wrapped manager.
     *
     * @param {string} node
     * @return {Promise<string|null>} Owner token when acquired, else null.
     */
    acquireNodeCommitLock(node: string): Promise<string | null>;
    /**
     * Releases the per-node commit fence lock owned by `token`.
     *
     * @param {string} node
     * @param {string} token
     * @return {Promise<void>}
     */
    releaseNodeCommitLock(node: string, token: string): Promise<void>;
    /**
     * Reads the pipeline commit fence marker.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @return {Promise<number|null>}
     */
    getPipelineCommitMarker(node: string, pipelineId: string): Promise<number | null>;
    /**
     * Writes the pipeline commit fence marker.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @param {number} timestampMs
     * @return {Promise<boolean>}
     */
    setPipelineCommitMarker(node: string, pipelineId: string, timestampMs: number): Promise<boolean>;
    /**
     * Shared-clock time source for fence marker stamps.
     *
     * @return {Promise<number>}
     */
    getServerTimeMs(): Promise<number>;
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
     * @param {string} address
     * @param {number} timestamp
     * @return {Promise<boolean>}
     */
    markAsSeen(address: string, timestamp: number): Promise<boolean>;
    /**
     * Update fleet and notify other interested parties (managed threads or other observing processes) about the update.
     *
     * @param {*} stateChange
     */
    broadcastUpdateFleet(stateChange: any): void;
    /**
     * Broadcast a sticky id that is to be found in the payloads. Any payload containing this session-id should be
     * routed to this specific process.
     *
     * @param {string} stickySessionId
     */
    broadcastPayloadStickySession(stickySessionId: string): void;
    getFleetNodes(): string[];
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
    /**
     * Returns the address for a given value if the value is a node name, returns the value if the value is already
     * and address.
     *
     * @param {string} value
     * @return {string|null}
     */
    getAddress(value: string): string | null;
    /**
     * Returns the node name for a given address. Returns null if address has not been observed.
     *
     * @param {string} address
     * @return {string|null}
     */
    getNodeForAddress(address: string): string | null;
    /**
     *
     * @param message
     * @private
     */
    private _refreshAddresses;
    /**
     * Returns the address for a given node name. Returns null if node has not been observed.
     *
     * @param {string} node
     * @return {string|null}
     * @private
     */
    private _getAddressForNode;
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
