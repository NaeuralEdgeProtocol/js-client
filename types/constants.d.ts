/**
 * @typedef {Object} NaeuralCommand
 * @property {string} ACTION The action to be performed on the network node
 * @property {Object|string} PAYLOAD The payload for the aforementioned `ACTION`
 * @property {string} [EE_ID] The node identification to route the command to, is optional up until the actual publishing.
 * @property {string} [EE_SENDER] The identity of the sender, is optional up until publishing
 * @property {string} [EE_HASH] The sha256 hash of the `ACTION` and `PAYLOAD`
 * @property {string} [EE_SIGN] The signature of the `EE_HASH` using the `EE_SENDER`'s identity
 * @property {string} [INITIATOR_ID] Optional until publishing, the human-readable identity of the sender.
 * @property {string} [SESSION_ID] Optional, the session ID to be used when performing the action.
 */
/**
 * @typedef {Object} NaeuralUpdateInstanceConfig
 * @property {string} NAME The pipeline id
 * @property {string} SIGNATURE The instance signature
 * @property {string} INSTANCE_ID The instance id
 * @property {Object} INSTANCE_CONFIG The new configuration to be applied for the instance
 */
export const ALL_EDGE_NODES: "*";
export const STICKY_COMMAND_ID_KEY: "__COMMAND_ID";
export const envelopeKeys: string[];
export const THREAD_TYPE_UNKNOWN: "unknown";
export const THREAD_TYPE_HEARTBEATS: "heartbeats";
export const THREAD_TYPE_NOTIFICATIONS: "notifications";
export const THREAD_TYPE_PAYLOADS: "payloads";
export const THREAD_COMMAND_START: "THREAD_COMMAND_START";
export const THREAD_COMMAND_UPDATE_STATE: "THREAD_COMMAND_UPDATE_STATE";
export const THREAD_COMMAND_UPDATE_FLEET: "THREAD_COMMAND_UPDATE_FLEET";
export const THREAD_COMMAND_WATCH_FOR_SESSION_ID: "THREAD_COMMAND_WATCH_FOR_SESSION_ID";
export const THREAD_COMMAND_IGNORE_SESSION_ID: "THREAD_COMMAND_IGNORE_SESSION_ID";
export const THREAD_COMMAND_WATCH_FOR_STICKY_SESSION_ID: "THREAD_COMMAND_WATCH_FOR_STICKY_SESSION_ID";
export const THREAD_COMMAND_MEMORY_USAGE: "THREAD_COMMAND_MEMORY_USAGE";
export const INTERNAL_STATE_MANAGER: "use.internal.manager";
export const REDIS_STATE_MANAGER: "use.redis.manager";
export const UNKNOWN_STATE_MANAGER: "unknown";
export const MESSAGE_TYPE_HEARTBEAT: "HEARTBEAT";
export const MESSAGE_TYPE_PAYLOAD: "PAYLOAD";
export const MESSAGE_TYPE_NOTIFICATION: "NOTIFICATION";
export const MESSAGE_TYPE_OBSERVED_NODE: "observed.node";
export const MESSAGE_TYPE_SUPERVISOR_STATUS: "supervisor.status";
export const MESSAGE_TYPE_NETWORK_REQUEST_RESPONSE: "network.request.response";
export const MESSAGE_TYPE_THREAD_MEMORY_USAGE: "thread.memory.usage";
export const MESSAGE_TYPE_NETWORK_NODE_DOWN: "network.node.down";
export const MESSAGE_TYPE_NETWORK_SUPERVISOR_PAYLOAD: "network.supervisor.payload";
export const MESSAGE_TYPE_THREAD_LOG: "thread.logger";
export const MESSAGE_TYPE_REFRESH_ADDRESSES: "refresh-addresses";
export const REDIS_LOCK_EXPIRATION_TIME: 100;
export const REDIS_LOCK_MAX_RETRIES: 10;
export const REDIS_LOCK_RETRY_INTERVAL: 100;
export const NETWORK_REQUEST_RESPONSE_NOTIFICATION: "network.request.response.notification";
export const NETWORK_STICKY_PAYLOAD_RECEIVED: "network.sticky.payload.received";
export const IN_MEMORY_INBOX_ID: "internal-handler";
export const SECOND: 1000;
export const TIMEOUT_MAX_REQUEST_TIME: number;
export const TIMEOUT_TO_FIRST_RESPONSE: number;
export const NODE_OFFLINE_CUTOFF_TIME: number;
export const REST_CUSTOM_EXEC_SIGNATURE: "REST_CUSTOM_EXEC_01";
export const ADMIN_PIPELINE_NAME: "admin_pipeline";
export const NETMON_SIGNATURE: "NET_MON_01";
export const NETMON_DEFAULT_INSTANCE: "NET_MON_01_INST";
export const NODE_COMMAND_ARCHIVE_CONFIG: "ARCHIVE_CONFIG";
export const NODE_COMMAND_ARCHIVE_CONFIG_ALL: "ARCHIVE_CONFIG_ALL";
export const NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE: "BATCH_UPDATE_PIPELINE_INSTANCE";
export const NODE_COMMAND_DELETE_CONFIG_ALL: "DELETE_CONFIG_ALL";
export const NODE_COMMAND_PIPELINE_COMMAND: "PIPELINE_COMMAND";
export const NODE_COMMAND_UPDATE_CONFIG: "UPDATE_CONFIG";
export const NODE_COMMAND_UPDATE_PIPELINE_INSTANCE: "UPDATE_PIPELINE_INSTANCE";
export const NAEURAL_CLIENT_CONNECTED: "0xai_CCONNSUCCESS";
export const NAEURAL_CLIENT_SYS_TOPIC_SUBSCRIBE: "0xai_CSTS";
export const NAEURAL_BC_ADDRESS: "0xai_BCADDR";
export const NAEURAL_CLIENT_BOOTED: "0xai_BOOT";
export const NAEURAL_ENGINE_REGISTERED: "0xai_EEREG";
export const NAEURAL_ENGINE_DEREGISTERED: "0xai_EEDEREG";
export const NAEURAL_RECEIVED_HEARTBEAT_FROM_ENGINE: "0xai_CONEE";
export const NAEURAL_RECEIVED_HEARTBEAT_FROM_ADDRESS: "0xai_CONADDR";
export const NAEURAL_CLIENT_SYS_TOPIC_UNSUBSCRIBE: "0xai_CSTUS";
export const NAEURAL_CLIENT_DISCONNECTED: "0xai_CDISCONN";
export const NAEURAL_CLIENT_CONNECTION_ERROR: "0xai_CCONNERR";
export const NAEURAL_CLIENT_SHUTDOWN: "0xai_SHUTDOWN";
export const NAEURAL_EXCEPTION: "0xai_EX";
export const NAEURAL_ENGINE_OFFLINE: "0xai_EEOFF";
export const NAEURAL_ENGINE_ONLINE: "0xai_EEON";
export const NAEURAL_SUPERVISOR_PAYLOAD: "0xai_SUPERPAY";
export const NOTIFICATION_TYPE_EXCEPTION: "EXCEPTION";
export const NOTIFICATION_TYPE_NORMAL: "NORMAL";
export const NOTIFICATION_TYPE_ABNORMAL: "ABNORMAL FUNCTIONING";
export const PIPELINE_OK: 1;
export const PIPELINE_FAILED: number;
export const PIPELINE_DATA_OK: number;
export const PIPELINE_DATA_FAILED: number;
export const PIPELINE_DCT_CONFIG_OK: number;
export const PIPELINE_DCT_CONFIG_FAILED: number;
export const PIPELINE_ARCHIVE_OK: number;
export const PIPELINE_ARCHIVE_FAILED: number;
export const PLUGIN_OK: 100;
export const PLUGIN_INSTANCE_COMMAND_OK: 101;
export const PLUGIN_FAILED: number;
export const PLUGIN_INSTANCE_COMMAND_FAILED: number;
export const PLUGIN_PAUSE_OK: 110;
export const PLUGIN_PAUSE_FAILED: number;
export const PLUGIN_RESUME_OK: 111;
export const PLUGIN_RESUME_FAILED: number;
export const PLUGIN_WORKING_HOURS_SHIFT_START: 112;
export const PLUGIN_WORKING_HOURS_SHIFT_START_FAILED: number;
export const PLUGIN_WORKING_HOURS_SHIFT_END: 113;
export const PLUGIN_WORKING_HOURS_SHIFT_END_FAILED: number;
export const PLUGIN_CONFIG_IN_PAUSE_OK: 120;
export const PLUGIN_CONFIG_IN_PAUSE_FAILED: number;
export namespace logLevels {
    let error: number;
    let warn: number;
    let info: number;
    let http: number;
    let verbose: number;
    let debug: number;
    let silly: number;
}
export const levelNames: string[];
export const ADDRESSES_UPDATES_INBOX: "address-updates";
export const ADDRESS_UPDATE_EVENT: "address-update-event";
export const FLEET_UPDATES_INBOX: "fleet-updates";
export const FLEET_UPDATE_EVENT: "fleet-update-event";
export type NaeuralCommand = {
    /**
     * The action to be performed on the network node
     */
    ACTION: string;
    /**
     * The payload for the aforementioned `ACTION`
     */
    PAYLOAD: any | string;
    /**
     * The node identification to route the command to, is optional up until the actual publishing.
     */
    EE_ID?: string;
    /**
     * The identity of the sender, is optional up until publishing
     */
    EE_SENDER?: string;
    /**
     * The sha256 hash of the `ACTION` and `PAYLOAD`
     */
    EE_HASH?: string;
    /**
     * The signature of the `EE_HASH` using the `EE_SENDER`'s identity
     */
    EE_SIGN?: string;
    /**
     * Optional until publishing, the human-readable identity of the sender.
     */
    INITIATOR_ID?: string;
    /**
     * Optional, the session ID to be used when performing the action.
     */
    SESSION_ID?: string;
};
export type NaeuralUpdateInstanceConfig = {
    /**
     * The pipeline id
     */
    NAME: string;
    /**
     * The instance signature
     */
    SIGNATURE: string;
    /**
     * The instance id
     */
    INSTANCE_ID: string;
    /**
     * The new configuration to be applied for the instance
     */
    INSTANCE_CONFIG: any;
};
