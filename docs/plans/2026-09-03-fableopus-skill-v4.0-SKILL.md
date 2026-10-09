---
name: fableopus-controlled-build-pipeline
description: "Controlled build pipeline: Fable 5.1 plans with five-perspective analysis, Opus 5 reviews against a fixed checklist then builds, human gates approval and commit. Use when the user says 'run the Fable–Opus pipeline on …'."
---

**Version:** 4.0 · **Last updated:** 2026-09-03

## Roles

- **Fable**: Planner only. Produces multi-perspective analysis + precise implementation plan. Never writes production code.
- **Opus**: Critical reviewer of the plan (using fixed checklist), then builder. May only implement after full plan approval. Must flag any deviation.
- **Human**: Approves the plan, optionally triggers extra critique, gives final commit authorization, and owns retesting.

### Model mapping (current)

| Role | Model | Model ID |
| --- | --- | --- |
| Planner (step 1) + eyes-on (step 6) | Claude Fable 5.1 | `claude-fable-5-1` |
| Reviewer + builder (steps 3–5) | Claude Opus 5 | `claude-opus-5` |
| Human (step 2 + final gate) | — | approval and commit authorization |

Switch models by hand with `/model <id>`: `claude-fable-5-1` at steps 1 and 6, `claude-opus-5` at steps 3–5. Keep the per-step model explicit — a mid-pipeline `/model` mistake is how the planner-only rule leaks.

*Optional execution mode:* the Agent tool accepts a `model` override, so Fable may spawn an Opus subagent for the review/build instead of a manual switch. Not required; the manual `/model` switch is the default.

## Pipeline (strict sequence)

### 1. Human → Fable
Human provides the issue / problem / enhancement plus constraints, acceptance criteria, and any relevant context.

**Default behaviour:** Fable must produce the full multi-perspective analysis followed by the concrete plan.

**Tunable perspectives (important):**  
By default use all five perspectives below.  
Human may override with a short instruction such as:  
- “Use only inverted + adversarial + simplicity”  
- “Skip perspectives, this is mechanical”  
- “Full five perspectives + extra focus on security”  

If no override is given, always run all five.

**Mandatory multi-perspective analysis (unless overridden)**  
Fable writes a short, concrete section for each of these five lenses:

1. **Inverted view** — What happens if we deliberately do the opposite, minimize the change to near-zero, or refuse the request? What is the real cost of *not* solving it, or of solving it in the absolute simplest way?
2. **3-year answer** — How would this problem be solved (or dissolved) three years from now with expected improvements in tooling, architecture, product maturity, and team capability?
3. **5-year answer** — Looking five years ahead, what does the durable, low-maintenance, low-regret version of this capability look like? What would we regret having built the “quick” way?
4. **Simplicity & deletion lens** — What is the smallest change that still delivers ~80 % of the value? What existing code, process, configuration, or feature can be removed or simplified instead of adding more?
5. **Adversarial / failure lens** — How does this change fail in production, under load, with bad or malicious data, under attack, or when the next developer/agent touches it six months later? What are the irreversible or hard-to-detect risks?

**After the perspectives, Fable produces the implementation plan** using the exact artifact format below.

**Plan Confidence score (mandatory)**  
At the end of every plan Fable must include exactly this block and complete the sentence:

**Plan Confidence:** X/5  
**Biggest remaining uncertainty:** The single biggest remaining uncertainty is that

### 2. Human approval gate (+ optional parallel critique)
Human reviews the five perspectives (or the reduced set) and the plan.

- Request revisions until satisfied.
- **Optional high-stakes extra step:** Human may say “Run parallel adversarial Fable critique”. A second Fable session then attacks the plan. The critique is incorporated (or explicitly rejected) before final approval.
- Once approved, the plan is locked and becomes the single source of truth.
- **Record the approved plan:** Immediately write the full approved artifact (perspectives + plan + confidence score) to  
  `docs/plans/YYYY-MM-DD-short-title.md`  
  (create the directory if needed). This creates an audit trail and future context.

### 3. Approved plan → Opus
Hand the full approved plan (including perspectives and confidence score) to Opus with this instruction:

“Review this plan critically against the original issue, the five perspectives, and the Definition of Done.  
Use the Plan Review Checklist below.  
Output one of two results only:  
A) APPROVED — proceed to build  
B) CONFLICT — list specific problems and return to Fable.”

**Opus Plan Review Checklist (fixed)**  
Opus must explicitly address each item:
- [ ] Completeness of Definition of Done
- [ ] Test plan covers happy path + important failure / edge cases
- [ ] No unnecessary new external dependencies
- [ ] Scope matches the Goal and Non-goals
- [ ] Alignment with the Simplicity & deletion lens and the Adversarial lens
- [ ] Clear handling of the biggest uncertainty noted in the Plan Confidence score
- [ ] No contradictions with the 3-year or 5-year perspectives

### 4. Opus review loop
- If CONFLICT → Fable revises the plan. Human re-approves (and re-records the plan file if changed). Repeat until Opus issues APPROVED.
- If APPROVED → Opus proceeds to build.

### 5. Opus build
Opus implements strictly against the approved plan.

Rules:
- No scope expansion.
- Any necessary deviation must be explicitly flagged in the commit message **and** in a short “Deviations from Plan” section.
- After building, Opus runs (or clearly describes how to run) the tests defined in the plan and reports the results.
- Opus prepares the commit (message, files changed, summary of changes + deviations) but does **not** finalize or push the commit.

### 6. Fable eyes-on + Diff-against-perspectives check + human final gate
- Fable performs a short “eyes-on” review of the actual diff and test results.
- **Mandatory lightweight check:** Fable maps each of the five perspectives (or the reduced set that was used) to the final diff and explicitly flags any perspective that was ignored or weakly addressed.
- Human performs final review.
- Only after explicit human authorization (“commit”) does the commit happen.
- After commit, human (or a designated retest skill) retests in the target environment.

## Mandatory handoff artifact format
Every plan must be a self-contained markdown block using these exact headings, in this order:

```
## Perspectives used
## Goal
## Non-goals
## Context & constraints
## Proposed change (files & steps)
## New external dependencies
## Test plan
## Risks & rollback
## Definition of Done
## Plan Confidence
```

Under `## Plan Confidence`, reproduce the fixed block from step 1 exactly:

**Plan Confidence:** X/5  
**Biggest remaining uncertainty:** The single biggest remaining uncertainty is that

Opus review output must begin with either `APPROVED` or `CONFLICT` and must include the checklist results.

## Escalation & exceptions
- Human may short-circuit with “skip full pipeline” for trivial mechanical changes.
- If Opus discovers a fundamental flaw during build that the plan did not anticipate, it must stop, document the issue, and return to the review loop.
- Never commit without the final human authorization step.
- When perspectives are overridden, note the reduced set clearly at the top of the artifact so later steps remain consistent.

## Invocation
When the human says “Run the Fable–Opus pipeline on [issue]” (or equivalent), begin at step 1 and enforce the full sequence, version, artifact format, checklist, confidence score with completed uncertainty sentence, plan recording, and diff-against-perspectives check above.

When the human gives a perspectives override, honour it and record which perspectives were used.

## Changelog

- **4.0 (2026-09-03)** — Fable 5.1 / Opus 5 pinned; artifact headings defined; description fixed.
