import { describe, expect, test } from '@jest/globals';
import { computeDifferences } from '../../src/utils/helper.functions.js';

describe('computeDifferences function', () => {
    test('should return null for identical objects', () => {
        const original = { key1: 'value1', key2: 'value2' };
        const modified = { key1: 'value1', key2: 'value2' };
        expect(computeDifferences(original, modified)).toBeNull();
    });

    test('should return differences for simple differences', () => {
        const original = { key1: 'value1', key2: 'value2' };
        const modified = { key1: 'changed', key2: 'value2' };
        expect(computeDifferences(original, modified)).toEqual({ key1: 'changed' });
    });

    test('should return differences for complex (nested) differences', () => {
        const original = { key1: { subKey: 'value' }, key2: 'value2' };
        const modified = { key1: { subKey: 'changed' }, key2: 'value2' };
        expect(computeDifferences(original, modified)).toEqual({ key1: { subKey: 'changed' } });
    });

    test('should detect additions in modified object', () => {
        const original = { key1: 'value1' };
        const modified = { key1: 'value1', key2: 'new' };
        expect(computeDifferences(original, modified)).toEqual({ key2: 'new' });
    });

    test('should not consider deletions as differences', () => {
        const original = { key1: 'value1', key2: 'value2' };
        const modified = { key1: 'value1' };
        expect(computeDifferences(original, modified)).toBeNull();
    });

    test('should handle null or undefined values correctly', () => {
        const original = { key1: null, key2: undefined };
        const modified = { key1: 'new', key2: 'new' };
        expect(computeDifferences(original, modified)).toEqual({ key1: 'new', key2: 'new' });
    });

    test('should return differences for simple array differences', () => {
        const original = { key: ['a', 'b', 'c'] };
        const modified = { key: ['a', 'b', 'd'] };
        expect(computeDifferences(original, modified)).toEqual({ key: ['a', 'b', 'd'] });
    });

    test('should return null for identical arrays', () => {
        const original = { key: ['a', 'b', 'c'] };
        const modified = { key: ['a', 'b', 'c'] };
        expect(computeDifferences(original, modified)).toBeNull();
    });

    test('should return differences for arrays of objects', () => {
        const original = {
            key: [
                { id: 1, name: 'Item1' },
                { id: 2, name: 'Item2' },
            ],
        };
        const modified = {
            key: [
                { id: 1, name: 'Item1' },
                { id: 2, name: 'ChangedItem2' },
            ],
        };
        expect(computeDifferences(original, modified)).toEqual({
            key: [
                { id: 1, name: 'Item1' },
                { id: 2, name: 'ChangedItem2' },
            ],
        });
    });

    test('should return null for identical arrays of objects', () => {
        const original = {
            key: [
                { id: 1, name: 'Item1' },
                { id: 2, name: 'Item2' },
            ],
        };
        const modified = {
            key: [
                { id: 1, name: 'Item1' },
                { id: 2, name: 'Item2' },
            ],
        };
        expect(computeDifferences(original, modified)).toBeNull();
    });

    test('should handle arrays with different lengths', () => {
        const original = { key: ['a', 'b'] };
        const modified = { key: ['a', 'b', 'c', 'd'] };
        expect(computeDifferences(original, modified)).toEqual({ key: ['a', 'b', 'c', 'd'] });
    });
});
