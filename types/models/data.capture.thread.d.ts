import {SchemaDefinition} from "../utils/schema.providers";

/**
 * @class DataCaptureThread
 *
 * This is the class describing the structure of a DCT. Please see the network documentation for a detailed description
 * of the Data Capture Threads.
 *
 * A DCT is defined by a config object and a set of statistics received from the network node. Use the `make` method for
 * instantiating DCTs to ensure the proper validation of all the assets needed for correct instantiation.
 */
export class DataCaptureThread {
    /**
     * Static factory to instantiate DataCaptureThreads.
     *
     * When called, will attempt to validate the config against the schema. Any errors will be thrown. This method
     * is used both internally, when loading pipeline configurations from the heartbeat info, and when creating
     * new pipelines to be deployed on the network node.
     *
     * @param {*} candidateConfig
     * @param {*} stats
     * @param {SchemaDefinition|null} schema
     * @param {boolean} dirty
     * @return {DataCaptureThread}
     */
    static make(candidateConfig: any, stats?: any, schema?: SchemaDefinition | null, dirty?: boolean): DataCaptureThread;
    /**
     * Private constructor. Use the `make()` method for creating new instances of DCTs.
     */
    private constructor();
    /**
     * Signals syncronization on network node.
     *
     * @type {boolean}
     */
    isDirty: boolean;
    /**
     * The Data Capture Thread config.
     *
     * @type {Object}
     */
    config: any;
    /**
     * Time.
     *
     * @type {Object}
     */
    time: any;
    /**
     * Stats.
     *
     * @type {Object}
     */
    stats: any;
    /**
     * Data Per Second metrics.
     *
     * @type {Object}
     */
    dps: any;
    /**
     * The config schema used for validation.
     *
     * @type {SchemaDefinition}
     */
    schema: SchemaDefinition;
    /**
     * Sets the statistics for this capture thread, as received from heartbeat.
     *
     * @method
     * @param stats
     * @return {DataCaptureThread}
     */
    setStats(stats: any): DataCaptureThread;
    /**
     * Returns the DCT config as stored on the instance. If a schema is provided, any properties missing from the
     * schema will be dropped from the returned object. Any properties missing from the config and present on the
     * schema will be returned with their default values as defined by the schema.
     *
     * @return {Object}
     */
    getConfig(): any;
    /**
     * Updates the config values of a DCT. The update is validated against the stored schema, if the validation fails
     * the errors are thrown.
     *
     * When updating, the DCT instance will be marked as dirty in order to be synchronized with the edge node by the
     * node manager handling the communication.
     *
     * @param update
     * @return {DataCaptureThread}
     */
    updateConfig(update: any): DataCaptureThread;
    /**
     * Shorthand method for returning the properties stored on the `STREAM_CONFIG_METADATA` config key. Depending on
     * the DCT implementation, this metadata can describe how the data is provided for the pipeline. One such example
     * could be the resolution of the extracted video frames that are fed into the computer vision pipelines.
     *
     * @return {Object}
     */
    getMetadata(): any;
    /**
     * Shorthand method for updating the DCT metadata stored on the `STREAM_CONFIG_METADATA` config key.
     *
     * @param {Object} metadata
     * @return {DataCaptureThread}
     */
    updateMetadata(metadata: any): DataCaptureThread;
}
