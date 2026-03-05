# COMMS_DEBUG

Date: 2026-03-05

## Scope

Investigate NET_MON_01 signature/hash behavior for:

- `local_data/netmon_42.json`
- `local_data/netmon_51.json`

with corrected assumption that `TIMESTAMP_ARRIVAL` in `42` must be kept as-is.

## Contract

- Determine acceptance at js-client signature gate for both payloads.
- Identify root cause for hash mismatch.
- Validate with direct `NaeuralBC.verify()` and message-thread funnel simulation.
- Produce a JS-side compatibility solution for mixed producer hashing styles.

## Compatibility Boundaries

- Keep Python producer unchanged.
- Keep signature integrity strict: pass only when signature verifies against a recomputed, approved canonical hash.
- No bypass that accepts signature over received hash without payload-hash consistency.

## Re-run Findings (Corrected)

### Direct verification

- `netmon_42.json`: `verify(raw) == true`
- `netmon_51.json`: `verify(raw) == false`

### Funnel simulation (`Thread` signature gate)

- `netmon_42.json`: signature gate pass (`signaturePass=1`, no drop reason)
- `netmon_51.json`: signature gate drop (`dropReasons.signature_invalid=1`)

### Hash reconstruction matrix

For both payloads, hash is computed over payload without `EE_SIGN`, `EE_SENDER`, `EE_HASH`.

- `42`:
  - JS canonical (`json-stable-stringify`): matches `EE_HASH`
  - Python canonical (`json.dumps(sort_keys=True,separators=(',',':'))`): does not match
- `51`:
  - JS canonical: does not match
  - Python canonical: matches `EE_HASH`

### Signature integrity split

- Both payloads have valid `EE_SIGN` for the embedded `EE_HASH`.
- For `51`, signature does not verify against JS-recomputed hash because canonicalization differs.

## Root Cause

Mixed producer canonicalization standards:

- JS-side canonicalization emits integral numeric values as `0`, `41`, etc.
- Python canonicalization (for float-typed values) emits `0.0`, `41.0`, etc.

`netmon_42` was signed with JS-style canonicalization.
`netmon_51` was signed with Python-style canonicalization.

Because js-client previously verified only JS-style canonicalization, `51` failed hash match.

## Concrete Examples

- `42`: [netmon_42.json:6](/home/andrei/work/js-client/local_data/netmon_42.json:6) has `"SCORE": 0.0`, but the signed hash corresponds to JS-canonical payload where integral floats collapse to `0`.
- `51`: [netmon_51.json:6](/home/andrei/work/js-client/local_data/netmon_51.json:6) has `"SCORE": 0.0`, and `EE_HASH` at [netmon_51.json:2243](/home/andrei/work/js-client/local_data/netmon_51.json:2243) matches Python canonical form preserving `.0`.

## JS-side Fix Implemented

Updated `src/utils/blockchain.js::verify()` to check two approved canonicalization modes:

1. Existing JS stable canonical hash (`json-stable-stringify`).
2. Python-compatible canonical hash built from stable key ordering plus raw numeric lexemes extracted from incoming JSON (`JSON.parse` reviver `context.source`, Node 22).

Validation rule remains strict:

- Recompute candidate hashes.
- Require `received EE_HASH` to match one candidate.
- Verify signature against that exact matching hash.
- Return false otherwise.

This preserves security invariants while accepting either producer style.

## Tests Added

In `tests/utils/blockchain.spec.js`:

- Accepts python-style canonical hash when payload contains integral float lexemes (`0.0`, `2.0`).
- Rejects tampered python-style payload when hash/signature are stale.

## Evidence Gates

Executed:

- `npm test` (pass)
- `npx eslint "{src,tests}/**/*.js"` (pass)
- `npm run generate:typedefs` (pass)

Version/packaging hygiene:

- Bumped `package.json` patch version to `3.1.18`.
- Verified lockfile versions match `3.1.18`.
- `npm pack --json` verified with `NPM_CONFIG_CACHE=/tmp/.npm-cache` due local npm cache permission issue.
- Tarball hygiene check: no accidental inclusions.

## Residual Risk

- Python-compatible path relies on `JSON.parse` reviver `context.source` support (available in Node 22 used here). If runtime node versions vary, compatibility should be validated in CI/runtime matrix.

## Confidence

- High confidence for identified root cause and implemented mitigation, supported by direct hash/signature matrix and end-to-end tests.
