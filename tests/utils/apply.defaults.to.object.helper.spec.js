import { describe, expect, test } from '@jest/globals';
import { applyDefaultsToObject } from '../../src/utils/helper.functions.js';

describe('applyDefaultsToObject function', () => {
    const schema = {
        fields: [
            {
                key: 'NR_WITNESSES',
                required: true,
                default: 5,
            },
            {
                key: 'PROCESS_DELAY',
                required: true,
                default: 1.5,
            },
            {
                key: 'OPTIONAL_FIELD',
                required: false,
                default: 'default value',
            },
            {
                key: 'NO_DEFAULT',
                required: true,
            },
        ],
    };

    test('should return the same object if no schema is provided', () => {
        const obj = { NR_WITNESSES: 10 };
        expect(applyDefaultsToObject(obj, null)).toEqual(obj);
    });

    test('should add default values for missing mandatory properties', () => {
        const obj = {};
        const expected = { NR_WITNESSES: 5, PROCESS_DELAY: 1.5 };
        expect(applyDefaultsToObject(obj, schema)).toEqual(expected);
    });

    test('should not modify an object that has all properties', () => {
        const obj = { NR_WITNESSES: 10, PROCESS_DELAY: 2 };
        expect(applyDefaultsToObject(obj, schema)).toEqual(obj);
    });

    test('should add defaults for optional properties when addOptionals is true', () => {
        const obj = {};
        const expected = { NR_WITNESSES: 5, PROCESS_DELAY: 1.5, OPTIONAL_FIELD: 'default value' };
        expect(applyDefaultsToObject(obj, schema, true)).toEqual(expected);
    });

    test('should not add optional properties when addOptionals is false', () => {
        const obj = {};
        const expected = { NR_WITNESSES: 5, PROCESS_DELAY: 1.5 };
        expect(applyDefaultsToObject(obj, schema, false)).toEqual(expected);
    });

    test('should not add properties without default values', () => {
        const obj = {};
        const expected = { NR_WITNESSES: 5, PROCESS_DELAY: 1.5 };
        expect(applyDefaultsToObject(obj, schema)).toEqual(expected);
    });
});
