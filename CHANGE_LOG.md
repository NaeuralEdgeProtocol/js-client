# CHANGE_LOG

## [Unreleased] - 2026-03-04

### Follow-Up Fixes (Comms Diagnostics Reliability)

- Hardened `src/threads/message.thread.js::_onFunnelException()` to safely normalize and log non-Error thrown values (string/object/nullish) without allowing the logging path to throw.
- Fixed buffer-stage NET_MON trace semantics so `_stageBufferToString()` reports `error` outcome when buffer decode fails (instead of incorrectly reporting `pass`).
- Refined signature-gate exception accounting:
  - insecure bypass on verification exception is now tracked as dedicated bypass accounting (`signatureBypassOnError`, `bypassReasons.signature_exception_insecure_bypass`)
  - bypass case is no longer classified as a drop reason
  - secure-mode signature exceptions remain explicit drop reasons.
- Extended `types/client.d.ts` `NaeuralOptions` with `commsDiagnostics` (`enabled`, `windowMs`, `netMonSampleRate`) to match runtime option usage.
- Added targeted tests in `tests/threads/message.thread.spec.js` and `tests/client.comms.spec.js` for non-Error funnel exceptions, buffer trace error outcome, signature exception bypass accounting, and commsDiagnostics option wiring.

### Version Bump Hygiene

- Synced `package-lock.json` version fields with `package.json` (`3.1.8`) via `npm install --package-lock-only`.
- Verified `npm pack --json` reports package version `3.1.8`.
- Bumped package version from `3.1.8` to `3.1.9` for the latest changes (`npm version patch --no-git-tag-version`).
- Verified `package-lock.json` top-level and `packages[""].version` are `3.1.9`.
- Verified `npm pack --json` reports package version `3.1.9`.

### Added (Comms Diagnostics / NET_MON Investigation)

- Added worker-thread comms diagnostics in `src/threads/message.thread.js` with 60s window summaries under prefix `[COMMS][JSCLIENT][thread=<id>][type=<threadType>]`.
- Added stage-by-stage counters for MQTT receive, buffer decode, signature gate, JSON parse, edge-node gate, fleet gate, formatter gate, decode, plus supervisor side-path counters.
- Added explicit drop reason accounting (`signature_invalid`, `signature_exception`, `parse_error`, `fleet_filtered`, `unknown_formatter`, `decode_exception`, etc.).
- Added sampled NET_MON trace correlation (default every 10th NET_MON candidate) with safe identifiers only (`EE_SENDER`, payload path head/signature, message id/seq).
- Added main-thread parity diagnostics in `src/client.js` with 60s summaries under prefix `[COMMS][JSCLIENT][main][initiator=<id>]`, including worker message totals by type and emission counters.
- Added per-thread boot-topic detail logging (topic, qos, clientId, share group/initiator, state manager, Redis channel) during `boot()`.

### Fixed

- Fixed `THREAD_START_ERR` constant value in `src/threads/message.thread.js` so it is distinguishable from `THREAD_START_OK`.
- Fixed boolean initialization for `encrypt`/`secure` in worker thread startup to honor explicit `false` values (`??` semantics).
- Fixed `pubSubChannel` initialization order in `src/client.js` so the fallback initiator is resolved before channel derivation (`updates-null` removed).
- Fixed signature debug mismatch (`debug` vs `debugMode`) so signature debug behavior is consistently activated.
- Normalized formatter handling across `_messageHasKnownFormat()` and `_decodeToInternalFormat()` using the same key normalization and safe fallback behavior for empty/case-variant formatter values.
- Added resilient RxJS funnel error handling so malformed messages are dropped and counted without terminating processing.

### Tests

- Added `tests/threads/message.thread.spec.js` (executed by current Jest config) covering signature bypass when `secure=false`, signature-failure/drop accounting with continued processing, and formatter empty/case-variant handling.
- Added `tests/client.comms.spec.js` covering `THREAD_START_ERR` non-running semantics and resolved-initiator Redis pub/sub channel naming.

### Documentation

- Updated `README.md` with comms diagnostics flags, log prefixes, gate/drop interpretation, and NET_MON loss debugging workflow.

### Added

- Added `AGENTS.md` with CBCB (critic-builder-critic-builder) iterative refinement guidance, evidence gates, and decision hygiene.
- Added `TODO.md` with prioritized fixes discovered during repository review (including automated npm publish on version change).
- Added `CHANGE_LOG.md` (this file).

### Synced With Published npm Package (`@naeural/jsclient@3.1.6`)

- Updated `package.json` version to `3.1.6`.
- Updated `package-lock.json` root/package versions to `3.1.6`.
- Synced from published tarball: `src/constants.js`.
- Synced from published tarball: `src/models/redis.state.manager.js`.
- Synced from published tarball: `src/threads/message.thread.js`.
- Synced from published tarball: `src/utils/redis.connection.provider.js`.
- Synced from published tarball: `tests/models/redis.state.manager.spec.js`.

### Documentation Overhaul

- Replaced placeholder `README.md` with an end-to-end, implementation-consistent guide.
- README now covers project purpose/architecture, runtime requirements, configuration, quick start, streams/events, `NodeManager` workflow, schema extensibility, blockchain identity/CLI usage, development commands, and CI/release behavior.

### Test Stability Fix

- Updated `tests/utils/helper.functions.spec.js` to validate encode/decode semantic correctness (`decode(encode(x)) === x`) instead of asserting one zlib-version-specific compressed base64 string.
- This resolves the CI failure in `Helper Function Tests -> PseudoPy Helpers Tests -> encode()` across different Node/zlib environments.

### Current Modified/Added Files Covered By This Entry

- Modified: `README.md`.
- Modified: `package.json`.
- Modified: `package-lock.json`.
- Modified: `src/constants.js`.
- Modified: `src/models/redis.state.manager.js`.
- Modified: `src/threads/message.thread.js`.
- Modified: `src/utils/redis.connection.provider.js`.
- Modified: `tests/models/redis.state.manager.spec.js`.
- Added: `AGENTS.md`.
- Added: `TODO.md`.
- Added: `CHANGE_LOG.md`.

### Discovered Issues (Pending Follow-Up)

- `.github/workflows/release.yml` creates GitHub releases but does not publish to npm.
- Release workflow assumes tags exist and may fail on repos with no prior tags.
- `src/client.js` initializes `redis.pubSubChannel` before fallback `initiator` generation, allowing `updates-null`.
- ESLint currently reports multiple errors in `src/` and `tests/`.
- `npm audit --omit=dev` reported production dependency vulnerabilities requiring updates and verification.
