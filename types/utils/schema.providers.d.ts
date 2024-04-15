export function defaultSchemas(): SchemasRepository;
/**
 * Represents the configuration for an interval.
 */
export type IntervalDefinition = {
    /**
     * The minimum value for the interval
     */
    min?: number;
    /**
     * The maximum value for the interval
     */
    max?: number;
};
/**
 * Represents the allowed values for a field.
 */
export type AllowedValues = string[] | IntervalDefinition;
/**
 * Represents a field in the configuration.
 */
export type Field = {
    /**
     * - The key identifier for the field.
     */
    key: string;
    /**
     * - The type of the field (e.g., 'integer').
     */
    type: string;
    /**
     * - The human-readable label for the field.
     */
    label: string;
    /**
     * - The description of the field.
     */
    description: string;
    /**
     * - The default value for the field.
     */
    default: any;
    /**
     * - Whether the field is required.
     */
    required: boolean;
    /**
     * - The allowed values for the field.
     */
    allowedValues?: AllowedValues;
};
/**
 * Represents the schema configuration
 */
export type SchemaDefinition = {
    /**
     * - Optional property describing other options.
     */
    options?: any;
    /**
     * - The name of the DCT.
     */
    name: string;
    /**
     * - The description of the DCT.
     */
    description: string;
    /**
     * - The type of the DCT, indicating the specific DCT type.
     */
    type: string;
    /**
     * - An array of fields for the DCT configuration.
     */
    fields: Field[];
};
/**
 * A dictionary object holding schema configurations
 */
export type SchemaCollection = {
    [x: string]: SchemaDefinition;
};
export type SchemasRepository = {
    dct: SchemaCollection;
    plugins: SchemaCollection;
};
