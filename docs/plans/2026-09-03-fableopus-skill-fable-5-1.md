# Fable–Opus pipeline — Step 1 artifact
## Issue: Revise `fableopus-controlled-build-pipeline` skill to Fable 5.1
Perspectives used: **all five (default)**. Planner: Claude Fable 5.1. Date: 2026-09-03.

> Audit note (2026-10-09): this record was first written on 2026-09-03 and lost to a container
> restart before the authorised commit executed; it is re-materialised verbatim from the approved
> artifact. The Opus review returned APPROVED on all seven checklist items; the build passed 6/6
> runnable tests; the persistence test was DEFERRED and subsequently FAILED (the synced skill
> reverted to v3.3 on the next sync) — the durable copy of the revision is the companion file
> `2026-09-03-fableopus-skill-v4.0-SKILL.md`, to be applied at the skill's source.

---

## Perspectives

### 1. Inverted view
Do nothing: the skill still "works" because its roles are model-agnostic names, and `/model` switching is done by hand anyway. The real cost of not revising is not the model name — it's two latent defects: (a) the frontmatter `description` is the whole body header jammed into YAML, so the skills list shows `**Version:** 3.3 … ## Roles` as the trigger text (ugly, and weakens triggering); (b) the **artifact-format section is empty** — "using these exact headings:" lists no headings — so every plan invents its own shape and the Opus checklist ("Goal", "Non-goals", "Definition of Done", "Test plan") references sections that are never guaranteed to exist. The absolute-simplest fix (description + headings only) already delivers most of the value; the Fable 5.1 rename is the cheap part.

### 2. 3-year answer
Model names churn every 6–12 months; a skill that hardcodes "Fable 5.1" everywhere is rewritten at each release. The durable shape is a **role contract** (planner / reviewer-builder / human) plus a small **current-model mapping table** updated in one place. Also — available *today*, not in 3 years — the Agent tool accepts a `model` override (`fable`, `opus`), so the handoff can be automated: Fable plans, spawns an Opus subagent for review/build, Fable does eyes-on. Worth noting as an optional execution mode; not required for this revision.

### 3. 5-year answer
The low-regret version: role contract + mapping table + a **machine-checkable artifact template** (fixed headings the reviewer can assert against). What we'd regret building "quick": scattering model IDs through the prose, and leaving the headings implicit so the checklist stays un-enforceable.

### 4. Simplicity & deletion lens
Smallest change delivering ~80%: (1) one-line trigger description in frontmatter; (2) move Version/Roles into the body; (3) add the missing headings list; (4) a 3-row model table; (5) bump version/date. **Delete** the duplicated Roles blob from the description. Add no new process steps.

### 5. Adversarial / failure lens
- This is a **synced** skill (`skills/synced/<ids>/`): a local edit may be silently overwritten by the next sync — the edit may need to be made at the sync source. Hard-to-detect: the skill quietly reverts.
- YAML frontmatter with `**`, `##`, and quotes inside a quoted string is fragile; a bad edit can make the skill fail to load entirely. Validate the YAML.
- "Opus" unpinned → a future agent may pick Opus 4.x vs 5; pin IDs.
- Headings must match the Opus checklist vocabulary exactly, or the checklist remains un-applyable.
- A mid-pipeline `/model` mistake lets the planner-only rule leak (Fable builds). Make the per-step model explicit.

---

## Goal
Make the skill accurate for the current models and functionally complete: clean trigger description, Fable 5.1 / Opus 5 pinned with per-step `/model` guidance, the missing artifact headings defined, version bumped.

## Non-goals
- No change to the six-step process, the checklist, or the confidence block.
- No automation of the Fable→Opus handoff (Agent-tool routing noted only as an optional mode).
- No edits to any repo code.

## Context & constraints
- File: `/root/.claude/skills/synced/1670aa00-…/fableopus-controlled-build-pipeline/SKILL.md` (only file in the skill).
- Current: Version 3.3, updated 2026-08-12; description = body blob; artifact headings missing.
- Constraint: synced-skill overwrite risk — confirm persistence or edit at source.

## Proposed change (files & steps)
`SKILL.md` only:
1. **Frontmatter:** `description:` → one line: *"Controlled build pipeline: Fable 5.1 plans with five-perspective analysis, Opus 5 reviews against a fixed checklist then builds, human gates approval and commit. Use when the user says 'run the Fable–Opus pipeline on …'."*
2. **Body header (new):** `**Version:** 4.0 · **Last updated:** 2026-09-03`, then **Roles** (moved from description) with a **Model mapping** table: Planner/eyes-on = Claude Fable 5.1 (`claude-fable-5-1`); Reviewer/builder = Claude Opus 5 (`claude-opus-5`); Human = approval + commit. Add "switch with `/model <id>` at steps 1, 3–5, 6" and one line on the optional Agent-tool `model` override.
3. **Fix the broken section:** under *Mandatory handoff artifact format*, insert the exact headings: `## Perspectives used`, `## Goal`, `## Non-goals`, `## Context & constraints`, `## Proposed change (files & steps)`, `## New external dependencies`, `## Test plan`, `## Risks & rollback`, `## Definition of Done`, `## Plan Confidence` (with the fixed confidence block). Keep the following "Opus review output must begin with APPROVED/CONFLICT" sentence.
4. **Changelog line** (4.0): "Fable 5.1 / Opus 5 pinned; artifact headings defined; description fixed."

## New external dependencies
None.

## Test plan
- Happy path: `Skill` tool loads the skill without a YAML error; skills listing shows the new one-line description.
- YAML validity: parse the frontmatter with a YAML parser (python `yaml.safe_load`) — must succeed.
- Grep: no remaining `Version: 3.3`, no `## Roles` inside the frontmatter, headings list present under the artifact section.
- Dry run: invoke the pipeline on a toy issue and confirm the produced plan carries every heading and the confidence block.
- Failure case: deliberately malformed frontmatter → confirm the skill fails to load (proves the validity test is meaningful), then restore.
- Persistence: re-open a fresh session after the next skills sync and confirm the edit survived (the biggest uncertainty).

## Risks & rollback
Risk: sync overwrite (mitigation: verify persistence; if reverted, apply at the sync source). Rollback: the file is a single markdown document — restore the prior version from this artifact's "Current" notes or git history if tracked.

## Definition of Done
- [x] Frontmatter description is a single trigger-oriented line; YAML valid.
- [x] Version 4.0 / 2026-09-03 in body; Roles + model mapping table present with pinned IDs.
- [x] Artifact headings list present and matches the Opus checklist vocabulary.
- [x] Skill loads; listing shows the clean description.
- [ ] Persistence after sync confirmed (or edit applied at source). — **FAILED on sync; apply the companion v4.0 file at source.**

**Plan Confidence:** 4/5
**Biggest remaining uncertainty:** The single biggest remaining uncertainty is that this is a *synced* skill, so a local edit to `SKILL.md` may be silently overwritten by the next skills sync and the revision needs to be applied at the sync source (the skill's home in your claude.ai skills library) rather than in this container.

---

## Opus review (step 3) — APPROVED, 7/7 checklist items
Build (step 5) tests: YAML validity PASS · grep PASS · headings/static dry-run PASS · negative malformed-frontmatter test PASS (two malformations each rejected by the parser) · preservation of all 6 steps, 7 checklist items, confidence block and APPROVED/CONFLICT sentence PASS (mechanical) · skill loads with new description PASS · persistence DEFERRED → later FAILED (see audit note).
Deviations from plan (accepted at step 6): negative test run on copies not the live file; changelog rendered as a `## Changelog` section; trailing newline added.

## Fable eyes-on (step 6) — diff-against-perspectives
Inverted ✅ · 3-year ✅ · 5-year ✅ · Simplicity ✅ · Adversarial ⚠️ weakly addressed by necessity — the sync-overwrite risk was untestable in-container and did materialise. Human authorised "commit" 2026-09-03.
