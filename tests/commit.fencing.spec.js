import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { NodeManager } from '../src/node.manager.js';
import { StalePipelineViewError } from '../src/models/errors.js';
import { InternalStateManager } from '../src/models/internal.state.manager.js';
import { State } from '../src/models/state.js';
import {
    DCT_TYPE_VIDEO_STREAM,
    INTERNAL_STATE_MANAGER,
    NODE_COMMAND_UPDATE_CONFIG,
    PIPELINE_COMMIT_APPLY_GRACE_MS,
} from '../src/index.js';
import { defaultSchemas } from '../src/utils/schema.providers.js';

/**
 * Pipeline commit fence tests.
 *
 * Contract pinned here (see NodeManager.commit()):
 * - full-config commits from heartbeat-derived views are refused when the view
 *   basis does not clear (last mutation marker + apply grace) — BEFORE any
 *   publish, including batch deltas, is initiated;
 * - locally authored pipelines bypass the staleness check but still mark;
 * - every mutated pipeline (full config, batch delta, archive) advances the
 *   fence marker;
 * - a manager that refused a stale commit is poisoned (must be rebuilt);
 * - a successful full commit promotes the pipeline to authored so sequential
 *   commits on the same manager do not self-fence;
 * - the fence engages through the REAL `State` facade (the production wiring),
 *   not only through raw state managers;
 * - legacy state managers keep the previous unfenced behavior.
 */
describe('Pipeline commit fence', () => {
    // 0xai_ prefix so State.getAddress() treats it as an address (identity).
    const node = '0xai_fence_node';
    const HEARTBEAT_TS = 500_000;
    const NEWER_MARKER_TS = 900_000;
    const SERVER_NOW_MS = 1_000_000;
    const LOCK_TOKEN = 'lock-token-1';

    const VIEW_SCENE_SIGNATURE = 'VIEW_SCENE_01';
    const pluginSchemas = {
        [`${VIEW_SCENE_SIGNATURE}`]: {
            name: 'View Scene',
            type: VIEW_SCENE_SIGNATURE,
            fields: [
                {
                    key: 'NR_WITNESSES',
                    type: 'integer',
                    label: 'Witness Count',
                    description: 'quota',
                    default: 5,
                    required: true,
                    allowedValues: { min: 1, max: 20 },
                },
            ],
            options: { linkable: false },
            dct: { fps: 5 },
        },
    };

    const makeNodeInfo = () => ({
        lastUpdate: HEARTBEAT_TS,
        nodeTime: { date: null, utc: null },
        data: {
            pipelines: {
                existing: {
                    config: {
                        INITIATOR_ID: 'unit-tests',
                        NAME: 'existing',
                        TYPE: DCT_TYPE_VIDEO_STREAM,
                        CAP_RESOLUTION: 24,
                        URL: 'http://example.test',
                    },
                    stats: null,
                    plugins: [],
                },
            },
        },
    });

    let mockClient;
    let fenceState;

    const makeFenceState = (overrides = {}) => ({
        getNodeForAddress: () => 'fence-node-name',
        getNodeInfo: jest.fn(async () => makeNodeInfo()),
        // Consulted by the batch (delta) compilation route.
        getRunningInstanceConfig: jest.fn(async () => ({ NR_WITNESSES: 15 })),
        acquireNodeCommitLock: jest.fn(async () => LOCK_TOKEN),
        releaseNodeCommitLock: jest.fn(async () => undefined),
        getPipelineCommitMarker: jest.fn(async () => null),
        setPipelineCommitMarker: jest.fn(async () => true),
        getServerTimeMs: jest.fn(async () => SERVER_NOW_MS),
        ...overrides,
    });

    const makeManager = (state) => {
        const schemas = defaultSchemas();
        schemas.plugins = pluginSchemas;
        mockClient = {
            state,
            schemas,
            bootOptions: { initiator: 'unit-tests' },
            publish: jest.fn(async () => []),
        };

        return NodeManager.getNodeManager(mockClient, node, { log: jest.fn(), error: jest.fn(), warn: jest.fn() });
    };

    beforeEach(() => {
        fenceState = makeFenceState();
    });

    test('hydrated pipelines carry the heartbeat view basis', async () => {
        const manager = makeManager(fenceState);
        const pipelines = await manager.getPipelines();

        expect(pipelines).toHaveLength(1);
        expect(pipelines[0]._viewBasisTs).toBe(HEARTBEAT_TS);
        expect(pipelines[0]._locallyAuthored).toBe(false);
    });

    test('marker-free commit publishes, marks, and releases the owner token', async () => {
        const manager = makeManager(fenceState);
        const pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;

        await manager.commit();

        expect(mockClient.publish).toHaveBeenCalledTimes(1);
        expect(mockClient.publish.mock.calls[0][1].ACTION).toBe(NODE_COMMAND_UPDATE_CONFIG);
        expect(fenceState.setPipelineCommitMarker).toHaveBeenCalledWith(node, 'existing', SERVER_NOW_MS);
        expect(fenceState.releaseNodeCommitLock).toHaveBeenCalledWith(node, LOCK_TOKEN);
        // Successful full commit records the own-marker (NOT persistent
        // authorship — that would be an unbounded fence bypass).
        expect(pipeline._ownMarkerTs).toBe(SERVER_NOW_MS);
        expect(pipeline._locallyAuthored).toBe(false);
    });

    test('sequential commits on the same manager do not self-fence (own-marker rule)', async () => {
        const manager = makeManager(fenceState);
        const pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;

        await manager.commit();

        // Second commit: the shared marker equals the marker THIS manager
        // wrote — its view provably contains its own mutation → passes.
        fenceState.getPipelineCommitMarker.mockResolvedValue(SERVER_NOW_MS);
        pipeline.isDirty = true;

        await expect(manager.commit()).resolves.toBeDefined();
        expect(mockClient.publish).toHaveBeenCalledTimes(2);
    });

    test('a FOREIGN marker advance between commits on the same manager is refused', async () => {
        const manager = makeManager(fenceState);
        const pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;

        await manager.commit();

        // Another replica committed since (marker ≠ our own marker): this
        // manager's cached view cannot contain that change — publishing it
        // would silently revert the foreign commit. Must refuse.
        fenceState.getPipelineCommitMarker.mockResolvedValue(SERVER_NOW_MS + 5_000);
        pipeline.isDirty = true;

        await expect(manager.commit()).rejects.toThrow(StalePipelineViewError);
        expect(mockClient.publish).toHaveBeenCalledTimes(1);
    });

    test('stale view is refused before ANY publish — including pending batch deltas', async () => {
        fenceState = makeFenceState({
            getPipelineCommitMarker: jest.fn(async () => NEWER_MARKER_TS),
        });
        const manager = makeManager(fenceState);
        const pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;

        await expect(manager.commit()).rejects.toThrow(StalePipelineViewError);
        expect(mockClient.publish).not.toHaveBeenCalled();
        expect(fenceState.setPipelineCommitMarker).not.toHaveBeenCalled();
        expect(fenceState.releaseNodeCommitLock).toHaveBeenCalledWith(node, LOCK_TOKEN);
    });

    test('a refused manager is poisoned: retrying commit() demands a rebuild', async () => {
        fenceState = makeFenceState({
            getPipelineCommitMarker: jest.fn(async () => NEWER_MARKER_TS),
        });
        const manager = makeManager(fenceState);
        const pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;

        await expect(manager.commit()).rejects.toThrow(StalePipelineViewError);
        // Even if the marker later expires (fail-open), the poisoned manager
        // must refuse to retry its stale view.
        fenceState.getPipelineCommitMarker.mockResolvedValue(null);
        await expect(manager.commit()).rejects.toThrow(/build a fresh manager/);
        expect(mockClient.publish).not.toHaveBeenCalled();
    });

    test('grace boundary: marker exactly (basis - grace) passes, one ms later is refused', async () => {
        // Refusal condition: basis < marker + GRACE.
        const passMarker = HEARTBEAT_TS - PIPELINE_COMMIT_APPLY_GRACE_MS; // basis == marker + GRACE → passes
        const failMarker = passMarker + 1; // basis < marker + GRACE → refused

        fenceState = makeFenceState({ getPipelineCommitMarker: jest.fn(async () => passMarker) });
        let manager = makeManager(fenceState);
        let pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;
        await expect(manager.commit()).resolves.toBeDefined();

        fenceState = makeFenceState({ getPipelineCommitMarker: jest.fn(async () => failMarker) });
        manager = makeManager(fenceState);
        pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;
        await expect(manager.commit()).rejects.toThrow(StalePipelineViewError);
    });

    test('locally authored pipelines bypass the staleness check but still mark', async () => {
        fenceState = makeFenceState({
            getPipelineCommitMarker: jest.fn(async () => NEWER_MARKER_TS),
        });
        const manager = makeManager(fenceState);

        await manager.createPipeline(
            { type: DCT_TYPE_VIDEO_STREAM, config: { CAP_RESOLUTION: 24, URL: 'http://example.test' } },
            'freshly-authored',
        );
        await manager.commit();

        const published = mockClient.publish.mock.calls.filter(
            (call) => call[1].ACTION === NODE_COMMAND_UPDATE_CONFIG && call[1].PAYLOAD.NAME === 'freshly-authored',
        );
        expect(published).toHaveLength(1);
        expect(fenceState.setPipelineCommitMarker).toHaveBeenCalledWith(node, 'freshly-authored', SERVER_NOW_MS);
    });

    test('batch instance deltas advance the fence marker without a staleness check', async () => {
        fenceState = makeFenceState({
            // A newer marker must NOT refuse a pure delta commit...
            getPipelineCommitMarker: jest.fn(async () => NEWER_MARKER_TS),
        });
        const manager = makeManager(fenceState);
        const pipeline = await manager.getPipeline('existing');

        const instance = manager.createPluginInstance(
            VIEW_SCENE_SIGNATURE,
            { NR_WITNESSES: 5, INSTANCE_ID: 'inst-1' },
            'inst-1',
        );
        NodeManager.attachPluginInstanceToPipeline(pipeline, instance);
        // Force the delta (batch) route: pipeline itself is clean, only the
        // instance is dirty.
        pipeline.isDirty = false;
        pipeline.getDataCaptureThread().isDirty = false;
        instance.isDirty = true;

        await manager.commit();

        expect(mockClient.publish).toHaveBeenCalledTimes(1);
        expect(mockClient.publish.mock.calls[0][1].ACTION).not.toBe(NODE_COMMAND_UPDATE_CONFIG);
        // ...but the mutation still advances the marker.
        expect(fenceState.setPipelineCommitMarker).toHaveBeenCalledWith(node, 'existing', SERVER_NOW_MS);
    });

    test('a batch delta followed by a full commit on the same manager does not self-fence', async () => {
        const manager = makeManager(fenceState);
        const pipeline = await manager.getPipeline('existing');

        // Commit 1: pure delta route (pipeline clean, instance dirty).
        const instance = manager.createPluginInstance(
            VIEW_SCENE_SIGNATURE,
            { NR_WITNESSES: 5, INSTANCE_ID: 'inst-1' },
            'inst-1',
        );
        NodeManager.attachPluginInstanceToPipeline(pipeline, instance);
        pipeline.isDirty = false;
        pipeline.getDataCaptureThread().isDirty = false;
        instance.isDirty = true;
        await manager.commit();
        expect(pipeline._ownMarkerTs).toBe(SERVER_NOW_MS);

        // Commit 2: full-config route. The shared marker was advanced by OUR
        // batch commit — the own-marker rule must let this pass.
        fenceState.getPipelineCommitMarker.mockResolvedValue(SERVER_NOW_MS);
        pipeline.isDirty = true;
        await expect(manager.commit()).resolves.toBeDefined();
        expect(mockClient.publish).toHaveBeenCalledTimes(2);
    });

    test('the State facade over a custom manager WITHOUT fence APIs falls back to legacy behavior', async () => {
        const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
        // Custom manager: heartbeat reads only, no fence methods at all.
        const customManager = {
            getNodeInfo: jest.fn(async () => makeNodeInfo()),
            on: jest.fn(),
        };
        const state = new State('custom', customManager, { fleet: [] }, logger);

        const schemas = defaultSchemas();
        schemas.plugins = pluginSchemas;
        const client = { state, schemas, bootOptions: { initiator: 'unit-tests' }, publish: jest.fn(async () => []) };

        const manager = NodeManager.getNodeManager(client, node, logger);
        const pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;

        // Must take the documented unfenced fallback — not crash on a missing
        // acquireNodeCommitLock somewhere mid-commit.
        await expect(manager.commit()).resolves.toBeDefined();
        expect(client.publish).toHaveBeenCalledTimes(1);
    });

    test('lock refusal aborts the commit without publishing', async () => {
        fenceState = makeFenceState({
            acquireNodeCommitLock: jest.fn(async () => null),
        });
        const manager = makeManager(fenceState);
        const pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;

        await expect(manager.commit()).rejects.toThrow(/commit fence lock/);
        expect(mockClient.publish).not.toHaveBeenCalled();
    });

    test('legacy state managers without fence support keep unfenced behavior', async () => {
        const legacyState = {
            getNodeForAddress: () => 'fence-node-name',
            getNodeInfo: jest.fn(async () => makeNodeInfo()),
        };
        const manager = makeManager(legacyState);
        const pipeline = await manager.getPipeline('existing');
        pipeline.isDirty = true;

        await manager.commit();

        expect(mockClient.publish).toHaveBeenCalledTimes(1);
    });

    describe('through the REAL State facade (production wiring)', () => {
        const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

        const makeFacadeClient = () => {
            const internalManager = new InternalStateManager(logger);
            const state = new State(INTERNAL_STATE_MANAGER, internalManager, { fleet: [] }, logger);
            // Seed the heartbeat cache directly (same shape nodeInfoUpdate writes).
            internalManager.state.hb[node] = makeNodeInfo();

            const schemas = defaultSchemas();
            schemas.plugins = pluginSchemas;

            return {
                state,
                schemas,
                bootOptions: { initiator: 'unit-tests' },
                publish: jest.fn(async () => []),
            };
        };

        test('the fence ENGAGES through client.state (regression: facade pass-throughs)', async () => {
            const client = makeFacadeClient();

            // Writer 1: commits through the facade → marker written in the manager.
            const managerA = NodeManager.getNodeManager(client, node, logger);
            const pipelineA = await managerA.getPipeline('existing');
            pipelineA.isDirty = true;
            await managerA.commit();
            expect(client.publish).toHaveBeenCalledTimes(1);
            await expect(client.state.getPipelineCommitMarker(node, 'existing')).resolves.toEqual(expect.any(Number));

            // Writer 2: a fresh manager hydrates the SAME (now stale) heartbeat
            // and must be refused — the end-to-end S1 interleaving.
            const managerB = NodeManager.getNodeManager(client, node, logger);
            const pipelineB = await managerB.getPipeline('existing');
            pipelineB.isDirty = true;
            await expect(managerB.commit()).rejects.toThrow(StalePipelineViewError);
            expect(client.publish).toHaveBeenCalledTimes(1);
        });
    });

    describe('InternalStateManager fence parity', () => {
        let state;

        beforeEach(() => {
            state = new InternalStateManager({ log: jest.fn(), error: jest.fn(), warn: jest.fn() });
        });

        test('set/get marker round-trip', async () => {
            await state.setPipelineCommitMarker(node, 'p1', 1234);
            await expect(state.getPipelineCommitMarker(node, 'p1')).resolves.toBe(1234);
            await expect(state.getPipelineCommitMarker(node, 'other')).resolves.toBeNull();
        });

        test('expired markers behave as absent (fail-open)', async () => {
            await state.setPipelineCommitMarker(node, 'p1', 1234);
            state.commitFence.markers[`${node}:p1`].expiresAt = new Date().getTime() - 1;

            await expect(state.getPipelineCommitMarker(node, 'p1')).resolves.toBeNull();
        });

        test('lock is owner-token exclusive, expiring, and compare-and-delete on release', async () => {
            const token = await state.acquireNodeCommitLock(node);
            expect(typeof token).toBe('string');
            // Second acquisition exhausts retries against the held lock.
            await expect(state.acquireNodeCommitLock(node)).resolves.toBeNull();
            // A stale holder cannot free a successor's lock.
            await state.releaseNodeCommitLock(node, 'not-the-token');
            await expect(state.acquireNodeCommitLock(node)).resolves.toBeNull();
            // The rightful owner can.
            await state.releaseNodeCommitLock(node, token);
            const token2 = await state.acquireNodeCommitLock(node);
            expect(typeof token2).toBe('string');
            // An expired lock self-heals.
            state.commitFence.locks[node].expiresAt = new Date().getTime() - 1;
            await expect(state.acquireNodeCommitLock(node)).resolves.toEqual(expect.any(String));
        });
    });
});
