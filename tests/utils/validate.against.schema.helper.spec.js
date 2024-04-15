import { describe, expect, test } from '@jest/globals';
import { validateAgainstSchema } from '../../src/utils/helper.functions';

describe('validateAgainstSchema function', () => {
    const schema = {
        fields: [
            {
                key: 'NR_WITNESSES',
                type: 'integer',
                allowedValues: { min: 1, max: 20 },
            },
            {
                key: 'PROCESS_DELAY',
                type: 'float',
                allowedValues: null,
            },
        ],
    };

    test('should return an empty array for a valid object', () => {
        const obj = { NR_WITNESSES: 5, PROCESS_DELAY: 1.5 };
        expect(validateAgainstSchema(obj, schema)).toEqual([]);
    });

    test('should return errors for an object with invalid types', () => {
        const obj = { NR_WITNESSES: 'five', PROCESS_DELAY: '1.5' };
        expect(validateAgainstSchema(obj, schema)).toHaveLength(2);
    });

    test('should return errors for an object with values outside allowed range', () => {
        const obj = { NR_WITNESSES: 25, PROCESS_DELAY: 1.5 };
        expect(validateAgainstSchema(obj, schema)).toHaveLength(1);
    });

    test('should not return errors for extra fields not in the schema', () => {
        const obj = { NR_WITNESSES: 5, PROCESS_DELAY: 1.5, EXTRA_FIELD: 'extra' };
        expect(validateAgainstSchema(obj, schema)).toEqual([]);
    });

    test('should return an empty array if the schema is null', () => {
        const obj = { NR_WITNESSES: 5, PROCESS_DELAY: 1.5 };
        expect(validateAgainstSchema(obj, null)).toEqual([]);
    });
});
