import { SchemaDefinition, SchemasRepository } from "./utils/schema.providers";
import type { Observable } from "rxjs";

export const HEARTBEATS_STREAM: "heartbeats";
export const PAYLOADS_STREAM: "payloads";
export const NOTIFICATIONS_STREAM: "notifications";
/**
 * Enum NaeuralEdgeProtocol Event Stream Types
 */
export type ZxAIEventType = string;
export namespace ZxAIEventType {
    export { PAYLOADS_STREAM as PAYLOAD };
    export { HEARTBEATS_STREAM as HEARTBEAT };
    export { NOTIFICATIONS_STREAM as NOTIFICATION };
}
/**
 * Enum NaeuralEdgeProtocol Client Events
 */
export type NaeuralEvent = string;
export namespace NaeuralEvent {
    let ZxAI_CLIENT_CONNECTED: string;
    let ZxAI_CLIENT_SYS_TOPIC_SUBSCRIBE: string;
    let ZxAI_BC_ADDRESS: string;
    let ZxAI_CLIENT_BOOTED: string;
    let ZxAI_ENGINE_REGISTERED: string;
    let ZxAI_ENGINE_DEREGISTERED: string;
    let ZxAI_RECEIVED_HEARTBEAT_FROM_ENGINE: string;
    let ZxAI_CLIENT_SYS_TOPIC_UNSUBSCRIBE: string;
    let ZxAI_CLIENT_DISCONNECTED: string;
    let ZxAI_CLIENT_CONNECTION_ERROR: string;
    let ZxAI_CLIENT_SHUTDOWN: string;
    let ZxAI_EXCEPTION: string;
    let ZxAI_ENGINE_OFFLINE: string;
}
/**
 * @extends EventEmitter2
 *
 * The main network client.
 */
export class Naeural extends EventEmitter2 {
    /**
     * The network client constructor.
     *
     * @constructor
     * @param {NaeuralOptions} options
     * @param {*} logger
     */
    constructor(options?: NaeuralOptions, logger?: any);
    /**
     * The boot options.
     *
     * @type {Object}
     */
    bootOptions: any;
    /**
     * The state to update.
     *
     * @type {State|null}
     */
    state: State | null;
    /**
     * The repository of schemas to be used when interacting with instances and pipelines.
     *
     * @type {SchemasRepository}
     */
    schemas: SchemasRepository;
    /**
     * Statistics about the memory used by the SDK.
     *
     * @type {*}
     */
    memoryUsageStats: any;
    /**
     * This method connects the client to the network and spawns all the threads on the network streams.
     *
     * @return {void}
     */
    boot(): void;
    /**
     * Returns the snapshot of the memory usage.
     *
     * @return {Object}
     */
    getMemoryStats(): any;
    /**
     * This method returns the initiator name used for the connection.
     *
     * @return {string} initiator name
     */
    getName(): string;
    /**
     * Loads an identity for the current session.
     *
     * @param identityPrivateKey
     */
    loadIdentity(identityPrivateKey: any): boolean;
    /**
     * This method returns the NaeuralEdgeProtocol Network unique blockchain address.
     *
     * @return {string} NaeuralEdgeProtocol Network address
     */
    getBlockChainAddress(): string;
    registerMessageDecoder(name: any, path: any): void;
    /**
     * Method for registering a new network node without rebooting the client.
     *
     * @param {string} node The node to register.
     * @return {void}
     */
    registerEdgeNode(node: string): void;
    /**
     * Method for deregistering a network node without rebooting the client.
     *
     * @param {string} node The node to register.
     * @return {void}
     */
    deregisterEdgeNode(node: string): void;
    /**
     * Method for retrieving the status of the fleet of network nodes that are processed by this instance.
     *
     * @return {Promise<Array<NodeStatus>>} The Fleet Status
     */
    getFleet(): Promise<Array<NodeStatus>>;
    /**
     * Returns the current network status as seen by the specified supervisor.
     * If `supervisor` is null, it returns the latest information received.
     *
     * @param supervisor
     * @return {Promise<Object>}
     */
    getNetworkStatus(supervisor?: any): Promise<any>;
    /**
     * Get the list of network supervisors.
     *
     * @return {Promise<string[]>}
     */
    getSupervisors(): Promise<string[]>;
    /**
     * Returns a list of all the registered DCT Schemas.
     *
     * @return {Array<AvailableDCTResponse>}
     */
    getRegisteredDCTTypes(): Array<AvailableDCTResponse>;
    /**
     * Allows for hot registration of a new DCT Schema to be used by the network client.
     *
     * @param {string} name
     * @param {SchemaDefinition} schema
     * @return {Naeural}
     */
    registerDCTType(name: string, schema: SchemaDefinition): Naeural;
    /**
     * Returns the schema associated to a DCT name.
     *
     * @param {string} dctName
     * @return {SchemaDefinition|null}
     */
    getDCTSchema(dctName: string): SchemaDefinition | null;
    /**
     * Returns the list of Plugin Schemas associated to this network client.
     *
     * @return {Array<AvailableSchemaResponse>}
     */
    getRegisteredPluginTypes(): Array<AvailableSchemaResponse>;
    /**
     * Returns the loaded schema for a specific plugin `signature`.
     *
     * @param signature
     * @return {SchemaDefinition|null}
     */
    getPluginSchema(signature: any): SchemaDefinition | null;
    /**
     * Associates a schema with a plugin `signature`.
     *
     * @param {string} signature
     * @param {Object} schema
     * @return {Naeural}
     */
    registerPluginSchema(signature: string, schema: any): Naeural;
    /**
     * Returns a specific stream of events in the network. It can offer a window inside all the messages published
     * in a specific message type category.
     *
     * @param stream
     * @return {Observable|null} a subscribable stream with the selected event type.
     */
    getStream(stream: any): Observable<Object> | null;
    /**
     * Sets a custom callback for a specific instance.
     *
     * @param {string} node
     * @param {PluginInstance|string} instance
     * @param callback
     * @return {Naeural}
     */
    setInstanceCallback(node: string, instance: PluginInstance | string, callback: any): Naeural;
    /**
     * Returns the client's observable universe: all the hosts that sent a heartbeat that are outside
     * this client's fleet.
     *
     * @return {Promise<ObservedNodes>}
     */
    getUniverse(): Promise<ObservedNodes>;
    /**
     * Returns a `NodeManager` for a specific node.
     *
     * @param node
     * @return {Promise<NodeManager|null>}
     */
    getNodeManager(node: any): Promise<NodeManager | null>;
    /**
     * Method for publishing a message for an NaeuralEdgeProtocol Node.
     *
     * @param {string} node
     * @param {Object} message
     * @param {Array<Array<string>>} extraWatches
     * @return {Promise<unknown>}
     */
    publish(node: string, message: any, extraWatches?: Array<Array<string>>): Promise<unknown>;
}
export type AlertedNodes = {
    [x: string]: number;
};
export type ZxAIClientOptions = {
    /**
     * - the EventEmitter2 setup
     */
    emitterOptions: any;
    /**
     * - The initiator of the configuration.
     */
    initiator: any;
    /**
     * - Blockchain related configurations.
     */
    blockchain: {
        debug: boolean;
        key: string;
    };
    /**
     * - Describes the state manager.
     */
    stateManager: string;
    /**
     * - Describes the state manager.
     */
    loglevel: string;
    /**
     * - Redis configuration details.
     */
    redis: {
        host: string;
        port: number;
        password: any;
        pubSubChannel: string;
    };
    /**
     * - MQTT connection options.
     */
    mqttOptions: {
        url: any;
        username: any;
        password: any;
    };
    /**
     * - Custom formatters for configuration.
     */
    customFormatters: any;
    /**
     * - Thread configuration for various tasks.
     */
    threads: {
        heartbeats: number;
        notifications: number;
        payloads: number;
    };
    /**
     * - An array of fleet strings.
     */
    fleet: string[];
};
export type AvailableSchemaResponse = {
    /**
     * - The unique signature.
     */
    signature: string;
    /**
     * - Indicates if the entity is linkable.
     */
    linkable: boolean;
    /**
     * - The name of the entity.
     */
    name: string;
    /**
     * - A description of the entity.
     */
    description: string;
};
export type AvailableDCTResponse = {
    /**
     * - The name of the entity.
     */
    name: string;
    /**
     * - A description of the entity.
     */
    description: string;
    /**
     * - The unique signature.
     */
    type: string;
};
import EventEmitter2 from 'eventemitter2';
import { NodeStatus, ObservedNodes, State } from './models/state.js';
import { NodeManager } from './node.manager.js';
import { PluginInstance } from './models/plugin.instance';
