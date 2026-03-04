# TODO

Last updated: 2026-03-04

## Critical

- [ ] Fix `pubSubChannel` initialization order bug in `src/client.js` (around lines 333 and 336). Ensure `initiator` is resolved before building `redis.pubSubChannel` so Redis channels are never `updates-null`.
- [ ] Add automated npm publish on version change in `.github/workflows/release.yml`. Keep test/coverage/release steps, then publish with `NODE_AUTH_TOKEN` only when `package.json` version changed.
- [ ] Make release workflow robust when no tags exist yet in `.github/workflows/release.yml` (around lines 40 and 55).

## High

- [ ] Address production dependency vulnerabilities found by `npm audit --omit=dev`, especially `js-yaml` and `elliptic`, then re-run audit and tests.
- [ ] Stabilize compression test in `tests/utils/helper.functions.spec.js` (around line 31) to avoid Node-version-sensitive byte snapshots.

## Medium

- [ ] Resolve existing ESLint errors in `src/` and `tests/` and enforce lint in CI.
- [ ] Replace thrown string with `Error` object in `src/client.js` (around line 1034).
- [ ] Review unused variables and dead test code flagged by lint in `src/utils/blockchain.js` and `tests/utils/blockchain.spec.js`.

## Validation

- [ ] `npm test`
- [ ] `npx eslint "{src,tests}/**/*.js"`
- [ ] `npm run test:coverage`
- [ ] `npm audit --omit=dev`
