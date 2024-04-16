import * as zlib from 'node:zlib';
import * as util from 'node:util';
import { Buffer } from 'node:buffer';
import { v4 as uuidv4 } from 'uuid';
import { ALL_EDGE_NODES } from '../constants.js';
/*
 * zLib deflate function wrapped as a promise.
 */
const zip = util.promisify(zlib.deflate);
const unzip = util.promisify(zlib.unzip);

/**
 * Helper function for zipping a string and encoding the result as base64.
 *
 * The output can be decoded using `decode(string)`.
 *
 * @param {string} code
 * @return {Promise<string>}
 */
export const encode = (code) => {
    return zip(code).then((buffer) => {
        return buffer.toString('base64');
    });
};

/**
 * Helper function for unzipping a string that has been received as base64.
 *
 * The reverse process can be obtained with `encode(code)`;
 *
 * @param {string} value the base64 encoded and zipped information.
 * @return {Promise<string>}
 */
export const decode = (value) => {
    return unzip(Buffer.from(value, 'base64')).then((buffer) => {
        return buffer.toString();
    });
};

/**
 * Helper function that transforms camelCase strings into NaeuralEdgeProtocol network specific format.
 * Conventionally, NaeuralEdgeProtocol commands have the keys in uppercase with underscore as word separator.
 *
 * eg. blockchainKeyPair will be transformed as BLOCKCHAIN_KEY_PAIR
 *
 * @param {string} input
 * @return {string}
 */
export const camelToZxAIFormat = (input) => {
    return input.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
};

/**
 * Helper function for transforming all the keys of the provided generic object into the
 * conventional NaeuralEdgeProtocol Network key format.
 *
 * @param {Object} obj
 * @return {Object}
 */
export const convertKeysToZxAIFormat = (obj) => {
    const newObj = {};

    for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
            const snakeCaseKey = camelToZxAIFormat(key);
            newObj[snakeCaseKey] = obj[key];
        }
    }

    return newObj;
};

/**
 * Helper function for transforming an NaeuralEdgeProtocol Network conventional OBJECT_KEY into a camel case objectKey.
 *
 * @param {string} key
 * @return {string}
 */
export const zxAIFormatToCamel = (key) => {
    return key.toLowerCase().replace(/([-_][a-z])/gi, ($1) => {
        return $1.toUpperCase().replace('-', '').replace('_', '');
    });
};

/**
 * Helper function for transforming all the keys of the provided generic object into the
 * conventional camelCase key format.
 *
 * @param {Object} obj
 * @return {Object}
 */
export const convertKeysToCamelFormat = (obj) => {
    const newObj = {};

    for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
            const camelCaseKey = zxAIFormatToCamel(key);
            newObj[camelCaseKey] = obj[key];
        }
    }

    return newObj;
};

/**
 * Helper function that reverts any replaced URL-unsafe characters in a base64 string.
 *
 * @param {string} urlSafeBase64
 * @return {string}
 */
export const urlSafeBase64ToBase64 = (urlSafeBase64) => {
    return urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/');
};

/**
 * Helper function that replaces any URL-unsafe characters from a base64 string.
 *
 * @param {string} base64
 * @return {string}
 */
export const base64ToUrlSafeBase64 = (base64) => {
    return base64.replace(/\+/g, '-').replace(/\//g, '_');
};

/**
 * Helper function that extracts a sub-object from the provided object based on the provided path.
 * The path string will represent each selection from the nested levels, separated by dots.
 *
 * Examples:
 *  - `name.first` will attempt to return the value stored under the `first` key of the nested object stored
 * at `name` property
 *  - `contacts.2.email` will attempt to extract the email stored under the third index of the `contacts` array
 *
 *  If no value can be found at the end of the path, the function returns `undefined`.
 *
 * @param {string} path
 * @param {Object} obj
 * @return {undefined|Object}
 */
export const pick = (path, obj) => {
    if (path === '') {
        return obj;
    }

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return undefined;
        }
    }

    return current;
};

/**
 * Helper function for checking if a value-object is of a specific type (as defined in the schema) and if it's value
 * complies with the allowedValues rule.
 *
 * @param {Object} value
 * @param {string} type
 * @param {AllowedValues} allowedValues
 * @return {boolean}
 */
export const checkType = (value, type, allowedValues) => {
    if (!type) {
        return false;
    }

    switch (type) {
        case 'integer':
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                return false;
            }
            break;
        case 'float':
            if (typeof value !== 'number') {
                return false;
            }
            break;
        case 'boolean':
            if (typeof value !== 'boolean') {
                return false;
            }
            break;
        case 'string':
            if (typeof value !== 'string') {
                return false;
            }

            if (Array.isArray(allowedValues) && !allowedValues.includes(value)) {
                return false;
            }
            break;
        case 'object':
            return true;
        default:
            if (type.startsWith('array(')) {
                if (!Array.isArray(value)) {
                    return false;
                }

                return value.every((element) => checkType(element, type.slice(6, -1), allowedValues));
            }

            return false;
    }

    if (allowedValues && (type === 'integer' || type === 'float')) {
        if (!Array.isArray(allowedValues) && allowedValues.min !== undefined && value < allowedValues.min) {
            return false;
        }

        if (!Array.isArray(allowedValues) && allowedValues.max !== undefined && value > allowedValues.max) {
            return false;
        }
    }

    return true;
};

/**
 * Helper function that validates a generic object based on a received schema. Will return an array of all the validation
 * errors, if any, empty array otherwise. This function will not check if all the mandatory keys are present, it will
 * only test if the provided values are of the correct type and the allowedValues rule is not broken.
 *
 * @param {Object} obj The object to test against the schema
 * @param {SchemaDefinition|null} schema The schema.
 * @return {Array<string>} The validation errors.
 */
export const validateAgainstSchema = (obj, schema) => {
    if (!schema) {
        return [];
    }
    const errors = [];

    for (let key in obj) {
        if (Object.hasOwn(obj, key)) {
            const field = schema.fields.find((f) => f.key === key);

            if (!field) {
                // errors.push(`Key '${key}' is not defined in the schema.`);
                continue;
            }

            const value = obj[key];

            if (!checkType(value, field.type, field.allowedValues)) {
                let message = `Validation failed for key '${key}'. Received value ${JSON.stringify(
                    value,
                )} of type ${typeof value}. Expected type: ${field.type}`;
                if (field.allowedValues) {
                    message += `, Allowed values: ${JSON.stringify(field.allowedValues)}`;
                }
                errors.push(message);
            }
        }
    }

    return errors;
};

/**
 * Helper function that returns an object with all the missing mandatory properties based on a generic object provided.
 * The mandatory properties are compuded based on the provided schema. All the properties added are assigned the default
 * values from the schema definition. If no default value is provided in the schema, the property is not added to the
 * returned object.
 *
 * @param {Object} obj The generic object.
 * @param {SchemaDefinition|null} schema The schema.
 * @param {boolean} addOptionals
 * @return {Object} A new object with all the missing properties.
 */
export const applyDefaultsToObject = (obj, schema, addOptionals = false) => {
    if (!schema) {
        return { ...obj };
    }

    const returnable = { ...obj };
    schema.fields.forEach((field) => {
        if (
            (addOptionals || field.required) &&
            (returnable[field.key] === undefined || returnable[field.key] === null)
        ) {
            if (Object.hasOwn(field, 'default')) {
                returnable[field.key] = field.default;
            }
        }
    });

    return returnable;
};

/**
 * Helper function that tests a generic object to have all the mandatory properties populated.
 *
 * @param {Object} obj The generic object.
 * @param {SchemaDefinition|null} schema The schema.
 * @return {boolean} `true` if all the mandatory properties have values.
 */
export const checkMandatoryFields = (obj, schema) => {
    if (!schema) {
        return true;
    }

    return schema.fields.every((field) => {
        if (field.required) {
            return Object.hasOwn(obj, field.key) && obj[field.key] !== null;
        }
        return true;
    });
};

/**
 * Helper function that resolves a promise after a specified amount of milliseconds.
 *
 * @param {number} timeout
 * @return {Promise<unknown>}
 */
export const sleep = async (timeout) => {
    return new Promise((resolve) => setTimeout(resolve, timeout));
};

/**
 * This function returns true if the fleet definition is correct and is not the definition of the whole network.
 * For processing the entire network, the fleet should be configured as [ ALL_EDGE_NODES ].
 *
 * @param {Array<string>} fleet a fleet definition
 * @return {boolean}
 */
export const hasFleetFilter = (fleet) => {
    return !(fleet.length === 1 && fleet[0] === ALL_EDGE_NODES);
};

/**
 * Helper function that tests if a specific value is an Object.
 *
 * @param {*} value the value to test
 * @return {boolean}
 */
export const IsObject = (value) => {
    return typeof value === 'object' && !Array.isArray(value);
};

/**
 * Helper function that extracts the first two groups of characters from a v4 Uuid. This function can be used for
 * generating unique identification strings for threads, messages or other entities.
 *
 * @return {string}
 */
export const generateId = () => {
    return uuidv4().substring(0, 13);
};

/**
 * Helper function that compares two generic objects and returns the modified keys from the second object when compared
 * to the first.
 *
 * @param {Object} original
 * @param {Object} modified
 * @return {Object|null}
 */
export const computeDifferences = (original, modified) => {
    let differences = {};

    for (const key in modified) {
        if (Object.hasOwn(modified, key)) {
            const originalValue = original[key];
            const modifiedValue = modified[key];

            if (typeof originalValue === 'object' || typeof modifiedValue === 'object') {
                if (JSON.stringify(originalValue) !== JSON.stringify(modifiedValue)) {
                    differences[key] = modifiedValue;
                }
            } else if (!Object.hasOwn(original, key) || originalValue !== modifiedValue) {
                differences[key] = modifiedValue;
            }
        }
    }

    return Object.keys(differences).length > 0 ? differences : null;
};
