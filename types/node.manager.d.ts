import { ZxAIClient } from "./client";
import { Logger } from "./app.logger";
import { ZxAIUpdateInstanceConfig } from "./constants";

/**
 * @class NodeManager
 *
 * The manager for all the node operations.
 */
export class NodeManager {
    /**
     * Returns an instance of a NodeManager for the requested `node`.
     *
     * @param {ZxAIClient} client
     * @param {string} node
     * @param {Logger} logger
     * @return {NodeManager}
     */
    static getNodeManager(client: ZxAIClient, node: string, logger: Logger): NodeManager;
    /**
     * Static method that pushes a PluginInstance to a Pipeline. If the `nowatch` flag is set to true, this operation
     * will not automatically append a watch on this instance in the next network request. This behavior is needed when
     * attaching instances found on the received heartbeat, inside internal models, or when the watch is to be added
     * manually, for supporting custom deployment mechanisms.
     *
     * @param {Pipeline} pipeline
     * @param {PluginInstance} candidate
     * @param {boolean} nowatch
     */
    static attachPluginInstanceToPipeline(pipeline: Pipeline, candidate: PluginInstance, nowatch?: boolean): void;
    /**
     * Compiles the changeset for a given Pipeline.
     *
     * @param {Pipeline} pipeline
     */
    static compilePipelineUpdateConfig(pipeline: Pipeline): any;
    /**
     * Returns the change set list for all the plugin instances running on this pipeline.
     *
     * @param {Pipeline} pipeline
     * @return {Promise<ZxAIUpdateInstanceConfig[]>}
     */
    static compilePipelineBatchUpdateInstances(pipeline: Pipeline): Promise<ZxAIUpdateInstanceConfig[]>;
    /**
     * The NodeManager constructor.
     *
     * @param {ZxAIClient} client
     * @param {string} node
     * @param {Logger} logger
     * @private
     */
    private constructor();
    /**
     * The network client reference.
     *
     * @type {ZxAIClient}
     * @private
     */
    private client;
    /**
     * The logger handler to be used for logging messages.
     *
     * @type {Logger}
     * @private
     */
    private logger;
    /**
     * The node this manager is attached to.
     *
     * @type {string}
     * @private
     */
    private node;
    /**
     * The list of open Pipelines on this node.
     *
     * @type {Array<Pipeline>}
     * @private
     */
    private pipelines;
    /**
     * The list of Pipelines to be closed when commiting the pending changes.
     *
     * @type {Array<string>}
     * @private
     */
    private pipelinesMarkedForClosing;
    /**
     *
     * @param code
     * @param instanceName
     * @param pipeline
     * @return {Promise<NodeManager>}
     */
    prepareCustomCode(code: any, instanceName: any, pipeline: any): Promise<NodeManager>;
    /**
     * Sends a request for the node hardware stats history.
     *
     * @return {Promise<Object>}
     */
    getHardwareStats(steps?: number, periodH?: number, extra?: {}, useSupervisor?: boolean): Promise<any>;
    /**
     * Sends a request to restart the node.
     *
     * @return {Promise<Object>}
     */
    restartEdgeNode(): Promise<any>;
    /**
     * Sends a request to stop the node.
     *
     * @return {Promise<Object>}
     */
    shutdownEdgeNode(): Promise<any>;
    /**
     * Sends a heartbeat request to the node.
     *
     * @return {Promise<Object>}
     */
    getHeartbeatFromEdgeNode(): Promise<any>;
    /**
     * Sends a request for a detailed heartbeat to the node.
     *
     * @return {Promise<Object>}
     */
    getFullHeartbeatFromEdgeNode(): Promise<any>;
    /**
     * Creates a pipeline on the managed node.
     *
     * @param {Object} dataSource
     * @param {string|null} name
     * @return {Promise<Pipeline>}
     */
    createPipeline(dataSource: any, name?: string | null): Promise<Pipeline>;
    /**
     * Returns the pipeline with id `pipelineId` if it exists on this node.
     *
     * @param {string} pipelineId
     * @return {Promise<Pipeline|null>}
     */
    getPipeline(pipelineId: string): Promise<Pipeline | null>;
    /**
     * Returns all the pipelines associated with a node.
     *
     * @return {Promise<Array<Pipeline>>}
     */
    getPipelines(): Promise<Array<Pipeline>>;
    /**
     * Method for creating a PluginInstance of a specific signature with the provided config. If no name is provided
     * a generated name will be assigned.
     *
     * @param {string} signature
     * @param {Object} config
     * @param {string|null} name
     * @return {PluginInstance}
     */
    createPluginInstance(signature: string, config?: any, name?: string | null): PluginInstance;
    /**
     * Returns the Plugin Instance identified by `instanceId` from the instances running on this pipeline. If no
     * instance is found, then `null` is returned.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {string} instanceId
     * @return {Promise<PluginInstance|null>}
     */
    getPluginInstance(pipelineOrId: Pipeline | string, instanceId: string): Promise<PluginInstance | null>;
    /**
     * Returns the list of plugin instances running on this pipeline.
     *
     * @return {Promise<Array<PluginInstance>>}
     */
    getPluginInstances(pipelineOrId: any): Promise<Array<PluginInstance>>;
    /**
     * Updates the DataCaptureThread metadata for the specified pipeline.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {Object} metadata
     * @return {Promise<NodeManager>}
     */
    updatePipelineMetadata(pipelineOrId: Pipeline | string, metadata: any): Promise<NodeManager>;
    /**
     * Updates the DataCaptureThread metadata for the specified pipeline.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {Object} update
     * @return {Promise<NodeManager>}
     */
    updatePipelineConfig(pipelineOrId: Pipeline | string, update: any): Promise<NodeManager>;
    /**
     * Closes the pipeline by queueing an Archive Config command for the NaeuralEdgeProtocol node.
     *
     * @param {Pipeline|string} pipelineOrId
     * @return {Promise<NodeManager>}
     */
    closePipeline(pipelineOrId: Pipeline | string): Promise<NodeManager>;
    /**
     * Adds a new Plugin Instance to be deployed on the Pipeline.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {PluginInstance} instance
     * @return {Promise<NodeManager>}
     */
    attachPluginInstance(pipelineOrId: Pipeline | string, instance: PluginInstance): Promise<NodeManager>;
    /**
     * Removes a running plugin instance from the pipeline instance list.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {PluginInstance} instance
     * @return {Promise<NodeManager>}
     */
    removePluginInstance(pipelineOrId: Pipeline | string, instance: PluginInstance): Promise<NodeManager>;
    /**
     * Links the instances provided as parameters.
     *
     * @param {Array<PluginInstance>} instances
     * @return {Promise<NodeManager>}
     */
    linkInstances(instances: Array<PluginInstance>): Promise<NodeManager>;
    /**
     * Updates the config for a provided instance.
     *
     * @param {PluginInstance} instance
     * @param {Object} update
     * @return {NodeManager}
     */
    updateInstance(instance: PluginInstance, update: any): NodeManager;
    /**
     * Sets the provided tags on the instance.
     *
     * @param {PluginInstance} instance
     * @param {Object} tags
     * @return {NodeManager}
     */
    setInstanceTags(instance: PluginInstance, tags: any): NodeManager;
    /**
     * Sets the value for a specific tag on the plugin instance.
     *
     * @param {PluginInstance} instance
     * @param {string} tag
     * @param {string} value
     * @return {NodeManager}
     */
    tagInstance(instance: PluginInstance, tag: string, value: string): NodeManager;
    /**
     * Removes a tag from the plugin instance.
     *
     * @param {PluginInstance} instance
     * @param {string} tag
     * @return {NodeManager}
     */
    removeInstanceTag(instance: PluginInstance, tag: string): NodeManager;
    /**
     * Sets the working hours schedule for the instance.
     * This method accepts either a detailed schedule for each day of the week
     * or a single schedule for all days.
     *
     * @param {PluginInstance} instance
     * @param {Object|Array} schedule - The schedule to set. If an object, it should
     * map days to time intervals. If an array, it applies the same schedule to all days.
     * @param {string} timezone
     * @returns {NodeManager} The instance of PluginInstance to allow method chaining.
     */
    setInstanceSchedule(instance: PluginInstance, schedule: any | any[], timezone?: string): NodeManager;
    /**
     * Commits the changes registered for the node.
     *
     * @return {Promise<Array<Object>>}
     */
    commit(): Promise<Array<any>>;
    /**
     * Returns the pipelines running on this node as they're reflected by the last received heartbeat.
     *
     * @return {Promise<Array<Pipeline>>}
     * @private
     */
    private _getRunningPipelines;
}
import { Pipeline } from './models/pipeline.js';
import { PluginInstance } from './models/plugin.instance.js';
