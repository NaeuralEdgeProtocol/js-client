# @naeural/jsclient

JavaScript/TypeScript SDK for interacting with the NaeuralEdgeProtocol network.

This repository contains the runtime client, node/pipeline management API, blockchain helper utilities, schemas, tests, and generated typings used by the published npm package.

## What This SDK Does

- Connects to Naeural MQTT topics for heartbeats, payloads, and notifications.
- Verifies/signs messages through `NaeuralBC`.
- Tracks network state (in-memory or Redis-backed).
- Exposes high-level node operations through `NodeManager` (pipeline and plugin lifecycle).
- Publishes batched node configuration changes through explicit `commit()` operations.

## Installation

```bash
npm install @naeural/jsclient
```

## Runtime Requirements

- Node.js 20+ recommended (CI uses Node 20).
- Access to an MQTT broker for Naeural network topics.
- Optional Redis when using `REDIS_STATE_MANAGER`.

## Public API (Top-Level Exports)

From `@naeural/jsclient`:

- `Naeural`, `NaeuralEvent`, `NaeuralEventType`
- `NodeManager`, `Pipeline`, `PluginInstance`
- `NaeuralBC`
- all constants from `src/constants.js` (for example `ALL_EDGE_NODES`, `INTERNAL_STATE_MANAGER`, `REDIS_STATE_MANAGER`)
- DCT constants/schemas from `src/utils/dcts`
- `convertKeysToCamelFormat`, `convertKeysToNaeuralFormat`

## Quick Start

```js
import {
  Naeural,
  NaeuralEvent,
  NaeuralEventType,
  ALL_EDGE_NODES,
  INTERNAL_STATE_MANAGER
} from '@naeural/jsclient';

const client = new Naeural({
  initiator: 'my-app',
  stateManager: INTERNAL_STATE_MANAGER,
  mqttOptions: {
    url: 'mqtt://<broker-host>:1883',
    username: '<username>',
    password: '<password>',
    clean: true,
    clientId: 'client-01',
    prefix: 'jsclient'
  },
  blockchain: {
    key: process.env.NAEURAL_PRIVATE_KEY_DER_HEX ?? '',
    encrypt: true,
    secure: true,
    debug: false
  },
  threads: {
    heartbeats: 1,
    notifications: 1,
    payloads: 1
  },
  fleet: [ALL_EDGE_NODES]
});

client.on(NaeuralEvent.NAEURAL_CLIENT_BOOTED, () => {
  console.log('Client booted:', client.getName());
  console.log('Blockchain address:', client.getBlockChainAddress());
});

client.getStream(NaeuralEventType.HEARTBEAT)?.subscribe(({ context, data, error }) => {
  if (error) {
    return;
  }
  console.log('Heartbeat from:', context?.address);
});

client.boot();
```

## Main Mechanics

### 1) Boot Sequence

`client.boot()`:

- spawns/starts worker threads for heartbeat, notification, and payload streams
- connects the main MQTT client
- emits lifecycle events (including boot success and blockchain address)
- starts memory usage aggregation across main thread + workers

### 2) State Management Modes

- `INTERNAL_STATE_MANAGER` (default): single-process state.
- `REDIS_STATE_MANAGER`: shared state/event routing across processes via Redis pub/sub.

If Redis mode is used, configure:

```js
{
  stateManager: REDIS_STATE_MANAGER,
  redis: {
    host: 'localhost',
    port: 6379,
    password: null
  }
}
```

### 3) Fleet Filtering

- `fleet: [ALL_EDGE_NODES]` processes all observed nodes.
- `fleet: ['<node-name-or-address>', ...]` restricts processing to selected nodes.
- `registerEdgeNode()` / `deregisterEdgeNode()` can adjust fleet membership at runtime.

## Node Operations With `NodeManager`

`NodeManager` is retrieved from a running client:

```js
const manager = await client.getNodeManager('<node-name-or-address>');
if (!manager) {
  throw new Error('Node not available in fleet/universe yet.');
}
```

Typical flow:

1. `createPipeline(...)` or `getPipeline(...)`
2. create/update plugin instances
3. call `commit()` to publish network commands

Example:

```js
import { DCT_TYPE_VIDEO_STREAM } from '@naeural/jsclient';

const pipeline = await manager.createPipeline(
  {
    type: DCT_TYPE_VIDEO_STREAM,
    config: {
      URL: 'rtsp://example.local/stream',
      CAP_RESOLUTION: 20
    }
  },
  'camera-pipeline'
);

await manager.prepareCustomCode(
  "plugin.int_cache['runs'] = (plugin.int_cache.get('runs') || 0) + 1",
  'custom-exec-instance',
  pipeline
);

await manager.commit();
```

## Schemas and Extensibility

Built-in DCT schemas are preloaded (`VideoStream`, `VideoFile`, `MetaStream`, `Void`, `OnDemand*`).

Plugin schemas are registry-driven:

- default plugin schema included: `CUSTOM_EXEC_01`
- for other plugin signatures, register schemas before creating instances

```js
client.registerPluginSchema('MY_PLUGIN_SIGNATURE', mySchema);
```

## Blockchain / Identity

`NaeuralBC` handles:

- key generation/loading
- message signing and verification
- payload encryption/decryption
- address derivation

CLI key generation:

```bash
npx @naeural/jsclient generate ./identity.json
```

This command prints and optionally writes:

- DER private/public key data
- PEM private key
- derived Naeural address (`0xai_...`)

Treat private keys as secrets.

## Events and Streams

Event constants are exposed via `NaeuralEvent`, for example:

- `NAEURAL_CLIENT_BOOTED`
- `NAEURAL_BC_ADDRESS`
- `NAEURAL_ENGINE_REGISTERED`
- `NAEURAL_ENGINE_DEREGISTERED`
- `NAEURAL_ENGINE_OFFLINE`

Stream constants via `NaeuralEventType`:

- `HEARTBEAT`
- `PAYLOAD`
- `NOTIFICATION`

Use `client.getStream(type)` for observable streams and `client.on(event, handler)` for EventEmitter events.

## Development

```bash
npm install
npm test
npm run test:coverage
npm run lint
npm run format
npm run generate:typedefs
```

## Documentation Artifacts

- Generated API markdown: `API.md`
- Generated JSDoc output: `docs/jsdoc/`
- TypeScript declarations: `types/`

## CI / Release Workflow

Current workflow file: `.github/workflows/release.yml`

It currently:

- installs dependencies
- runs tests with coverage
- uploads coverage to Codecov
- creates a GitHub release on version change

It does not currently publish to npm.

## License

Apache-2.0. See `LICENSE`.
