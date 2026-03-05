# CHANGELOG

## [Unreleased] - 2026-03-04

### Fixed (Dual Signature Canonicalization Compatibility)

- Updated `src/utils/blockchain.js::verify()` to support two strict hash canonicalization strategies before signature acceptance:
  - existing JS stable canonicalization (`json-stable-stringify` behavior)
  - Python-compatible canonicalization preserving incoming numeric lexemes (for integral floats like `0.0`)
- Added path-aware numeric-lexeme extraction using `JSON.parse` reviver `context.source` and deterministic canonical re-encoding for Python-compatible hash recomputation.
- Preserved security invariant: message is accepted only if `EE_HASH` matches an approved recomputed hash candidate and signature verifies against that exact candidate hash.
- Added `tests/utils/blockchain.spec.js` coverage for:
  - acceptance of valid Python-style canonicalized payload signatures
  - rejection of tampered payloads with stale hash/signature (no signature-over-received-hash bypass)

### Deep Dive (NET_MON Hash Mismatch Root Cause)

#### Simple Explanation

- Different producers used different rules for converting JSON into the exact text that is hashed.
- The payload content can be semantically identical, but the hash can still differ if number formatting differs (for example `0.0` vs `0`).
- The JS verifier originally accepted only the JS-style canonical string, so payloads signed with Python-style canonicalization were dropped as `signature_invalid`.

Think of it as two people reading the same table of values, but one writes `0.0` and the other writes `0` before computing the checksum. Same meaning, different bytes, different hash.

#### Technical Description

- Verification removes envelope signature fields (`EE_SIGN`, `EE_SENDER`, `EE_HASH`) and hashes the remaining payload.
- Original js-client path used JS canonicalization (`json-stable-stringify` + JavaScript number rendering).
- Python producers can emit canonical JSON via `json.dumps(sort_keys=True, separators=(',', ':'))`, which preserves integral-float lexemes such as `0.0`, `41.0`.
- For mixed fleets, both canonicalization strategies existed in live payloads:
  - JS-style signed payloads verify against JS canonicalization.
  - Python-style signed payloads verify against Python canonicalization but fail JS canonicalization.

#### Concrete Examples

- `local_data/netmon_42.json`
  - `EE_HASH`: `e13daf79e4b5092a906d61d6fe511648dc65f5fa542d29ea936e6956e913462d`
  - JS canonical hash (no `EE_SIGN/EE_SENDER/EE_HASH`): same as `EE_HASH` (pass)
  - Python canonical hash: `969d7b358e07361c19190a95278d91342196bb24b40277641ba4fca7f2260e43` (mismatch)
  - Example integral float lexeme in payload: `"SCORE": 0.0`

- `local_data/netmon_51.json`
  - `EE_HASH`: `bb165b652df2ce19d6f38ebddfe9d2fbf6dc9fa0a55239921df759c900db57f2`
  - JS canonical hash (no `EE_SIGN/EE_SENDER/EE_HASH`): `0c9238a0fc7a8685f974170d449bc2ae60fd93320f48a637aeac5ea24c39d794` (mismatch)
  - Python canonical hash: same as `EE_HASH` (pass)
  - Example integral float lexeme in payload: `"SCORE": 0.0`

#### Why Signature Was Still Valid

- In both payloads, `EE_SIGN` correctly verifies against the embedded `EE_HASH`.
- Failure happened when js-client recomputed a different hash for `netmon_51` than the one used by its producer.
- This confirms the issue was canonicalization mismatch, not compromised keys or corrupted signatures.

#### Solution Implemented in JS

- `NaeuralBC.verify()` now computes two approved hash candidates:
  1. Existing JS stable canonicalization.
  2. Python-compatible canonicalization preserving numeric lexemes from incoming JSON.
- Acceptance rule remains strict:
  - `EE_HASH` must match one approved candidate hash.
  - Signature must verify against that exact matching candidate hash.
- Security is not weakened by this change:
  - no blind trust of `EE_HASH`
  - no bypass that accepts stale hash/signature pairs after payload tampering.

#### Result

- Payloads signed by either producer style now verify correctly, if and only if signature and hash are consistent for one approved canonicalization path.

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
- Added `CHANGELOG.md` (this file).

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
- Added: `CHANGELOG.md`.

### Discovered Issues (Pending Follow-Up)

- `.github/workflows/release.yml` creates GitHub releases but does not publish to npm.
- Release workflow assumes tags exist and may fail on repos with no prior tags.
- `src/client.js` initializes `redis.pubSubChannel` before fallback `initiator` generation, allowing `updates-null`.
- ESLint currently reports multiple errors in `src/` and `tests/`.
- `npm audit --omit=dev` reported production dependency vulnerabilities requiring updates and verification.
