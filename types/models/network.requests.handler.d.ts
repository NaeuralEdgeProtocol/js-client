/**
 * @class NetworkRequest
 *
 * This is the Network Request model. It handles the lifecycle of a request made for a network node and keeps track
 * of the responses received. Based on the notifications intercepted from the node, it attempts to resolve or reject
 * the promise returned upwards.
 */
export class NetworkRequest {
    /**
     * The NetworkRequest constructor.
     *
     * @param {NetworkRequestsHandler} handler
     * @param {function} onSuccess
     * @param {function} onFail
     */
    constructor(handler: NetworkRequestsHandler, onSuccess: Function, onFail: Function);
    /**
     * Network request id.
     *
     * @type {string|null}
     */
    id: string | null;
    /**
     * Request status.
     *
     * @type {boolean|null}
     */
    closed: boolean | null;
    /**
     * Success callback.
     *
     * @type {function}
     */
    onSuccess: Function;
    /**
     * Fail callback.
     *
     * @type {function}
     */
    onFail: Function;
    /**
     * A dictionary of targets to track when processing responses. It allows for correctly interpreting the flow
     * of notifications received from the nodes.
     *
     * @type {Object}
     * @private
     */
    private targets;
    /**
     * A temporary storage for all the incoming notifications. Will be bubbled upwards when resolving the promise.
     *
     * @type {Array<Object>}
     * @private
     */
    private transactionNotifications;
    /**
     * The strategy to use when interpreting the stream of received notifications.
     *
     * @type {function}
     * @private
     */
    private strategy;
    /**
     * Handlers for the timeouts.
     *
     * @type {{completion: number, firstResponse: number}}
     * @private
     */
    private timeoutIds;
    /**
     * Reference to the network request handler that keeps track of all the open requests.
     *
     * @type {NetworkRequestsHandler}
     * @private
     */
    private nodeRequestsHandler;
    /**
     * Returns the transaction id.
     *
     * @return {string|null}
     */
    getId(): string | null;
    /**
     * Returns the status of the transaction.
     *
     * @return {boolean}
     */
    isClosed(): boolean;
    /**
     * Closes the transaction and removes the completion timeout.
     *
     * @return {NetworkRequest}
     */
    close(): NetworkRequest;
    /**
     * Registers a notification path to track when resolving the transaction.
     *
     * @param {string[]} path
     * @return {NetworkRequest}
     */
    watch(path: string[]): NetworkRequest;
    /**
     * Returns `true` if the current transaction is keeping track of a specific notification `path`.
     *
     * @param  {string[]} path
     * @return {boolean}
     */
    watches(path: string[]): boolean;
    /**
     * Returns all the notification `path`s watched by the current transaction.
     *
     * @return {Array<Array<(string|null)>>}
     */
    listWatches(): Array<Array<(string | null)>>;
    /**
     * Returns `true` if all the transaction targets were hit. The completion status concerns only if all the
     * expected notifications were received, it doesn't offer information about the success of the request.
     *
     * @return {boolean}
     */
    isComplete(): boolean;
    /**
     * Returns `true` if all the transaction targets were hit and the responses are all successful.
     *
     * @return {boolean}
     */
    canResolve(): boolean;
    /**
     * Pushes a notification onto the list of notifications linked to a specific target `path`.
     *
     * @param {Object} notification
     * @return {NetworkRequest}
     */
    updateTarget(notification: any): NetworkRequest;
    /**
     * Loads a solving strategy for the current transaction.
     *
     * @param {function} strategy
     * @return {NetworkRequest}
     */
    setProcessingStrategy(strategy: Function): NetworkRequest;
    /**
     * Main processing function. All notifications should be routed through this method. When first notification is
     * received, the timeout for the first response is cleared.
     *
     * @param {Object} message
     */
    process(message: any): void;
    /**
     * Sets the timeout ids for the two timeout callbacks.
     * - firstResponseTimeoutId is the callback id for the timer waiting for the first network response
     * - completionTimeoutId is the callback id for the timer keeping track of the successful completion of the whole
     * transaction.
     *
     * @param {number} firstResponseTimeoutId
     * @param {number} completionTimeoutId
     * @return {NetworkRequest}
     */
    setTimeoutIds(firstResponseTimeoutId: number, completionTimeoutId: number): NetworkRequest;
    /**
     * Trigger the timeout on the transaction.
     */
    timeout(): void;
    /**
     * Clears the timeout for the first network response.
     *
     * @return {NetworkRequest}
     */
    clearFirstResponseTimeout(): NetworkRequest;
    /**
     * Clears the timeout for the resolving of the transaction.
     *
     * @return {NetworkRequest}
     */
    clearCompletionTimeout(): NetworkRequest;
    /**
     * Attempt to resolve the transaction.
     */
    resolve(): void;
    /**
     * Attempt to reject the transaction.
     */
    reject(): void;
}
/**
 * This is the manager keeping track of all the open transactions published for the network nodes.
 */
export class NetworkRequestsHandler {
    /**
     * The list of open transactions.
     *
     * @type {Object}
     * @private
     */
    private pendingRequests;
    /**
     * The list of object transactions indexed by the notification `path`s targeted.
     *
     * @type {Object}
     * @private
     */
    private requestsIndexes;
    /**
     * Creates a new transaction handling the message publishing for a network node.
     *
     * @param {string} action
     * @param {function} onSuccess
     * @param {function} onFail
     * @return {NetworkRequest}
     */
    createRequest(action: string, onSuccess: Function, onFail: Function): NetworkRequest;
    /**
     * Indexes the transaction `request` by the specified notification `path` to watch for.
     *
     * @param {string[]} path
     * @param {NetworkRequest} request
     * @return {NetworkRequestsHandler}
     */
    index(path: string[], request: NetworkRequest): NetworkRequestsHandler;
    /**
     * Retrieves the transaction handler watching for the supplied `path`.
     *
     * @param {string[]} path
     * @return {NetworkRequest|null}
     */
    find(path: string[]): NetworkRequest | null;
    /**
     * Cleans up the transaction handler related to the supplied `path`.
     *
     * @param {string[]} path
     * @return {NetworkRequestsHandler}
     */
    destroy(path: string[]): NetworkRequestsHandler;
}
