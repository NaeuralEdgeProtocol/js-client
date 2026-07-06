/**
 * @class Pipeline
 *
 * This is the model that allows interactions with the pipelines deployed on the network nodes. Please see the network
 * documentation for a detailed description of the Pipelines.
 *
 * A Pipeline is defined by a config object and a set of plugins running on the pipeline.  Use the `make` method for
 * creating new `Pipeline`s to ensure the proper validation of all the assets needed for correct instantiation.
 */
export class Pipeline {
    /**
     * Static factory for constructing Pipeline models.
     *
     * @param {Naeural} client
     * @param {string} node
     * @param {Object} config
     * @param {SchemasRepository} schemas
     * @param {boolean} dirty
     * @return {Pipeline}
     */
    static make(client: Naeural, node: string, config: any, schemas: SchemasRepository, dirty?: boolean): Pipeline;
    /**
     * The Pipeline model constructor.
     *
     * @param {string} initiator
     * @param {string} node
     * @param {string} name
     * @param {DataCaptureThread} dct
     * @param {Naeural} client
     * @private
     */
    private constructor();
    /**
     * Flag for signalling uncommitted changes to this model.
     *
     * @type {boolean}
     */
    isDirty: boolean;
    /**
     * Commit fence view-basis: epoch ms at which the heartbeat this pipeline
     * was hydrated from was RECEIVED, stamped by
     * `NodeManager._getRunningPipelines`. Full-config commits compare this
     * basis against the pipeline's last mutation marker (plus the apply-grace
     * window) — see `NodeManager.commit()`. Null on locally authored
     * pipelines and on legacy state entries (normalized to 0 = always-stale
     * at commit time for hydrated views).
     *
     * @type {number|null}
     * @private
     */
    private _viewBasisTs;
    /**
     * Commit fence authorship flag: true ONLY between `NodeManager.createPipeline`
     * and this pipeline's first successful full-config commit. Authored
     * pipelines skip the staleness check (their config is authoritative
     * intent, not a derived snapshot) but still advance the fence marker. The
     * flag is cleared on commit — persistent authorship would be an unbounded
     * fence bypass on long-lived managers; afterwards the own-marker rule
     * (`_ownMarkerTs`) governs.
     *
     * @type {boolean}
     * @private
     */
    private _locallyAuthored;
    /**
     * Commit fence own-marker: the marker timestamp the OWNING manager wrote
     * for this pipeline at its last successful commit. When the shared marker
     * still equals this value, the last mutation is this manager's own commit
     * and its in-memory config already contains it — back-to-back commits on
     * the same manager pass. Any foreign marker advance (another
     * replica/manager committed since) refuses, closing the reused-manager
     * clobber path.
     *
     * @type {number|null}
     * @private
     */
    private _ownMarkerTs;
    /**
     * The pipeline name.
     *
     * @readonly
     * @type {string}
     */
    readonly id: string;
    /**
     * List of plugin instances running on this pipeline.
     *
     * @type {PluginInstance[]}
     */
    instances: PluginInstance[];
    /**
     * The NaeuralEdgeProtocol Edge Node on which this pipeline is running.
     *
     * @type {string}
     * @readonly
     */
    readonly node: string;
    /**
     * The Data Capture Thread used for feeding data to the pipeline.
     *
     * @type {DataCaptureThread | null}
     * @private
     */
    private dct;
    /**
     * The id of the process that changed the pipeline last.
     *
     * @type {string}
     * @readonly
     */
    readonly initiator: string;
    /**
     * The reference to the NaeuralEdgeProtocol Network Client.
     *
     * @type {Naeural}
     * @private
     */
    private client;
    /**
     * A dictionary of paths involved in publishing messages.
     *
     * @type {{}}
     * @private
     */
    private watches;
    /**
     * Returns the pipeline name/id.
     *
     * @return {string}
     */
    getId(): string;
    /**
     * Returns the id of the process that changed the pipeline last.
     *
     * @return {string}
     */
    getInitiator(): string;
    /**
     * Returns the address of the NaeuralEdgeProtocol Network Node this pipeline runs on.
     *
     * @return {string}
     */
    getNode(): string;
    /**
     * Returns the type of the datasource feeding data into this pipeline.
     *
     * @return {string}
     */
    getType(): string;
    /**
     * Returns the NaeuralEdgeProtocol Network Client reference.
     *
     * @return {Naeural}
     */
    getClient(): Naeural;
    /**
     * Returns the configured Data Capture Thread Model that feeds data into this pipeline.
     *
     * @return {DataCaptureThread|null}
     */
    getDataCaptureThread(): DataCaptureThread | null;
    updateConfig(update: any): this;
    /**
     * Returns the metadata set on this pipeline.
     *
     * @return {*}
     */
    getMetadata(): any;
    /**
     * Updates metadata set on this pipeline.
     *
     * @param {Object} metadata
     * @return {Pipeline}
     */
    updateMetadata(metadata: any): Pipeline;
    /**
     * Adds an `EE_MESSAGE_PATH` to watch for in the following network request.
     *
     * @param {Array<string>} path
     * @return {Pipeline}
     */
    addInstanceWatch(path: Array<string>): Pipeline;
    /**
     * Returns all configured `EE_MESSAGE_PATH`s to be watched in the following network request.
     *
     * @return {Array<Array<string>>}
     */
    getInstanceWatches(): Array<Array<string>>;
    /**
     * Removes a previously configured `EE_MESSAGE_PATH` from the list to be watched in the following network request.
     *
     * @param {Array<string>} path
     * @return {Pipeline}
     */
    removeInstanceWatch(path: Array<string>): Pipeline;
    /**
     * Removes all previously configured `EE_MESSAGE_PATHS` from the list to be watched in the following network request.
     *
     * @return {Pipeline}
     */
    removeAllInstanceWatches(): Pipeline;
    /**
     * Sends the provided `command` to the pipeline running on the NaeuralEdgeProtocol Node.
     *
     * @param {Object} command
     * @return {Promise<*>}
     */
    sendCommand(command: any): Promise<any>;
    /**
     * Returns the Edge Node command wrapping the Pipeline command.
     *
     * @param {Object} command
     * @return {NaeuralCommand}
     * @private
     */
    private _getRawPipelineCommandPayload;
}
import { PluginInstance } from './plugin.instance.js';
import { DataCaptureThread } from './data.capture.thread.js';
