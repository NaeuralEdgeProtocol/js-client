import { describe, expect, test } from '@jest/globals';
import { checkMandatoryFields } from '../../src/utils/helper.functions.js';

describe('checkMandatoryFields function', () => {
    const schema = {
        fields: [
            {
                key: 'NR_WITNESSES',
                required: true,
            },
            {
                key: 'PROCESS_DELAY',
                required: false,
            },
            {
                key: 'MANDATORY_FIELD',
                required: true,
            },
        ],
    };

    test('should return true if all mandatory fields are present', () => {
        const obj = { NR_WITNESSES: 5, MANDATORY_FIELD: 'value' };
        expect(checkMandatoryFields(obj, schema)).toBe(true);
    });

    test('should return false if a mandatory field is missing', () => {
        const obj = { NR_WITNESSES: 5 };
        expect(checkMandatoryFields(obj, schema)).toBe(false);
    });

    test('should return true if the object contains extra fields not in the schema', () => {
        const obj = { NR_WITNESSES: 5, MANDATORY_FIELD: 'value', EXTRA_FIELD: 'extra' };
        expect(checkMandatoryFields(obj, schema)).toBe(true);
    });

    test('should return true for objects with all optional fields missing', () => {
        const obj = { NR_WITNESSES: 5, MANDATORY_FIELD: 'value' };
        expect(checkMandatoryFields(obj, schema)).toBe(true);
    });

    test('should return true if no schema is provided', () => {
        const obj = { anyField: 'anyValue' };
        expect(checkMandatoryFields(obj, null)).toBe(true);
    });

    test('should return false if a mandatory field is null', () => {
        const obj = { NR_WITNESSES: null, MANDATORY_FIELD: 'value' };
        expect(checkMandatoryFields(obj, schema)).toBe(false);
    });

    test('should return false if all mandatory fields are null', () => {
        const obj = { NR_WITNESSES: null, MANDATORY_FIELD: null };
        expect(checkMandatoryFields(obj, schema)).toBe(false);
    });

    test('should return false if one mandatory field is present and another is null', () => {
        const obj = { NR_WITNESSES: 5, MANDATORY_FIELD: null };
        expect(checkMandatoryFields(obj, schema)).toBe(false);
    });
});
