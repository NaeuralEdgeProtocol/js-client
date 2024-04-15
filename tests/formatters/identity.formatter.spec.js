import { describe, expect, test } from '@jest/globals';
import { identityFormatter } from '../../src/formatters/identity.formatter.js';

describe('Identity Formatter Tests', () => {
    test('returns the same value that is passed into it', () => {
        const testMessage = 'Test Message';
        const result = identityFormatter(testMessage);
        expect(result).toBe(testMessage);
    });

    test('returns undefined when called without arguments', () => {
        const result = identityFormatter();
        expect(result).toBeUndefined();
    });
});
