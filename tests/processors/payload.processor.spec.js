import { payloadProcessor } from '../../src/threads/payload.processor.js';
import { describe, test, expect } from '@jest/globals';

describe('payloadProcessor', () => {
    test('it processes data with PLUGIN_META and PIPELINE_META correctly', () => {
        const data = {
            _P_1: 'Plugin 1',
            _P_2: 'Plugin 2',
            _C_1: 'Pipeline 1',
            _C_2: 'Pipeline 2',
            otherKey: 'value',
        };

        const result = payloadProcessor(data);

        expect(result.PLUGIN_META).toEqual({
            _P_1: 'Plugin 1',
            _P_2: 'Plugin 2',
        });

        expect(result.PIPELINE_META).toEqual({
            _C_1: 'Pipeline 1',
            _C_2: 'Pipeline 2',
        });

        expect(result.otherKey).toBe('value');
    });

    test('it handles empty data correctly', () => {
        const data = {};
        const result = payloadProcessor(data);

        expect(result.PLUGIN_META).toEqual({});
        expect(result.PIPELINE_META).toEqual({});

        expect(result).toEqual({
            PIPELINE_META: {},
            PLUGIN_META: {},
        });
    });
});
