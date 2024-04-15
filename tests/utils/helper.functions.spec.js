import { describe, expect, test, jest } from '@jest/globals';
import {
    decode,
    encode,
    camelToZxAIFormat,
    convertKeysToZxAIFormat,
    zxAIFormatToCamel,
    convertKeysToCamelFormat,
    base64ToUrlSafeBase64,
    urlSafeBase64ToBase64,
    pick,
    sleep,
    hasFleetFilter,
} from '../../src/utils/helper.functions.js';
import { ALL_EDGE_NODES, ZxAI_CLIENT_CONNECTED } from '../../src/constants.js';

const pseudopy = `img = plugin.dataapi_image()
if img is not None:
  plugin.int_cache['trimise'] += 1
  plugin.set_default_image(img)
  if plugin.int_cache['trimise'] > plugin.cfg_max_snapshots:
    plugin.cmdapi_archive_pipeline()
    _result = plugin.int_cache
_result = None`;

const encoded =
    'eJx9j0EKwjAQRfc9xexqEQS3Qj2CFxAZhmSaDjRp6EzF45uAbXeu3+f9/yUG6CFPa5B08WREWVAiBT51jQwghYtCmg0ec+JbA1tYkqEjN/KztUWiKLcvOPdwPSLKhp4HWif7OYuuK7yI/1nuG3VDwEgf1ERZx9m09u96F31dS4sb5c2YJfMkqQ6vIVxYS/Hxbq9qDlQ/fQF/6Voo';

describe('Helper Function Tests', () => {
    describe('PseudoPy Helpers Tests', () => {
        test('encode()', () => {
            return encode(pseudopy).then((result) => {
                expect(result).toBe(encoded);
            });
        });

        test('decode()', () => {
            return decode(encoded).then((result) => {
                expect(result).toBe(pseudopy);
            });
        });
    });

    describe('camelToZxAIFormat() Tests', () => {
        test('converts camelCase to ZXAI_FORMAT', () => {
            const input = 'camelCaseExample';
            const expectedOutput = 'CAMEL_CASE_EXAMPLE';
            expect(camelToZxAIFormat(input)).toBe(expectedOutput);
        });

        test('handles single-letter words', () => {
            const input = 'a';
            const expectedOutput = 'A';
            expect(camelToZxAIFormat(input)).toBe(expectedOutput);
        });

        test('handles input with consecutive capital letters', () => {
            const input = 'zxAI';
            const expectedOutput = 'ZX_AI';
            expect(camelToZxAIFormat(input)).toBe(expectedOutput);
        });

        test('handles input with consecutive small letters', () => {
            const input = 'DecentrAI';
            const expectedOutput = 'DECENTR_AI';
            expect(camelToZxAIFormat(input)).toBe(expectedOutput);
        });

        test('handles input with numbers', () => {
            const input = 'zeroxai1point0';
            const expectedOutput = 'ZEROXAI1POINT0';
            expect(camelToZxAIFormat(input)).toBe(expectedOutput);
        });
    });

    describe('convertKeysToZxAIFormat() Tests', () => {
        test('converts keys in an object to AI_XP_FORMAT key names', () => {
            const input = {
                camelCaseKey: 'value1',
                anotherKey: 'value2',
            };

            const expectedOutput = {
                CAMEL_CASE_KEY: 'value1',
                ANOTHER_KEY: 'value2',
            };

            expect(convertKeysToZxAIFormat(input)).toEqual(expectedOutput);
        });

        test('handles empty object', () => {
            const input = {};
            const expectedOutput = {};
            expect(convertKeysToZxAIFormat(input)).toEqual(expectedOutput);
        });

        test('preserves values in the object', () => {
            const input = {
                camelCaseKey: 'value1',
                anotherKey: 'value2',
            };

            const expectedOutput = {
                CAMEL_CASE_KEY: 'value1',
                ANOTHER_KEY: 'value2',
            };

            expect(convertKeysToZxAIFormat(input)).toEqual(expectedOutput);
        });
    });

    describe('zxAIFormatToCamel() Tests', () => {
        test('converts ZX_AI_FORMAT to camelCase', () => {
            const input = 'CAMEL_CASE_EXAMPLE';
            const expectedOutput = 'camelCaseExample';
            expect(zxAIFormatToCamel(input)).toBe(expectedOutput);
        });

        test('handles single-letter words', () => {
            const input = 'A';
            const expectedOutput = 'a';
            expect(zxAIFormatToCamel(input)).toBe(expectedOutput);
        });

        test('handles input with consecutive capital letters', () => {
            const input = 'ZXAI_FORMAT';
            const expectedOutput = 'zxaiFormat';
            expect(zxAIFormatToCamel(input)).toBe(expectedOutput);
        });

        test('handles input with numbers', () => {
            const input = 'VERSION2POINT0';
            const expectedOutput = 'version2point0';
            expect(zxAIFormatToCamel(input)).toBe(expectedOutput);
        });

        test('handles input with dashes', () => {
            const input = 'DASHED-EXAMPLE';
            const expectedOutput = 'dashedExample';
            expect(zxAIFormatToCamel(input)).toBe(expectedOutput);
        });

        test('handles input with underscores', () => {
            const input = 'UNDERSCORED_EXAMPLE';
            const expectedOutput = 'underscoredExample';
            expect(zxAIFormatToCamel(input)).toBe(expectedOutput);
        });
    });

    describe('convertKeysToCamelFormat() Tests', () => {
        test('converts keys in a flat object to camelCase', () => {
            const input = {
                CAMEL_CASE_KEY: 'value1',
                ANOTHER_KEY: 'value2',
            };

            const expectedOutput = {
                camelCaseKey: 'value1',
                anotherKey: 'value2',
            };

            expect(convertKeysToCamelFormat(input)).toEqual(expectedOutput);
        });

        test('handles empty object', () => {
            const input = {};
            const expectedOutput = {};
            expect(convertKeysToCamelFormat(input)).toEqual(expectedOutput);
        });

        test('preserves values in the object', () => {
            const input = {
                CAMEL_CASE_KEY: 'value1',
                ANOTHER_KEY: 'value2',
            };

            const expectedOutput = {
                camelCaseKey: 'value1',
                anotherKey: 'value2',
            };

            expect(convertKeysToCamelFormat(input)).toEqual(expectedOutput);
        });
    });

    describe('urlSafeBase64ToBase64() Tests', () => {
        test('converts URL-safe base64 to regular base64', () => {
            const urlSafeBase64 = 'a-b_cd=';
            const expectedBase64 = 'a+b/cd=';
            expect(urlSafeBase64ToBase64(urlSafeBase64)).toBe(expectedBase64);
        });

        test('handles empty string', () => {
            const urlSafeBase64 = '';
            const expectedBase64 = '';
            expect(urlSafeBase64ToBase64(urlSafeBase64)).toBe(expectedBase64);
        });
    });

    describe('base64ToUrlSafeBase64() Tests', () => {
        test('converts regular base64 to URL-safe base64', () => {
            const base64 = 'a+b/cd=';
            const expectedUrlSafeBase64 = 'a-b_cd=';
            expect(base64ToUrlSafeBase64(base64)).toBe(expectedUrlSafeBase64);
        });

        test('handles empty string', () => {
            const base64 = '';
            const expectedUrlSafeBase64 = '';
            expect(base64ToUrlSafeBase64(base64)).toBe(expectedUrlSafeBase64);
        });
    });

    describe('pick() Tests', () => {
        const data = {
            students: [
                { name: 'Radu', age: 37 },
                { name: 'Andra', age: 36 },
                { name: 'Filip', age: 6 },
                { name: 'Alexandru', age: 4 },
            ],
            class: {
                name: 'DecentrAI',
                teacher: {
                    name: 'Radu',
                    age: 37,
                },
            },
        };

        test('should return the correct value for a valid path', () => {
            expect(pick('students.1.name', data)).toBe('Andra');
            expect(pick('class.teacher.age', data)).toBe(37);
        });

        test('should return undefined for an invalid path', () => {
            expect(pick('students.2004.name', data)).toBeUndefined();
            expect(pick('class.students.2004.name', data)).toBeUndefined();
            expect(pick('invalidPath', data)).toBeUndefined();
        });

        test('should return the entire object for an empty path', () => {
            expect(pick('', data)).toEqual(data);
        });

        test('should handle null or undefined input object', () => {
            expect(pick('students.1.name', null)).toBeUndefined();
            expect(pick('class.teacher.age', undefined)).toBeUndefined();
        });

        test('should handle non-object input object', () => {
            expect(pick('students.1.name', 'invalidInput')).toBeUndefined();
            expect(pick('class.teacher.age', 123)).toBeUndefined();
        });
    });

    describe('sleep() Tests', () => {
        jest.setTimeout(5000);

        test('should resolve after the specified timeout', async () => {
            const start = Date.now();
            const timeout = 1000;

            await sleep(timeout);

            const end = Date.now();
            const elapsed = end - start;

            expect(elapsed).toBeGreaterThanOrEqual(timeout);
        });

        test('should resolve immediately for zero timeout', async () => {
            const start = Date.now();

            await sleep(0);

            const end = Date.now();
            const elapsed = end - start;

            expect(elapsed).toBeLessThan(10);
        });
    });

    describe('hasFleetFilter function', () => {
        test('should return true for a valid fleet definition', () => {
            const fleet = ['node1', 'node2', 'node3'];
            expect(hasFleetFilter(fleet)).toEqual(true);
        });

        test('should return true for a valid fleet definition with only one node', () => {
            const fleet = ['node1'];
            expect(hasFleetFilter(fleet)).toEqual(true);
        });

        test('should return false for fleet definition equal to ALL_EDGE_NODES', () => {
            const fleet = [ALL_EDGE_NODES];
            expect(hasFleetFilter(fleet)).toEqual(false);
        });

        test('should return true for an empty fleet definition', () => {
            const fleet = [];
            expect(hasFleetFilter(fleet)).toEqual(true);
        });
    });
});
