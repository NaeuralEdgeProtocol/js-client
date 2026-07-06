/**
 * Error thrown by the pipeline commit fence when a full pipeline
 * `UPDATE_CONFIG` would be published from a view that predates the last
 * committed change of that pipeline.
 *
 * Why this exists: `NodeManager` pipeline views are hydrated from the last
 * received heartbeat. After a successful commit, the edge node needs one
 * heartbeat round-trip before the shared state reflects the change; any view
 * built in that window would compile the pre-change config, and publishing it
 * would silently revert the concurrent change (last-writer-wins corruption).
 * The fence converts that silent clobber into this visible, retryable error.
 *
 * Callers should rebuild their node manager (fresh heartbeat view) and retry
 * the operation; cron-style callers can simply retry on their next tick.
 */
export class StalePipelineViewError extends Error {
    /**
     * @param {string} node Node address the commit was destined for.
     * @param {string} pipelineId Pipeline whose view is stale.
     * @param {number} markerTs Epoch ms of the last committed change (fence marker).
     * @param {number} viewBasisTs Epoch ms of the heartbeat this view was built from.
     */
    constructor(node: string, pipelineId: string, markerTs: number, viewBasisTs: number);
    node: string;
    pipelineId: string;
    markerTs: number;
    viewBasisTs: number;
}
