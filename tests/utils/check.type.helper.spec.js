import { describe, expect, test } from '@jest/globals';
import { checkType } from '../../src/utils/helper.functions.js';

describe('checkType helper function tests', () => {
    describe('Testing Basic Type Validation', () => {
        test('should return true for integer when type is integer', () => {
            expect(checkType(10, 'integer')).toBe(true);
        });

        test('should return false for non-integer when type is integer', () => {
            expect(checkType('10', 'integer')).toBe(false);
        });

        test('should return true for float when type is float', () => {
            expect(checkType(10.5, 'float')).toBe(true);
        });

        test('should return true for float when value is without decimals', () => {
            expect(checkType(10, 'float')).toBe(true);
        });

        test('should return false for non-float when type is float', () => {
            expect(checkType('10.5', 'float')).toBe(false);
        });

        test('should return true for boolean when type is boolean', () => {
            expect(checkType(true, 'boolean')).toBe(true);
        });

        test('should return false for non-boolean when type is boolean', () => {
            expect(checkType('true', 'boolean')).toBe(false);
        });

        test('should return true for string when type is string', () => {
            expect(checkType('hello', 'string')).toBe(true);
        });

        test('should return false for non-string when type is string', () => {
            expect(checkType(123, 'string')).toBe(false);
        });
    });

    describe('String with Allowed Values', () => {
        const allowedValues = ['apple', 'banana', 'orange'];

        test('should return true for a string within allowed values', () => {
            expect(checkType('apple', 'string', allowedValues)).toBe(true);
        });

        test('should return false for a string not in allowed values', () => {
            expect(checkType('grape', 'string', allowedValues)).toBe(false);
        });

        test('should return true for a string when allowed values are not specified', () => {
            expect(checkType('anystring', 'string')).toBe(true);
        });
    });

    describe('checkType function - Numbers with Allowed Values', () => {
        const allowedValuesRange = { min: 5, max: 10 };

        test('should return true for an integer within the allowed range', () => {
            expect(checkType(7, 'integer', allowedValuesRange)).toBe(true);
        });

        test('should return false for an integer below the allowed minimum', () => {
            expect(checkType(4, 'integer', allowedValuesRange)).toBe(false);
        });

        test('should return false for an integer above the allowed maximum', () => {
            expect(checkType(11, 'integer', allowedValuesRange)).toBe(false);
        });

        test('should return true for a float within the allowed range', () => {
            expect(checkType(7.5, 'float', allowedValuesRange)).toBe(true);
        });

        test('should return false for a float below the allowed minimum', () => {
            expect(checkType(4.99, 'float', allowedValuesRange)).toBe(false);
        });

        test('should return false for a float above the allowed maximum', () => {
            expect(checkType(10.01, 'float', allowedValuesRange)).toBe(false);
        });
    });

    describe('checkType function - Array Types', () => {
        test('should return true for an array of integers when type is array(integer)', () => {
            expect(checkType([1, 2, 3], 'array(integer)')).toBe(true);
        });

        test('should return false for an array with non-integers when type is array(integer)', () => {
            expect(checkType([1, '2', 3], 'array(integer)')).toBe(false);
        });

        test('should return true for an array of floats when type is array(float)', () => {
            expect(checkType([1, 2.3, 3.1], 'array(float)')).toBe(true);
        });

        test('should return false for an array with non-floats when type is array(float)', () => {
            expect(checkType([1, '2.3', 3.1], 'array(float)')).toBe(false);
        });

        test('should return true for an array of strings when type is array(string)', () => {
            expect(checkType(['apple', 'banana', 'cherry'], 'array(string)')).toBe(true);
        });

        test('should return false for an array with non-strings when type is array(string)', () => {
            expect(checkType(['apple', 123, 'cherry'], 'array(string)')).toBe(false);
        });

        test('should return true for an array of booleans when type is array(boolean)', () => {
            expect(checkType([true, false, true], 'array(boolean)')).toBe(true);
        });

        test('should return false for an array with non-booleans when type is array(boolean)', () => {
            expect(checkType([true, 'false', true], 'array(boolean)')).toBe(false);
        });
    });

    describe('checkType function - Array Types with Allowed Values', () => {
        const allowedStringValues = ['apple', 'banana', 'orange'];

        test('should return true for an array of strings within allowed values', () => {
            expect(checkType(['apple', 'banana'], 'array(string)', allowedStringValues)).toBe(true);
        });

        test('should return false for an array of strings with at least one value not in allowed values', () => {
            expect(checkType(['apple', 'grape'], 'array(string)', allowedStringValues)).toBe(false);
        });

        const allowedNumericValues = { min: 1, max: 5 };

        test('should return true for an array of integers within allowed range', () => {
            expect(checkType([1, 2, 3], 'array(integer)', allowedNumericValues)).toBe(true);
        });

        test('should return false for an array of integers with at least one value outside (below) allowed range', () => {
            expect(checkType([0, 2, 3], 'array(integer)', allowedNumericValues)).toBe(false);
        });

        test('should return false for an array of integers with at least one value outside (above) allowed range', () => {
            expect(checkType([7, 2, 3], 'array(integer)', allowedNumericValues)).toBe(false);
        });

        test('should return true for an array of floats within allowed range', () => {
            expect(checkType([1, 2.6, 3.1], 'array(float)', allowedNumericValues)).toBe(true);
        });

        test('should return false for an array of floats with at least one value outside (below) allowed range', () => {
            expect(checkType([0.5, 2, 3.2], 'array(float)', allowedNumericValues)).toBe(false);
        });

        test('should return false for an array of floats with at least one value outside (above) allowed range', () => {
            expect(checkType([7.4, 2, 3.2], 'array(float)', allowedNumericValues)).toBe(false);
        });
    });

    describe('checkType function - Arrays of Arrays', () => {
        test('should return true for an array of arrays of strings', () => {
            expect(
                checkType(
                    [
                        ['apple', 'banana'],
                        ['cherry', 'date'],
                    ],
                    'array(array(string))',
                ),
            ).toBe(true);
        });

        test('should return false for an array of arrays where at least one inner array contains a non-string', () => {
            expect(
                checkType(
                    [
                        ['apple', 'banana'],
                        ['cherry', 123],
                    ],
                    'array(array(string))',
                ),
            ).toBe(false);
        });

        const allowedStringValues = ['apple', 'banana', 'cherry'];

        test('should return true for an array of arrays of strings within allowed values', () => {
            expect(
                checkType(
                    [
                        ['apple', 'banana'],
                        ['cherry', 'banana'],
                    ],
                    'array(array(string))',
                    allowedStringValues,
                ),
            ).toBe(true);
        });

        test('should return false for an array of arrays of strings with at least one value not in allowed values', () => {
            expect(
                checkType(
                    [
                        ['apple', 'grape'],
                        ['cherry', 'banana'],
                    ],
                    'array(array(string))',
                    allowedStringValues,
                ),
            ).toBe(false);
        });
    });

    describe('checkType function - Invalid Types', () => {
        test('should return false for an unrecognized type', () => {
            expect(checkType('a random value', 'unrecognizedType')).toBe(false);
        });

        test('should return false for an array with an unrecognized type', () => {
            expect(checkType(['value1', 'value2'], 'array(unrecognizedType)')).toBe(false);
        });

        test('should return false for a malformed array type string', () => {
            expect(checkType([1, 2, 3], 'array(')).toBe(false);
        });

        test('should return false for null type', () => {
            expect(checkType('value', null)).toBe(false);
        });

        test('should return false for undefined type', () => {
            expect(checkType('value', undefined)).toBe(false);
        });
    });

    describe('checkType function - Non-Array Objects', () => {
        const sampleObject = { key: 'value' };

        test('should return false for a non-array object when type is integer', () => {
            expect(checkType(sampleObject, 'integer')).toBe(false);
        });

        test('should return false for a non-array object when type is float', () => {
            expect(checkType(sampleObject, 'float')).toBe(false);
        });

        test('should return false for a non-array object when type is boolean', () => {
            expect(checkType(sampleObject, 'boolean')).toBe(false);
        });

        test('should return false for a non-array object when type is string', () => {
            expect(checkType(sampleObject, 'string')).toBe(false);
        });

        test('should return false for a non-array object when type is array(string)', () => {
            expect(checkType(sampleObject, 'array(string)')).toBe(false);
        });
    });
});
