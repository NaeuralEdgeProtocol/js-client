/**
 * Represents the configuration for an interval.
 * @typedef {Object} IntervalDefinition
 * @property {number} [min] The minimum value for the interval
 * @property {number} [max] The maximum value for the interval
 */

/**
 * Represents the allowed values for a field.
 * @typedef {string[]|IntervalDefinition} AllowedValues
 */

/**
 * Represents a field in the configuration.
 * @typedef {Object} Field
 * @property {string} key - The key identifier for the field.
 * @property {string} type - The type of the field (e.g., 'integer').
 * @property {string} label - The human-readable label for the field.
 * @property {string} description - The description of the field.
 * @property {*} default - The default value for the field.
 * @property {boolean} required - Whether the field is required.
 * @property {AllowedValues} [allowedValues] - The allowed values for the field.
 */

/**
 * Represents the schema configuration
 * @typedef {Object} SchemaDefinition
 * @property {*} [options] - Optional property describing other options.
 * @property {string} name - The name of the DCT.
 * @property {string} description - The description of the DCT.
 * @property {string} type - The type of the DCT, indicating the specific DCT type.
 * @property {Field[]} fields - An array of fields for the DCT configuration.
 */

/**
 * A dictionary object holding schema configurations
 * @typedef {Object.<string, SchemaDefinition>} SchemaCollection
 */

/**
 * @typedef {{dct: SchemaCollection, plugins: SchemaCollection}} SchemasRepository
 */

import {
    DCT_TYPE_META_STREAM,
    DCT_TYPE_ON_DEMAND_INPUT,
    DCT_TYPE_ON_DEMAND_TEXT_INPUT,
    DCT_TYPE_VIDEO_FILE,
    DCT_TYPE_VIDEO_STREAM,
    DCT_TYPE_VOID_STREAM,
    metaStreamDCTSchema,
    onDemandInputSchema,
    onDemandTextInputSchema,
    videoFileDCTSchema,
    videoStreamDCTSchema,
    voidDCTSchema,
} from './dcts/index.js';
import {CUSTOM_EXEC_01_SIGNATURE, pluginDefinition as CustomExec } from './plugins/custom.exec.plugin.js';

/** @type {SchemaCollection} */
const dctSchemas = {
    [`${DCT_TYPE_VIDEO_STREAM}`]: videoStreamDCTSchema,
    [`${DCT_TYPE_VIDEO_FILE}`]: videoFileDCTSchema,
    [`${DCT_TYPE_META_STREAM}`]: metaStreamDCTSchema,
    [`${DCT_TYPE_VOID_STREAM}`]: voidDCTSchema,
    [`${DCT_TYPE_ON_DEMAND_INPUT}`]: onDemandInputSchema,
    [`${DCT_TYPE_ON_DEMAND_TEXT_INPUT}`]: onDemandTextInputSchema,
};

/** @type {SchemaCollection} */
const pluginSchemas = {
    [`${CUSTOM_EXEC_01_SIGNATURE}`]: CustomExec.schema,
};

/** @type {SchemasRepository} */
const schemas = {
    dct: dctSchemas,
    plugins: pluginSchemas,
};

/**
 * The default schemas supported by the SDK.
 *
 * @return {SchemasRepository}
 */
export const defaultSchemas = () => {
    return schemas;
};
