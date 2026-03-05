# COMMS_DEBUG

Date: 2026-03-05

## Pass 1 - Critic (Specification + Risk Model)

### Task Contract

- Inputs:
  - `local_data/netmon_42.json`
  - `local_data/netmon_51.json`
- Required output:
  - Determine how each payload behaves at the js-client signature gate for NET_MON_01 processing.
  - Produce a reproducible simulation plan and execute it.
  - Record findings and final conclusions.
- Acceptance criteria:
  - Use real code paths from this repository for signature verification and message funneling.
  - Show whether each payload is accepted or dropped at `signature_gate`.
  - Explain any mismatch between expected and observed behavior.

### Compatibility Boundaries

- Public API unchanged.
- Runtime-sensitive paths reviewed (no edits):
  - `src/utils/blockchain.js::verify()`
  - `src/threads/message.thread.js::_messageIsSigned()`
  - `src/threads/message.thread.js::_stageSignatureGate()`
- No change to config shape or message format in this investigation.

### Assumption Ledger

- Verified: NET_MON messages are detected via `EE_PAYLOAD_PATH[2] === NET_MON_01` in `message.thread`.
- Verified: signature gate executes before JSON parse and before NET_MON supervisor handling.
- Verified: signature verification in `NaeuralBC.verify()` hashes the message with `EE_SIGN`, `EE_SENDER`, `EE_HASH` removed.
- Unverified: whether the two local payload files are byte/field identical to what arrived on MQTT wire.

### Risk Register (Failure Modes)

- `R1`: Input samples are post-processed and differ from on-wire payload, causing false negatives.
- `R2`: Signature validity and hash validity may diverge (valid signer over stale hash).
- `R3`: Investigation could be misread if we only run direct `verify()` and skip funnel simulation.
- `R4`: Any accidental code mutation in signature/comms path would invalidate conclusions.

### Invariants

- `I1`: `secure=true` means `_stageSignatureGate()` drops when `NaeuralBC.verify()` is `false`.
- `I2`: Signature gate drop reason for bad verification is `dropReasons.signature_invalid`.
- `I3`: When signature gate fails, later stages (parse/fleet/formatter/decode) must not run.

### Evidence Plan

1. Review signature/blockchain and comms funnel modules end-to-end.
2. Run direct cryptographic checks on both payloads.
3. Simulate arrival through `Thread` funnel stages (`secure=true`), using MQTT-like envelope payload buffers.
4. Run targeted normalization probes to test whether a narrow field filter recovers expected acceptance.
5. Record residual risks and confidence level.

## Pass 2 - Builder (Minimal Viable Investigation Plan)

Simulation procedure (executed):

1. Load each JSON payload exactly as provided.
2. Run `NaeuralBC.verify(rawJson)`.
3. Simulate message arrival:
   - create funnel envelope (`_createFunnelEnvelope`)
   - run `_stageBufferToString`
   - run `_stageSignatureGate`
   - continue stages only if signature gate passes.
4. Compare stage counters and drop reasons.
5. Probe normalization hypotheses:
   - remove `TIMESTAMP_ARRIVAL`
   - rerun verification and funnel simulation.
6. For forensic clarity, also verify whether `EE_SIGN` is valid for the received `EE_HASH` value.

## Pass 3 - Critic (Adversarial Diff Review / Executed Findings)

### Code Paths Reviewed

- `src/utils/blockchain.js`
  - `verify()` computes SHA-256 over stable-stringified payload without `EE_SIGN`, `EE_SENDER`, `EE_HASH`.
  - Returns `hashMatch && signatureMatch`.
- `src/threads/message.thread.js`
  - `_messageIsSigned()` calls `naeuralBC.verify()`.
  - `_stageSignatureGate()` increments counters and drops with `signature_invalid` when verification fails.
  - Signature gate occurs before JSON parse and decode.

### Executed Simulation Summary

Reference execution artifact: `/tmp/netmon_simulation_results.json`

| Case | Hash Matches | `verify()` | Signature Gate | Result |
|---|---:|---:|---:|---|
| `42_raw` | no | false | drop | dropped at signature gate (`signature_invalid`) |
| `42_minus_timestamp_arrival` | yes | true | pass | accepted through decode |
| `51_raw` | no | false | drop | dropped at signature gate (`signature_invalid`) |
| `51_minus_timestamp_arrival` | no | false | drop | still dropped at signature gate |

### Additional Checks

- For both raw payloads, `EE_SIGN` is valid for the provided `EE_HASH` (`verifyAgainstReceivedHash=true`).
- Therefore, signer identity/signature are intact, but payload hash recomputation fails in js-client for both raw files.
- Single-field recovery probe:
  - `netmon_42`: removing only `TIMESTAMP_ARRIVAL` makes hash and verify pass.
  - `netmon_51`: no single-field removal matched.
- Double-field recovery probe:
  - no matching pair for `netmon_42` or `netmon_51`.

## Pass 4 - Builder (Hardening + Refinement)

### Findings

1. `netmon_42.json` as provided is **not** accepted by current js-client signature verification.
2. `netmon_42.json` becomes valid if `TIMESTAMP_ARRIVAL` is filtered out before signature verification.
3. `netmon_51.json` remains invalid even with the same `TIMESTAMP_ARRIVAL` filtering.
4. Both payloads carry cryptographically valid signatures over their embedded `EE_HASH`; failure is hash/payload canonical-content mismatch at verification time.

### Final Conclusions / Insights

- The NET_MON acceptance difference is consistent with a payload-filtering/canonicalization mismatch, not with broken key signatures.
- A narrow filter (`TIMESTAMP_ARRIVAL`) is sufficient to recover `4.2` sample acceptance, but insufficient for `5.1`.
- This supports the initial expectation directionally (`4.2` recoverable, `5.1` not), with the important caveat that **raw local files are both rejected unless filtering is applied before verification**.

### Residual Risk

- Because local files may be post-processed snapshots (not guaranteed wire-identical), conclusions about production behavior should be validated with true on-wire MQTT captures.

### Confidence Statement

- Confidence: medium-high for js-client behavior on the provided files (direct code-path simulation and cryptographic checks executed).
- Confidence: medium for upstream root-cause attribution (depends on whether local samples preserve exact wire payload fields/order/content).
