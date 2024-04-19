import {Pipeline} from "./pipeline";
import {SchemaDefinition} from "../utils/schema.providers";
import {ZxAICommand, ZxAIUpdateInstanceConfig} from "../constants";

export const ID_TAGS="ID_TAGS";
export const WORKING_HOURS="WORKING_HOURS";
export const WORKING_HOURS_TIMEZONE="WORKING_HOURS_TIMEZONE";
export const LINKED_INSTANCES="LINKED_INSTANCES";
export const SINGLE_INSTANCE="SINGLE_INSTANCE";
export const reservedKeys: string[];
/**
 * @class PluginInstance
 *
 * This is the model that enables the interaction with the plugin instances running on the network node pipelines.
 * Please see the network documentation for a detailed description of the Plugin Instances.
 *
 * A PluginInstance is defined by a config object, a set of tags and the instance working hours.  Use the `make` method
 * for creating new `PluginInstance`s to ensure the proper validation of all the assets needed for correct
 * instantiation.
 */
export class PluginInstance {
    /**
     * Factory method for creating new `PluginInstance`s.
     *
     * The setup object should provide a config object and a schema for proper instantiation of the PluginInstance. If
     * the `schema` is provided, then this method will attempt to validate the config object based on the schema rules
     * and throw any errors.
     *
     * @param {Object} setup
     * @param {Pipeline|null} pipeline
     * @return {PluginInstance}
     */
    static make(setup: any, pipeline?: Pipeline | null): PluginInstance;
    /**
     * The PluginInstance constructor.
     * @private
     */
    private constructor();
    /**
     * Flag signaling that this plugin instance has changes that need to be committed to the network.
     *
     * @type {boolean}
     */
    isDirty: boolean;
    /**
     * The instance id.
     *
     * @type {string | null}
     */
    id: string | null;
    /**
     * The plugin signature.
     *
     * @type {string}
     */
    signature: string;
    /**
     * The instance config as it is on the Plugin Instance running on the NaeuralEdgeProtocol Network node.
     *
     * @type {Object}
     */
    config: any;
    /**
     * Instance stats, including errors, error times, etc.
     *
     * @type {Object}
     */
    stats: any;
    /**
     * Instance tags.
     *
     * @type {Object}
     */
    tags: any;
    /**
     * The instance schedule.
     *
     * @type {Object}
     */
    schedule: any;
    /**
     * The instance schedule timezone.
     *
     * @type {string}
     */
    scheduleTimezone: any;
    /**
     * Flag for signalling if this particular instance is outside its configured working schedule.
     *
     * @type {boolean}
     */
    outsideWorkingHours: boolean;
    /**
     * The frequency with which this instance consumes inputs from the pipeline's DCT.
     *
     * @type {number|null}
     */
    frequency: number | null;
    /**
     * Handler for the pipeline model this instance is deployed on.
     *
     * @type Pipeline
     */
    pipeline: Pipeline;
    /**
     * Instances to collect results from.
     *
     * @type {Array<string>}
     */
    linkedInstances: Array<string>;
    /**
     * The collector instance if this instance has its results collected by another instance.
     *
     * @type {string | null}
     */
    collectorInstance: string | null;
    /**
     * The config object schema definition.
     *
     * @type {SchemaDefinition|null}
     */
    schema: SchemaDefinition | null;
    /**
     * Returns the id of the pipeline this plugin instance is working on.
     *
     * @return {string}
     */
    getPipelineId(): string;
    /**
     * Returns the instance's schema.
     *
     * @return {SchemaDefinition}
     */
    getSchema(): SchemaDefinition;
    /**
     * Retrieves the running config from the PluginInstance model. The returned config will be remapped
     * on the schema if it exists.
     *
     * @return {Object}
     */
    getConfig(): any;
    /**
     * Method for updating the config on this instance.
     *
     * @param {Object} update
     * @return {PluginInstance}
     */
    updateConfig(update: any): PluginInstance;
    /**
     * Returns `true` if this plugin instance is linkable with others based on the associated schema.
     *
     * @return {boolean}
     */
    isLinkable(): boolean;
    /**
     * Returns `true` if plugin instance is either collecting other instances or if its output is collected by another.
     *
     * @return {boolean}
     */
    isLinked(): boolean;
    /**
     * Returns `true` if this particular instance's output is collected by another instance.
     *
     * @return {boolean}
     */
    isCollected(): boolean;
    /**
     * Returns `true` if this instance is the main instance, collecting and reporting output from other instances.
     *
     * @return {boolean}
     */
    isCollecting(): boolean;
    /**
     * Returns the list of collected instances.
     *
     * @return {Array<string>}
     */
    getLinkedInstances(): Array<string>;
    /**
     * Returns the path of the collecting instance.
     *
     * @return {string|null}
     */
    getCollectorInstance(): string | null;
    /**
     * Sets `this` instance as collected by the provided `instance`.
     *
     * @param {PluginInstance} instance
     * @return {PluginInstance}
     */
    setCollectorInstance(instance: PluginInstance): PluginInstance;
    /**
     * Removes all links to this instance.
     *
     * @return {PluginInstance}
     */
    purgeLinks(): PluginInstance;
    /**
     * Returns `true` if this instance is collecting data from the `tester` instance provided.
     *
     * @param {PluginInstance} tester
     * @return {boolean}
     */
    isCollectingFrom(tester: PluginInstance): boolean;
    /**
     * Attempts to link `this` instance to the `candidate` instance.
     *
     * @param {PluginInstance} candidate
     * @return {PluginInstance}
     */
    link(candidate: PluginInstance): PluginInstance;
    /**
     * Removes the link between `this` instance and the provided `linkedInstance` instance.
     *
     * @param {PluginInstance} linkedInstance
     * @return {PluginInstance}
     */
    unlink(linkedInstance: PluginInstance): PluginInstance;
    /**
     * Removes a tag from the instance if it exists.
     *
     * @param {string} key - The key of the tag to remove.
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    removeTag(key: string): PluginInstance;
    /**
     * Adds a tag to the instance or updates an existing tag.
     *
     * @param {string} key - The key of the tag to add or update.
     * @param {string} value - The value of the tag to add or update.
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    addTag(key: string, value: string): PluginInstance;
    /**
     * Retrieves all tags from the instance.
     *
     * @returns {Object} An object containing all tags.
     */
    getTags(): any;
    /**
     * Resets all tags to an empty object.
     *
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    resetTags(): PluginInstance;
    /**
     * Sets multiple tags at once, replacing any existing tags.
     *
     * @param {Object} tags - An object containing multiple tags to set.
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    bulkSetTags(tags: any): PluginInstance;
    /**
     * Retrieves the current working hours schedule of the instance.
     *
     * @returns {Object|Array} The current schedule. Returns an object for schedules
     * specific to days of the week, or an array for a uniform schedule across all days.
     */
    getSchedule(): any | any[];
    /**
     * Sets the working hours schedule for the instance.
     * This method accepts either a detailed schedule for each day of the week
     * or a single schedule for all days.
     *
     * @param {Object|Array} schedule - The schedule to set. If an object, it should
     * map days to time intervals. If an array, it applies the same schedule to all days.
     * @param {string} timezone
     * @param {boolean} dontMarkDirty
     *
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    setSchedule(schedule: any | any[], timezone?: string, dontMarkDirty?: boolean): PluginInstance;
    /**
     * Method for updating the running stats on this instance.
     *
     * @param {Object} stats
     * @return {PluginInstance}
     */
    updateStats(stats?: any): PluginInstance;
    /**
     * Returns the instance running statistics.
     *
     * @return {Object}
     */
    getInstanceStats(): any;
    /**
     * Sets the pipeline on which this instance is running.
     *
     * @param {Pipeline} pipeline
     * @return {PluginInstance}
     */
    setPipeline(pipeline: Pipeline): PluginInstance;
    /**
     * Sends a command to the instance running on the NaeuralEdgeProtocol Network node.
     *
     * @param {Object} command
     * @return {Promise<Object>}
     */
    sendCommand(command: any): Promise<any>;
    /**
     * Computes the instance update config by comparing the config running on the NaeuralEdgeProtocol Node with the proposed
     * configuration stored on the instance model.
     *
     * @return {Promise<ZxAIUpdateInstanceConfig>}
     */
    makeUpdateInstancePayload(): Promise<ZxAIUpdateInstanceConfig>;
    /**
     * Puts together all the information in one config object.
     *
     * @return {Object}
     */
    compile(): any;
    /**
     * Returns the instance command wrapped within an NaeuralEdgeProtocol Node command.
     *
     * @param command
     * @return {ZxAICommand}
     */
    getRawInstanceCommandPayload(command: any): ZxAICommand;
    /**
     * Validates the structure and content of the schedule object.
     * For separate schedules, ensures each key is a valid day and each value is an array of time intervals.
     * For a single schedule for all days, ensures it's an array of time intervals.
     * Time intervals should be in the format ["HH:MM", "HH:MM"].
     *
     * @private
     * @param {Object|Array} schedule - The schedule to validate.
     * @returns {boolean} True if the schedule is valid, otherwise throws an Error.
     */
    private _validateSchedule;
}
