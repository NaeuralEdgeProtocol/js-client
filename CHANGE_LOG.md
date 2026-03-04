# CHANGE_LOG

## [Unreleased] - 2026-03-04

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
