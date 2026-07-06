import {encode, generateId} from './utils/helper.functions.js';
import { Pipeline } from './models/pipeline.js';
import {
    ADMIN_PIPELINE_NAME,
    NETMON_DEFAULT_INSTANCE,
    NETMON_SIGNATURE,
    NODE_COMMAND_ARCHIVE_CONFIG,
    NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE,
    NODE_COMMAND_UPDATE_CONFIG,
    NODE_COMMAND_UPDATE_PIPELINE_INSTANCE, STICKY_COMMAND_ID_KEY,
    PIPELINE_COMMIT_APPLY_GRACE_MS,
} from './constants.js';
import { PluginInstance } from './models/plugin.instance.js';
import { StalePipelineViewError } from './models/errors.js';
import {DCT_TYPE_VOID_STREAM} from './utils/dcts/index.js';
import {CUSTOM_EXEC_01_SIGNATURE} from './utils/plugins/custom.exec.plugin.js';

/**
 * @class NodeManager
 *
 * The manager for all the node operations.
 */
export class NodeManager {
    /**
     * Commit fence poison flag: set when this manager refused a stale commit
     * (`StalePipelineViewError`). A poisoned manager rejects all further
     * commits — its cached view is stale, and a blind retry loop would clobber
     * the concurrent change once the fence marker TTL expires. Callers must
     * rebuild via `getNodeManager()`.
     *
     * @type {boolean}
     * @private
     */
    _fenceRefused = false;

    /**
     * The network client reference.
     *
     * @type {Naeural}
     * @private
     */
    client;

    /**
     * The logger handler to be used for logging messages.
     *
     * @type {Logger}
     * @private
     */
    logger;

    /**
     * The node this manager is attached to.
     *
     * @type {string}
     * @private
     */
    node;

    /**
     * The node name this manager is attached to.
     *
     * @type {string}
     * @private
     */
    nodeName;

    /**
     * The list of open Pipelines on this node.
     *
     * @type {Array<Pipeline>}
     * @private
     */
    pipelines = [];

    /**
     * The list of Pipelines to be closed when commiting the pending changes.
     *
     * @type {Array<string>}
     * @private
     */
    pipelinesMarkedForClosing = [];

    /**
     * The NodeManager constructor.
     *
     * @param {Naeural} client
     * @param {string} node
     * @param {Logger} logger
     * @private
     */
    constructor(client, node, logger) {
        this.client = client;
        this.node = node;
        this.nodeName = client.state.getNodeForAddress(node);
        this.logger = logger;
    }

    /**
     * Returns an instance of a NodeManager for the requested `node`.
     *
     * @param {Naeural} client
     * @param {string} node
     * @param {Logger} logger
     * @return {NodeManager}
     */
    static getNodeManager(client, node, logger) {
        return new NodeManager(client, node, logger);
    }

    /**
     * Static method that pushes a PluginInstance to a Pipeline. If the `nowatch` flag is set to true, this operation
     * will not automatically append a watch on this instance in the next network request. This behavior is needed when
     * attaching instances found on the received heartbeat, inside internal models, or when the watch is to be added
     * manually, for supporting custom deployment mechanisms.
     *
     * @param {Pipeline} pipeline
     * @param {PluginInstance} candidate
     * @param {boolean} nowatch
     */
    static attachPluginInstanceToPipeline(pipeline, candidate, nowatch = false) {
        if (!pipeline.instances) {
            pipeline.instances = [];
        }

        const existingInstance = pipeline.instances.filter((instance) => instance.id === candidate.id).pop() ?? null;
        if (existingInstance) {
            throw new Error(
                `Instance ${candidate.id} is already associated with ${pipeline.id} on ${pipeline.node}. Please update instead of recreating.`,
            );
        }

        candidate.setPipeline(pipeline);
        if (!nowatch) {
            pipeline.addInstanceWatch([pipeline.node, pipeline.id, candidate.signature, candidate.id]);
        }

        pipeline.instances.push(candidate);
        pipeline.isDirty = !nowatch;
    }

    /**
     * Compiles the changeset for a given Pipeline.
     *
     * @param {Pipeline} pipeline
     */
    static compilePipelineUpdateConfig(pipeline) {
        const candidateConfig = { ...pipeline.getDataCaptureThread().config };
        delete candidateConfig['INITIATOR_ID'];

        const instancesBySignature = pipeline.instances.reduce((collection, instance) => {
            if (!collection[instance.signature]) {
                collection[instance.signature] = [];
            }

            collection[instance.signature].push({
                ...instance.compile(),
                INSTANCE_ID: instance.id,
            });

            return collection;
        }, {});

        candidateConfig['PLUGINS'] = Object.keys(instancesBySignature).map((signature) => ({
            INSTANCES: instancesBySignature[signature],
            SIGNATURE: signature,
        }));

        return candidateConfig;
    }

    /**
     * Returns the change set list for all the plugin instances running on this pipeline.
     *
     * @param {Pipeline} pipeline
     * @return {Promise<NaeuralUpdateInstanceConfig[]>}
     */
    static async compilePipelineBatchUpdateInstances(pipeline) {
        const changeSet = [];
        for (const instance of pipeline.instances) {
            if (instance.isDirty) {
                const diff = await instance.makeUpdateInstancePayload();

                if (diff !== null) {
                    changeSet.push(diff);
                }
            }
        }

        return changeSet;
    }

    /**
     *
     * @param code
     * @param instanceName
     * @param pipeline
     * @return {Promise<NodeManager>}
     */
    async prepareCustomCode(code, instanceName, pipeline){
        if (!code || code === '') {
            throw new Error('Invalid custom code snippet.');
        }

        if (!instanceName || instanceName === '') {
            throw new Error('Instance name is mandatory.');
         }

        if (!pipeline) {
            this.logger.log(`No pipeline provided for custom code execution instance "${instanceName}". Creating a new pipeline called "${instanceName}-pip" of type ${DCT_TYPE_VOID_STREAM}`);
            pipeline = await this.createPipeline({type: DCT_TYPE_VOID_STREAM, config: {}}, `${instanceName}-pip`);
        }

        let instance = (await this.getPluginInstances(pipeline)).filter((instance) => instance.signature === CUSTOM_EXEC_01_SIGNATURE && instance.id === instanceName)[0];
        if (!instance) {
            this.logger.warn(`Instance ${instanceName} not found on ${pipeline.id}, deploying a new one.`);
            instance = this.createPluginInstance(
                CUSTOM_EXEC_01_SIGNATURE,
                { CODE: '' },
                instanceName,
            );

            NodeManager.attachPluginInstanceToPipeline(pipeline, instance);
        }

        return this.updateInstance(instance, { CODE: await encode(code) });
    }

    /**
     * Sends a request for the node hardware stats history.
     *
     * @return {Promise<Object>}
     */
    async getHardwareStats(steps = 1, periodH = 1, extra = {}, useSupervisor = false) {
        let command = {
            node: this.nodeName,
            request: 'history',
            options: {
                step: steps,
                time_window_hours: periodH,
            },
        };

        command[STICKY_COMMAND_ID_KEY] = generateId();
        command = Object.assign({}, command, extra);

        const message = {
            PAYLOAD: {
                NAME: ADMIN_PIPELINE_NAME,
                INSTANCE_ID: NETMON_DEFAULT_INSTANCE,
                SIGNATURE: NETMON_SIGNATURE,
                INSTANCE_CONFIG: {
                    INSTANCE_COMMAND: command,
                },
            },
            ACTION: NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
        };

        let node = this.node;
        if (useSupervisor) {
            node = (await this.client.getSupervisors())[0];
        }

        return this.client.publish(node, message);
    }

    /**
     * Sends a request to restart the node.
     *
     * @return {Promise<Object>}
     */
    async restartEdgeNode() {
        const message = {
            ACTION: 'RESTART',
        };

        return this.client.publish(this.node, message);
    }

    /**
     * Sends a request to stop the node.
     *
     * @return {Promise<Object>}
     */
    async shutdownEdgeNode() {
        const message = {
            ACTION: 'STOP',
        };

        return this.client.publish(this.node, message);
    }

    /**
     * Sends a heartbeat request to the node.
     *
     * @return {Promise<Object>}
     */
    async getHeartbeatFromEdgeNode() {
        const message = {
            ACTION: 'TIMERS_ONLY_HEARTBEAT',
        };

        return this.client.publish(this.node, message);
    }

    /**
     * Sends a request for a detailed heartbeat to the node.
     *
     * @return {Promise<Object>}
     */
    async getFullHeartbeatFromEdgeNode() {
        const message = {
            ACTION: 'FULL_HEARTBEAT',
        };

        return this.client.publish(this.node, message);
    }

    /**
     * Creates a pipeline on the managed node.
     *
     * @param {Object} dataSource
     * @param {string|null} name
     * @return {Promise<Pipeline>}
     */
    async createPipeline(dataSource, name = null) {
        const id = name ?? generateId();
        if (!this.client.schemas?.dct[dataSource.type]) {
            throw new Error(
                `Unknown DCT of type "${dataSource.type}". Make sure the schema for "${dataSource.type}" is loaded.`,
            );
        }

        let pipeline = await this.getPipeline(id);
        if (pipeline) {
            throw new Error(`Pipeline with name "${id}" already exists on ${this.nodeName} (${this.node})!`);
        }

        const config = dataSource.config;

        pipeline = Pipeline.make(
            this.client,
            this.node,
            {
                config: {
                    INITIATOR_ID: this.client.bootOptions.initiator,
                    NAME: id,
                    TYPE: dataSource.type,
                    ...config,
                },
                stats: null,
                plugins: [],
            },
            this.client.schemas,
            true,
        );

        // Authored here, not derived from a heartbeat: the commit fence must
        // treat this pipeline's config as authoritative intent (see commit()).
        pipeline._locallyAuthored = true;

        this.pipelines.push(pipeline);

        return pipeline;
    }

    /**
     * Returns the pipeline with id `pipelineId` if it exists on this node.
     *
     * @param {string} pipelineId
     * @return {Promise<Pipeline|null>}
     */
    async getPipeline(pipelineId) {
        if (this.pipelines.length === 0) {
            await this.getPipelines();
        }

        return this.pipelines.filter((pipeline) => pipeline.id === pipelineId).pop() ?? null;
    }

    /**
     * Returns all the pipelines associated with a node.
     *
     * @return {Promise<Array<Pipeline>>}
     */
    async getPipelines() {
        if (this.pipelines.length === 0) {
            this.pipelines = await this._getRunningPipelines();
        }

        return this.pipelines;
    }

    /**
     * Method for creating a PluginInstance of a specific signature with the provided config. If no name is provided
     * a generated name will be assigned.
     *
     * @param {string} signature
     * @param {Object} config
     * @param {string|null} name
     * @return {PluginInstance}
     */
    createPluginInstance(signature, config = {}, name = null) {
        if (!name) {
            name = generateId();
        }

        const schema = this.client.schemas?.plugins[signature] ?? null;
        if (!schema) {
            throw new Error(`Unknown Plugin Type "${signature}". Make sure the schema for "${signature}" is loaded.`);
        }

        return PluginInstance.make({
            signature,
            config,
            stats: {},
            rawConfig: true,
            id: name,
            schema,
            dirty: true,
            tags: {},
            schedule: [],
        });
    }

    /**
     * Returns the Plugin Instance identified by `instanceId` from the instances running on this pipeline. If no
     * instance is found, then `null` is returned.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {string} instanceId
     * @return {Promise<PluginInstance|null>}
     */
    async getPluginInstance(pipelineOrId, instanceId) {
        let pipeline = pipelineOrId;
        if (typeof pipelineOrId === 'string') {
            pipeline = await this.getPipeline(pipelineOrId);
        }

        if (!pipeline) {
            return null;
        }

        return pipeline.instances.filter((instance) => instance.id === instanceId).pop() ?? null;
    }

    /**
     * Returns the list of plugin instances running on this pipeline.
     *
     * @return {Promise<Array<PluginInstance>>}
     */
    async getPluginInstances(pipelineOrId) {
        let pipeline = pipelineOrId;
        if (typeof pipelineOrId === 'string') {
            pipeline = await this.getPipeline(pipelineOrId);
        }

        if (!pipeline || !Object.hasOwn(pipeline, 'instances')) {
            this.logger.warn('Pipeline does not have any instances or the pipeline is missing.');

            return [];
        }

        return pipeline.instances;
    }

    /**
     * Updates the DataCaptureThread metadata for the specified pipeline.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {Object} metadata
     * @return {Promise<NodeManager>}
     */
    async updatePipelineMetadata(pipelineOrId, metadata) {
        let pipeline = pipelineOrId;
        if (typeof pipelineOrId === 'string') {
            pipeline = await this.getPipeline(pipelineOrId);
        }

        pipeline.updateMetadata(metadata);

        return this;
    }

    /**
     * Updates the DataCaptureThread metadata for the specified pipeline.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {Object} update
     * @return {Promise<NodeManager>}
     */
    async updatePipelineConfig(pipelineOrId, update) {
        let pipeline = pipelineOrId;
        if (typeof pipelineOrId === 'string') {
            pipeline = await this.getPipeline(pipelineOrId);
        }

        pipeline.updateConfig(update);

        return this;
    }

    /**
     * Closes the pipeline by queueing an Archive Config command for the NaeuralEdgeProtocol node.
     *
     * @param {Pipeline|string} pipelineOrId
     * @return {Promise<NodeManager>}
     */
    async closePipeline(pipelineOrId) {
        let pipeline = pipelineOrId;
        if (typeof pipelineOrId === 'string') {
            pipeline = await this.getPipeline(pipelineOrId);
        }

        this.pipelinesMarkedForClosing.push(pipeline.id);

        return this;
    }

    /**
     * Adds a new Plugin Instance to be deployed on the Pipeline.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {PluginInstance} instance
     * @return {Promise<NodeManager>}
     */
    async attachPluginInstance(pipelineOrId, instance) {
        let pipeline;
        if (typeof pipelineOrId === 'string') {
            pipeline = await this.getPipeline(pipelineOrId);
        } else {
            pipeline = pipelineOrId;
        }

        NodeManager.attachPluginInstanceToPipeline(pipeline, instance);

        return this;
    }

    /**
     * Removes a running plugin instance from the pipeline instance list.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {PluginInstance} instance
     * @return {Promise<NodeManager>}
     */
    async removePluginInstance(pipelineOrId, instance) {
        if (instance.isLinked()) {
            const mainInstancePath = instance.getCollectorInstance()
                ? instance.getCollectorInstance().split(':')
                : null;

            if (!mainInstancePath) {
                // removing main instance; recalculate linking map
                const linkedInstances = [...instance.getLinkedInstances()];
                if (linkedInstances.length > 0) {
                    const newMainPath = linkedInstances.pop().split(':');
                    const newMain = await this.getPluginInstance(newMainPath[0], newMainPath[1]);
                    newMain.purgeLinks();

                    for (const collectedPath of linkedInstances) {
                        const [pipelineId, instanceId] = collectedPath.split(':');
                        const collected = await this.getPluginInstance(pipelineId, instanceId);
                        collected.purgeLinks();
                        newMain.link(collected);
                    }
                }
            } else {
                const mainInstance = await this.getPluginInstance(mainInstancePath[0], mainInstancePath[1]);
                mainInstance.unlink(instance);
            }
        }

        let pipeline;
        if (typeof pipelineOrId === 'string') {
            pipeline = await this.getPipeline(pipelineOrId);
        } else {
            pipeline = pipelineOrId;
        }

        for (let i = 0; i < pipeline.instances.length; i++) {
            const current = pipeline.instances[i];
            if (current.id === instance.id) {
                pipeline.instances.splice(i, 1);
                pipeline.isDirty = true;
                pipeline.removeInstanceWatch([this.node, pipeline.id, instance.signature, instance.id]);

                break;
            }
        }

        instance = null;

        return this;
    }

    /**
     * Links the instances provided as parameters.
     *
     * @param {Array<PluginInstance>} instances
     * @return {Promise<NodeManager>}
     */
    async linkInstances(instances) {
        if (instances.length < 2) {
            return this;
        }

        const firstType = instances[0].schema.type;
        const allSameType = instances.every((instance) => instance.schema.type === firstType);

        if (!allSameType) {
            throw new Error('Not all instances have the same type.');
        }

        let mainInstance = instances.find((instance) => instance.isCollecting() === true);

        if (!mainInstance) {
            mainInstance = instances[0];
        }

        for (const instance of instances) {
            if (instance.id === mainInstance.id && instance.pipeline.id === mainInstance.pipeline.id) {
                continue;
            }

            mainInstance.link(instance);
        }

        return this;
    }

    /**
     * Updates the config for a provided instance.
     *
     * @param {PluginInstance} instance
     * @param {Object} update
     * @return {NodeManager}
     */
    updateInstance(instance, update) {
        instance.updateConfig(update);

        return this;
    }

    /**
     * Sets the provided tags on the instance.
     *
     * @param {PluginInstance} instance
     * @param {Object} tags
     * @return {NodeManager}
     */
    setInstanceTags(instance, tags) {
        instance.bulkSetTags(tags);

        return this;
    }

    /**
     * Sets the value for a specific tag on the plugin instance.
     *
     * @param {PluginInstance} instance
     * @param {string} tag
     * @param {string} value
     * @return {NodeManager}
     */
    tagInstance(instance, tag, value) {
        instance.addTag(tag, value);

        return this;
    }

    /**
     * Removes a tag from the plugin instance.
     *
     * @param {PluginInstance} instance
     * @param {string} tag
     * @return {NodeManager}
     */
    removeInstanceTag(instance, tag) {
        instance.removeTag(tag);

        return this;
    }

    /**
     * Sets the working hours schedule for the instance.
     * This method accepts either a detailed schedule for each day of the week
     * or a single schedule for all days.
     *
     * @param {PluginInstance} instance
     * @param {Object|Array} schedule - The schedule to set. If an object, it should
     * map days to time intervals. If an array, it applies the same schedule to all days.
     * @param {string} timezone
     * @returns {NodeManager} The instance of PluginInstance to allow method chaining.
     */
    setInstanceSchedule(instance, schedule, timezone = 'UTC+0') {
        instance.setSchedule(schedule, timezone);

        return this;
    }

    /**
     * Commits the changes registered for the node.
     *
     * @return {Promise<Array<Object>>}
     */
    async commit() {
        // A manager that refused a stale commit must not be retried: its cached
        // view stays stale, and a blind retry loop would eventually clobber the
        // concurrent change the moment the fence marker TTL expires.
        if (this._fenceRefused === true) {
            throw new Error(
                `This NodeManager for ${this.node} previously refused a stale commit; ` +
                    'build a fresh manager via getNodeManager() and reapply the changes on the fresh view.',
            );
        }

        const runningPipelines = await this._getRunningPipelines();
        const messages = {};

        for (const pipeline of this.pipelines) {
            if (this.pipelinesMarkedForClosing.includes(pipeline.id)) {
                continue;
            }

            const runningPipeline =
                runningPipelines.filter((runningPipeline) => runningPipeline.id === pipeline.id).pop() ?? null;

            if (pipeline.getDataCaptureThread().isDirty || pipeline.isDirty || !runningPipeline) {
                // new Pipeline, DCT changes or instances removed/added
                if (messages[NODE_COMMAND_UPDATE_CONFIG] === undefined) {
                    messages[NODE_COMMAND_UPDATE_CONFIG] = [];
                }

                messages[NODE_COMMAND_UPDATE_CONFIG].push({
                    payload: NodeManager.compilePipelineUpdateConfig(pipeline),
                    watches: [...pipeline.getInstanceWatches()],
                    // Fence metadata. `locallyAuthored` pipelines (createPipeline or
                    // just-committed) carry authoritative intent and skip the
                    // staleness check; hydrated pipelines carry their heartbeat
                    // receive-time basis (missing basis → 0 → always-stale when a
                    // marker exists: fail closed, never promote a derived snapshot
                    // to authoritative). Watches are cleared only after a
                    // successful publish so a refused commit keeps them intact.
                    pipelineId: pipeline.id,
                    viewBasisTs: pipeline._locallyAuthored ? null : pipeline._viewBasisTs ?? 0,
                    locallyAuthored: pipeline._locallyAuthored === true,
                    pipelineRef: pipeline,
                });
            } else {
                // some of the instances may have been reconfigured
                const changeSet = await NodeManager.compilePipelineBatchUpdateInstances(pipeline);
                if (changeSet.length > 0) {
                    if (messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE] === undefined) {
                        messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE] = [];
                    }

                    messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE].push({
                        payload: changeSet,
                        watches: [...pipeline.getInstanceWatches()],
                        // Batch deltas are exempt from the staleness check but must
                        // still advance the fence marker (see the fence block below).
                        pipelineId: pipeline.id,
                        pipelineRef: pipeline,
                    });
                }
            }
        }

        this.pipelinesMarkedForClosing.forEach((pipelineId) => {
            if (messages[NODE_COMMAND_ARCHIVE_CONFIG] === undefined) {
                messages[NODE_COMMAND_ARCHIVE_CONFIG] = [];
            }

            messages[NODE_COMMAND_ARCHIVE_CONFIG].push({
                payload: pipelineId,
                watches: [],
            });
        });

        const commands = [];
        const updateCommands = messages[NODE_COMMAND_UPDATE_CONFIG] ?? [];
        const batchCommands = messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE] ?? [];
        const archiveCommands = messages[NODE_COMMAND_ARCHIVE_CONFIG] ?? [];

        // Pre-compile the aggregated batch message; publishing is deferred until
        // the fence preflight has passed so a refused commit publishes NOTHING.
        let batchMessage = null;
        let batchWatches = [];
        if (batchCommands.length > 0) {
            const batchUpdates = batchCommands.reduce(
                (aggregated, command) => {
                    aggregated.payload = aggregated.payload.concat(command.payload);
                    aggregated.watches = aggregated.watches.concat(command.watches);

                    return aggregated;
                },
                { payload: [], watches: [] },
            );

            let action = NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE;
            let payload = batchUpdates.payload;
            if (batchUpdates.payload.length === 1) {
                action = NODE_COMMAND_UPDATE_PIPELINE_INSTANCE;
                payload = payload[0];
            }

            batchMessage = {
                ACTION: action,
                PAYLOAD: payload,
            };
            batchWatches = batchUpdates.watches;
        }

        /**
         * Publishes every prepared command (batch deltas, full configs,
         * archives) and only then consumes the pipelines' instance watches —
         * a refused commit must leave watches intact for the caller's retry
         * on a rebuilt manager.
         */
        const publishAll = () => {
            if (batchMessage) {
                commands.push(this.client.publish(this.node, batchMessage, batchWatches));
            }

            for (const command of updateCommands) {
                commands.push(
                    this.client.publish(this.node, { ACTION: NODE_COMMAND_UPDATE_CONFIG, PAYLOAD: command.payload }, command.watches),
                );
            }

            for (const command of archiveCommands) {
                commands.push(this.client.publish(this.node, { ACTION: NODE_COMMAND_ARCHIVE_CONFIG, PAYLOAD: command.payload }));
            }

            [...updateCommands, ...batchCommands].forEach((command) => command.pipelineRef.removeAllInstanceWatches());
        };

        if (updateCommands.length === 0 && batchCommands.length === 0 && archiveCommands.length === 0) {
            return Promise.all(commands);
        }

        /*
         * Pipeline commit fence.
         *
         * Full `UPDATE_CONFIG` messages overwrite the ENTIRE pipeline config on
         * the edge node. Views are hydrated from the last heartbeat, so a view
         * built before another writer's commit — but published after it —
         * silently reverts that commit (last-writer-wins corruption; S1 in the
         * horizontal-scaling audit). The fence:
         *   1. serializes preflight→publish→mark per node via a shared,
         *      owner-token lock (short critical section — publishes are
         *      enqueue-only, acks are awaited OUTSIDE the lock);
         *   2. refuses full-config commits whose heartbeat basis is not newer
         *      than the pipeline's last mutation marker plus an apply-grace
         *      window (a heartbeat GENERATED before the last commit applied can
         *      be RECEIVED after it — receive time alone is not proof the view
         *      contains the committed config; the grace absorbs apply lag,
         *      in-flight heartbeats, and clock skew). Refusal throws
         *      StalePipelineViewError BEFORE anything is published and poisons
         *      this manager (callers must rebuild via getNodeManager — retrying
         *      the same stale view would clobber after the marker TTL expires);
         *   3. writes a TTL-bounded marker for EVERY mutated pipeline — full
         *      configs, batch instance deltas, and archives alike. Deltas and
         *      archives are exempt from the staleness CHECK (they cannot clobber
         *      a whole config) but must advance the fence, or a stale full
         *      config could revert a delta / resurrect an archived pipeline.
         * NOTE: this fence NARROWS the S1 window (to pathological heartbeat
         * delays beyond the grace); the durable elimination is edge-side config
         * versioning (audit fix option c). State managers without fence support
         * (legacy 4.0.x replicas, custom managers) keep the previous unfenced
         * behavior — mixed-version fleets are only fenced among upgraded
         * replicas.
         */
        const state = this.client.state;
        // Capability probe: prefer the explicit `supportsCommitFence()` (the
        // `State` facade always EXPOSES the fence methods but may wrap a custom
        // manager without them — method-existence probing alone would then
        // crash mid-commit instead of taking the documented legacy fallback);
        // fall back to method-existence for bare managers and legacy states.
        const fenceSupported =
            typeof state?.supportsCommitFence === 'function'
                ? state.supportsCommitFence() === true
                : typeof state?.acquireNodeCommitLock === 'function' &&
                  typeof state?.releaseNodeCommitLock === 'function' &&
                  typeof state?.getPipelineCommitMarker === 'function' &&
                  typeof state?.setPipelineCommitMarker === 'function';

        if (!fenceSupported) {
            publishAll();

            return Promise.all(commands);
        }

        const lockToken = await state.acquireNodeCommitLock(this.node);
        if (!lockToken) {
            throw new Error(
                `Could not acquire the pipeline commit fence lock for node ${this.node}; ` +
                    'another configuration commit is in progress — retry shortly.',
            );
        }

        let publishesInitiated = false;
        try {
            // Preflight: every full-config staleness check runs BEFORE any
            // publish, so a refused commit has initiated nothing at all.
            for (const command of updateCommands) {
                if (command.locallyAuthored) {
                    // Authored-and-never-committed only (createPipeline). After
                    // its first commit the flag is cleared and the own-marker
                    // rule below takes over — authorship must never become an
                    // unbounded bypass on a long-lived manager.
                    continue;
                }

                const markerTs = await state.getPipelineCommitMarker(this.node, command.pipelineId);
                if (markerTs === null) {
                    continue;
                }

                // Own-marker rule: if the pipeline's last mutation marker is the
                // one THIS manager wrote, its in-memory config already contains
                // that mutation — back-to-back commits on the same manager pass.
                // Any FOREIGN marker (another replica/manager committed since)
                // must refuse: this manager's cached view cannot contain it.
                if (markerTs === command.pipelineRef._ownMarkerTs) {
                    continue;
                }

                if (command.viewBasisTs < markerTs + PIPELINE_COMMIT_APPLY_GRACE_MS) {
                    this._fenceRefused = true;
                    throw new StalePipelineViewError(this.node, command.pipelineId, markerTs, command.viewBasisTs);
                }
            }

            const nowMs =
                typeof state.getServerTimeMs === 'function' ? await state.getServerTimeMs() : new Date().getTime();

            publishesInitiated = true;
            publishAll();

            // Markers are written at publish time (pessimistic): if an ack later
            // fails, the marker TTL bounds the over-fencing window instead of
            // risking an unmarked-but-applied commit being clobbered.
            const mutatedPipelineIds = new Set([
                ...updateCommands.map((command) => command.pipelineId),
                ...batchCommands.map((command) => command.pipelineId),
                ...archiveCommands.map((command) => command.payload),
            ]);
            for (const pipelineId of mutatedPipelineIds) {
                await state.setPipelineCommitMarker(this.node, pipelineId, nowMs);
            }

            // Record which marker THIS manager wrote so back-to-back commits on
            // the same manager pass the own-marker rule — while any foreign
            // marker advance still refuses. Batch deltas count too: they advance
            // the shared marker above, so omitting them would self-fence a
            // batch-then-full sequence on the same manager. Authorship is
            // cleared here: it only covers the created-but-never-committed
            // window (an authored flag that survived commits would be an
            // unbounded fence bypass on long-lived managers).
            [...updateCommands, ...batchCommands].forEach((command) => {
                command.pipelineRef._ownMarkerTs = nowMs;
                command.pipelineRef._locallyAuthored = false;
            });
        } catch (error) {
            if (publishesInitiated) {
                // In-flight publishes must not become unhandled rejections when
                // commit() itself rejects (their acks resolve/reject later).
                commands.forEach((command) => command.catch(() => {}));
            }

            throw error;
        } finally {
            await state.releaseNodeCommitLock(this.node, lockToken);
        }

        return Promise.all(commands);
    }

    /**
     * Returns the pipelines running on this node as they're reflected by the last received heartbeat.
     *
     * @return {Promise<Array<Pipeline>>}
     * @private
     */
    async _getRunningPipelines() {
        const client = this.client;
        const node = this.node;

        return client.state.getNodeInfo(node).then((nodeInfo) => {
            // Fence view-basis: when this heartbeat was RECEIVED. Full-config
            // commits compiled from these pipelines are only allowed if the
            // basis clears the pipeline's last mutation marker plus the apply
            // grace (see commit()). A hydrated view with a missing `lastUpdate`
            // is normalized to basis 0 at commit time — always-stale whenever a
            // marker exists (fail closed; a derived snapshot must never be
            // silently promoted to authoritative intent).
            const viewBasisTs = nodeInfo?.lastUpdate ?? null;

            return nodeInfo?.data?.pipelines
                ? Object.keys(nodeInfo.data?.pipelines).map((pipelineId) => {
                      const pipelineConfig = nodeInfo.data?.pipelines[pipelineId];

                      const pipeline = Pipeline.make(client, node, pipelineConfig, client.schemas);
                      // Heartbeat-derived pipelines carry their basis; locally
                      // authored ones (createPipeline / just committed) carry the
                      // `_locallyAuthored` flag instead and skip the staleness
                      // check (authoritative intent).
                      pipeline._viewBasisTs = viewBasisTs;

                      return pipeline;
                  })
                : [];
        });
    }
}
