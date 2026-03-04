# AGENTS.md

Repository guidance for human and AI contributors.

## Objective

Use an iterative CBCB loop (Critic -> Builder -> Critic -> Builder) to maximize delivery speed while protecting correctness, compatibility, and operational safety.

## CBCB Workflow

### Pass 1: Critic (Specification + Risk Model)

Required outputs before editing:

- A concrete task contract (inputs, outputs, acceptance criteria).
- Compatibility boundaries (public API, runtime behavior, config shape, docs/types impact).
- A risk register with explicit failure modes.
- An evidence plan (tests, lint, type checks, targeted runtime checks).

SotA practices:

- Build an assumption ledger and mark each assumption as verified/unverified.
- Use counterexample generation: actively ask how the change can fail in production.
- Define invariants that must remain true after edits.

### Pass 2: Builder (Minimal Viable Change)

Implementation rules:

- Make the smallest coherent patch that satisfies the contract.
- Preserve export names and behavior unless change is intentional and documented.
- Prefer deterministic logic and explicit errors over implicit behavior.
- Add/adjust tests with the same patch when behavior changes.

Artifacts:

- Focused diff.
- Updated tests/docs/types if affected.

### Pass 3: Critic (Adversarial Diff Review)

Review the produced diff as an attacker and as a maintainer.

Mandatory checks:

- Correctness regressions.
- Race/concurrency issues (worker threads, async state updates, pub/sub ordering).
- Security/crypto/message integrity risks.
- Error-path handling and observability quality.
- Test sufficiency for changed paths.
- Documentation and type declaration consistency.

SotA practices:

- Differential reasoning: compare old vs new behavior for edge inputs.
- Invariant replay: explicitly test previously defined invariants.
- Negative testing: validate malformed, partial, and stale-state inputs.

### Pass 4: Builder (Hardening + Refinement)

Refine only what is justified by Pass 3 findings.

- Fix discovered defects.
- Tighten tests around discovered edge cases.
- Reduce complexity where it increases reliability.
- Synchronize README/API/types with final behavior.

Stop when:

- Acceptance criteria are met.
- Risks are reduced to acceptable levels and documented.
- No unresolved high-severity findings remain.

## Decision Hygiene

- Record a short decision log for non-obvious tradeoffs.
- Report residual risk explicitly instead of implying certainty.
- Include a confidence statement tied to executed evidence.

## Evidence Gates

Run these before finalizing:

```bash
npm test
npx eslint "{src,tests}/**/*.js"
npm run generate:typedefs
```

If relevant to the change:

- `npm run test:coverage`
- `npm audit --omit=dev`

## Repo-Specific Guardrails

- Blockchain and message envelope code is security-sensitive. Avoid silent signature/encryption format changes.
- `Naeural` and worker thread behavior must remain stable under concurrent stream load.
- `REDIS_STATE_MANAGER` changes must preserve cross-process routing semantics.
- Node/pipeline command generation must remain backward-compatible with existing Naeural nodes.
- Keep patches focused; avoid unrelated refactors in the same change set.

## Review Output Standard

When performing reviews:

- List findings first, ordered by severity.
- Include precise file and line references.
- Separate confirmed defects from assumptions/questions.
- Keep summaries short and actionable.

## Definition Of Done

- Contract satisfied.
- Evidence gates executed (or explicitly skipped with reason).
- Docs and typings match the final runtime behavior.
- Residual risk and follow-up items are documented.
