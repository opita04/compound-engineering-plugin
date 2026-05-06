---
date: 2026-05-06
topic: ce-replan-beta-skill
---

# `ce-replan-beta` Skill

> **⚠ Superseded.** This document is the v1 design. Live design lives in `docs/brainstorms/2026-05-06-ce-replan-skill-rebrainstorm-requirements.md` (`revision: 2`). Kept here as the historical snapshot that drove the v1 implementation on PR #785; the v2 Shape section below also captures the cora-session reasoning that motivated the rewrite.

## Summary

A new beta skill (`ce-replan-beta`) that, when an existing PR's approach has been outgrown by new learnings, runs a two-phase **re-brainstorm → re-plan** cycle and produces a fresh plan that always starts from `main`. Phase one forks the original `*-requirements.md` into a new dated requirements doc, carrying R-IDs forward stably so traceability survives across revolutions of the loop. Phase two derives a full-redo plan from the updated requirements. Original PR, plan, and brainstorm are preserved as superseded artifacts; no Git execution. Ships under the plugin's beta-skills framework so the contract can mature before promotion to a stable `ce-replan`.

> **v2 Update (2026-05-06):** This summary reflects the post-cora-session shape. The first real run on `cora` PR #2382 surfaced that v1's delta-shaped output didn't match the user's verb — they corrected with *"no it replan so start from main no base don we redo the full plan."* v1 produced one combined plan doc with re-grounding sections. v2 splits requirements and plan into two artifacts (mirroring `ce-brainstorm` → `ce-plan`), always does a full redo from main, and forks the brainstorm so the compounding loop has a stable source of truth at the requirements layer. The v1 design below is preserved as historical context; the **v2 Shape** section captures the deltas.

---

## v2 Shape — Always Full Redo + Re-Brainstorm Phase

Source: cora session `10b929fb-c03f-4daf-b675-32c00ac44b43` (PR #2382, 2026-05-06). v1 of the skill produced a delta-shaped plan against the existing PR's tree; the user corrected with *"no it replan so start from main no base don we redo the full plan."* v2 makes "always full redo" the only shape and adds a re-brainstorm phase so the compounding loop has a stable source of truth at the requirements layer.

### v2 Requirements (additions and revisions)

The IDs below extend the v1 list. Where v2 supersedes a v1 requirement, the v1 ID is left in place and a `v2` note points to the replacement so traceability is preserved.

**Two-phase flow**
- R11. The skill runs as two sequential phases: **re-brainstorm** (re-question the requirements) followed by **re-plan** (derive the implementation plan from the updated requirements). The shape mirrors the original `ce-brainstorm` → `ce-plan` handoff but is anchored to existing artifacts and learnings.
- R12. Each phase has its own synthesis checkpoint in interactive mode. They are presented sequentially, not combined — confirming requirement edits and plan units in the same breath conflates WHAT and HOW, which the brainstorm/plan separation exists to prevent.
- R13. In pipeline mode (LFG / `disable-model-invocation`), both phases run silently. Inferred bets route to a `## Assumptions` section in each artifact (the new requirements doc and the new plan doc). Neither phase blocks.

**Re-brainstorm phase — fork, not mutate**
- R14. The re-brainstorm phase forks a new dated `docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md` that supersedes the original by reference. The original brainstorm is **never edited or deleted on disk**, mirroring how the skill already preserves the original plan and PR.
- R15. **R-IDs carry forward stably across the fork.** R1 in the original stays R1 in the v2 brainstorm; revised requirements keep their ID with updated wording; discarded requirements leave a gap (R3 absent is fine — gaps are how the loop stays auditable). New requirements get the next-unused R-ID, never a renumber.
- R16. The forked brainstorm's frontmatter names the original via `supersedes:` (filename or path) and includes `revision:` (e.g., `2`) so the loop's revolution count is visible.
- R17. When no original brainstorm exists for the PR (plans coming from scratch are valid), the re-brainstorm phase is skipped and the skill proceeds directly to re-plan, matching v1 behavior. The skill does not synthesize a brainstorm out of thin air for a plan that never had one.

**Re-plan phase — always full redo (supersedes v1's R-grounding-in-plan model)**
- R18. The re-plan phase derives the new plan from the freshly-forked brainstorm (or from the original, when the re-brainstorm phase was skipped per R17). The output plan is a **full redo from `main`**, not a delta layered on the existing PR's tree.
- R19. Plan units **must not** reference code, IDs, or designs that exist only on the existing PR's branch unless explicitly identified as cherry-pick targets. The cora session failed exactly this constraint: v1's units referenced post-pivot code that did not exist on `main`, and ce-work caught the mismatch.
- R20. The Cherry-Pick Guidance section (carried from v1's R6) names what to preserve from the existing PR, but each unit's `Files:`, `Approach:`, and code references are written for the from-`main` baseline. A unit may say "create file X" when X exists on the PR's branch but not on `main` — the unit produces it from cherry-picking, the plan does not assume X is already there.

**Discovery for full-redo**
- R21. The discovery phase categorizes prior plans by merge state. A plan whose commits are all reachable from `main` is treated as merged context; plans with unmerged units must be folded into the new plan's coverage so a full-redo doesn't lose in-flight work. The cora session had two prior plans (May 4 sidecar + May 5 collapse), and the second's units were partially landed on the PR but not on `main` — the new plan needed to acknowledge both.

**Polish from cora session**
- R22. `scripts/fetch-pr-context.sh` surfaces missing-key conditions in its jq processing rather than emitting empty stdout that the agent silently absorbs. Use `// null` defaults or per-key probes so a missing field produces a structured note instead of a silent gap. (Three jq exit-5 errors during the cora run; synthesis recovered, but a different shape of missing data could have produced wrong output.)
- R23. The handoff phase commits to a branch base for downstream `ce-work` (always `main`, per R18) and does not present a sequencing question that ce-work then re-asks. The cora run had near-duplicate questions from both layers; the second one drew the user's correction.
- R24. The skill does not volunteer an unsolicited "what is not in this plan" summary after writing the doc. The cora run produced one and accompanied it with a self-edit ("Plan updated to reflect option 2"), making the transcript hard to reason about. Write the artifacts, present the handoff options, stop.

**Effect on v1 requirements**
- R3 (re-derive problem frame) and R4 (synthesis checkpoint) are now scoped per-phase: each of the re-brainstorm and re-plan phases performs them, gated independently.
- R5 (single combined plan doc) is **superseded by R11/R14/R18**: v2 produces two artifacts (forked brainstorm + new plan), not one combined doc.
- R10 (no silent inheritance — every original requirement annotated) **moves up** to the re-brainstorm phase. The forked brainstorm is the surface where requirements are marked unchanged/revised/discarded, with stable R-IDs (R15). The plan doc no longer carries the per-requirement annotation block; it just references R-IDs from the forked brainstorm.

### v2 Acceptance Examples (additions)

- AE6. **Covers R11, R12.** Given an existing PR with a discoverable original brainstorm, when the user invokes `/ce-replan-beta`, the skill produces two synthesis checkpoints in sequence (re-brainstorm synthesis, then re-plan synthesis) and writes two output artifacts.
- AE7. **Covers R14, R15, R16.** Given an original brainstorm at `docs/brainstorms/2026-05-04-cora-v2-briefed-requirements.md` with R1–R6, when the re-brainstorm phase decides to revise R3, discard R5, and add a new requirement, the forked brainstorm at `docs/brainstorms/2026-05-06-cora-v2-briefed-requirements.md` carries R1, R2, R3 (revised wording), R4, R6, R7 (new). The gap at R5 is preserved. Frontmatter names the original via `supersedes:` and `revision: 2`.
- AE8. **Covers R17.** Given a plan with no origin brainstorm, when `/ce-replan-beta` runs, the skill skips the re-brainstorm phase and writes only a new plan doc.
- AE9. **Covers R18, R19.** Given a PR's branch contains code at `app/foo.rb` that does not exist on `main`, when the re-plan phase runs, plan unit `Files:` and `Approach:` references treat `app/foo.rb` as something the new branch will create (potentially via cherry-pick from the original PR), not as something already in the tree.
- AE10. **Covers R23.** Given the user invokes `/ce-replan-beta` and selects "Start ce-work" from the handoff menu, when ce-work begins, it does not re-ask which branch base to use — the base is `main`, committed by the replan handoff.

### v2 Scope Boundaries (additions)

- Mutating the original brainstorm in place is out of scope. Forking is the contract.
- Combining the re-brainstorm and re-plan synthesis checkpoints into a single confirmation is out of scope. They are sequential by design.
- Synthesizing a brand-new brainstorm for a PR that never had one is out of scope. The skill operates on existing artifacts; if there's no brainstorm, it goes straight to re-plan.
- Delta-shaped plans (units written against the existing PR's tree) are out of scope. Always full redo from `main`.
- Editing the original requirements doc is out of scope (parallel to the existing rule about original plan and PR being read-only).

### v2 Key Decisions

- **Always full redo, no shape question.** The verb "replan" maps to "redo from main" in user mental models. The cora session confirmed it. Adding a shape question would let the failure mode resurface; defaulting to delta-shape silently is what produced the cora friction in the first place.
- **Two-phase: re-brainstorm + re-plan, sequential synthesis.** Mirrors the original brainstorm → plan separation. The R-ID anchor at the requirements layer is what makes the compounding loop work; without it, plan-unit traceability degrades each revolution.
- **Fork the brainstorm, don't mutate.** Symmetric with how the skill treats the original PR and original plan. Preserves a trail of revolutions; each forked brainstorm is dated and links back to its predecessor.
- **R-ID stability is load-bearing.** Original IDs carry across the fork. Discards leave gaps. New IDs get the next-unused number. The discipline echoes how `ce-plan`'s U-IDs survive plan edits.

### v2 Open Questions

- **Filename convention for the forked brainstorm.** Most natural is the same `docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md` shape with today's date and the original topic; the `supersedes:` and `revision:` frontmatter handles the lineage. Alternative: encode revision in the filename (`-v2-requirements.md`). Pick when implementing — both work.
- **What if the discovery phase finds multiple original brainstorms** (e.g., the topic has been brainstormed twice)? Default: pick the one most recently linked from a plan that the existing PR derives from. Resolve at script-write time.
- **Where does the re-brainstorm workflow live?** Likely `references/rebrainstorm-workflow.md` (paralleling `regrounding-workflow.md`'s shape) — short, anchored to artifacts, with the R-ID stability rule and worked example. Decide at implementation time whether to merge or keep them as separate references.

---

## Problem Frame

Long-running PRs accumulate decisions that compound on each other. By the time real understanding emerges — through review back-and-forth, code reading, a new brainstorm, or a moment of "this could be much simpler" — the existing plan is grounded in assumptions that no longer hold. Two recovery moves are available today, and both are bad:

- Run `ce-plan` from scratch — loses every good thing the PR has accumulated (designs, IDs, working code, migrations) and treats the original work as wasted.
- Patch the existing plan in place — silently inherits the original framing and scope assumptions, which are exactly what should have been re-questioned.

The pain is most visible on branches that have lived through several rounds of conversation and partial implementation. The `~/cora origin/brief-view` branch is the canonical example: an original plan, conversational iteration, and emergent learnings have stacked up, and the simpler approach is now visible — but neither recovery move captures it cleanly.

The cost shape is invisible work: re-stitching the new plan by hand, re-reading PR threads to remember which decisions still hold, and either over-preserving the existing approach (because backing it out feels expensive) or under-preserving it (because rebuilding from scratch is the only way to break free of inherited framing).

---

## Actors

- A1. **User invoking the skill**: A developer who has decided the PR's approach needs rethinking and wants a fresh plan that respects the work done so far without inheriting its assumptions.
- A2. **`ce-replan-beta` skill**: Discovers context inside the working repo (original plan, PR threads, recent brainstorms, conversation), re-grounds at the user-story tier, surfaces what it re-derived for confirmation, then writes the new plan doc.
- A3. **Downstream `ce-work`**: Consumes the new plan to drive execution against a fresh branch. Out of scope to build, but the doc must hand off cleanly.

---

## Key Flows

- F1. **Replan from current branch's PR**
  - **Trigger:** User invokes `/ce-replan-beta` on a branch with an open PR after new learnings have emerged.
  - **Actors:** A1, A2
  - **Steps:**
    1. Skill detects the current branch's PR (mirroring `ce-resolve-pr-feedback` discovery).
    2. Skill scans the working repo for original plan doc, PR review threads, recent brainstorm docs, and prior conversation context.
    3. Skill re-grounds at the brainstorm tier: re-walks the user story, re-questions original requirements, surfaces what it re-derived as a synthesis checkpoint.
    4. User confirms or corrects the re-grounding.
    5. Skill writes the new plan doc to `docs/plans/`, dated, with the four extra sections layered over a normal `ce-plan` body.
    6. Skill suggests a fresh branch name and points to `ce-work` for handoff.
  - **Outcome:** A new dated plan doc exists in `docs/plans/`. The original plan and PR are untouched.
  - **Covered by:** R1, R2, R3, R5, R7, R8

- F2. **Replan with explicit PR number**
  - **Trigger:** User invokes `/ce-replan-beta 1234` to target a specific PR.
  - **Actors:** A1, A2
  - **Steps:** Same as F1, but PR is taken from argument rather than auto-detected.
  - **Outcome:** Same as F1.
  - **Covered by:** R1, R2

- F3. **No PR found**
  - **Trigger:** User invokes `/ce-replan-beta` with no argument and no PR exists for the current branch.
  - **Actors:** A1, A2
  - **Steps:**
    1. Skill detects no PR.
    2. Skill explains that `ce-replan` is anchored to existing PRs and points the user to `ce-plan` for fresh planning or `ce-brainstorm` if the work is upstream of planning.
  - **Outcome:** No doc is written; user is redirected.
  - **Covered by:** R9

---

## Requirements

**Invocation and inputs**
- R1. The skill is invokable as `/ce-replan-beta` with an optional PR number argument; without an argument it auto-detects the current branch's PR. The skill ships with `disable-model-invocation: true` per the plugin's beta-skills framework so it does not auto-trigger; only direct user invocation runs it.
- R2. The skill auto-discovers contextual inputs inside the working repo: original plan doc(s) in `docs/plans/`, PR review threads, recent docs in `docs/brainstorms/`, and prior conversation context. The user is not required to pass these explicitly.
- R9. When invoked without a discoverable PR, the skill does not produce a plan doc; it explains the constraint and routes the user to `ce-plan` or `ce-brainstorm`.

**Re-grounding behavior**
- R3. The skill re-derives the problem frame and user story from scratch using PR + plan + learnings as evidence to reason against, not as authoritative framing to inherit.
- R4. When invoked interactively, the skill presents its re-derived framing (problem frame, re-questioned requirements, what changed in the user's understanding) as a synthesis checkpoint and waits for explicit user confirmation before writing the plan doc.
- R10. The skill does not silently propagate original requirements. Each requirement carried from the original plan must be either visibly re-affirmed or visibly revised in the new doc.

**Output document**
- R5. The skill writes a single fresh plan doc to `docs/plans/`, dated, that combines re-grounded framing at the top with a normal `ce-plan` body below.
- R6. The plan doc contains four sections specific to a replan: discarded approaches with reasoning, cherry-pick guidance (designs, IDs, code, migrations worth preserving with rationale), supersedes link + diff from the original plan, and a new learnings inventory.
- R7. The plan doc names the original PR and original plan doc by reference; neither is edited or deleted.
- R8. The plan doc instructs the user to start a fresh branch from `main` and names a suggested branch name. The doc does not perform Git operations.

---

## Acceptance Examples

- AE1. **Covers R1.** Given a branch with an open PR, when the user runs `/ce-replan-beta` with no argument, the skill targets the current branch's PR.
- AE2. **Covers R3, R4, R10.** Given an original plan that asserts "we need a new database table for X", when learnings reveal an existing table can be repurposed, the re-grounding surface presents the original requirement as something to revise — not as an inherited fact — and the user explicitly confirms the revision before the doc is written.
- AE3. **Covers R6.** Given an original PR with three commits (one introducing migrations now deemed unnecessary, one introducing UI components still useful, one mixed), the cherry-pick guidance section names the UI commit as worth preserving with rationale, names the migration commit as discarded, and flags the mixed commit for surgical extraction at execution time.
- AE4. **Covers R7, R8.** Given a fresh plan doc has been written, the original plan file at `docs/plans/<original>.md` is unchanged on disk, the original PR is untouched on GitHub, and the new doc names a fresh branch (e.g., `replan/<topic>`) for the user to create.
- AE5. **Covers R9.** Given the user runs `/ce-replan-beta` on a branch with no PR, the skill responds with a redirect to `ce-plan` or `ce-brainstorm` and writes no doc.

---

## Success Criteria

- A user can replan a long-running branch and produce a plan that respects existing work without inheriting framing assumptions, in a single skill invocation rather than several manual steps.
- The new plan doc gives `ce-work` everything it needs to execute on a fresh branch — including which existing PR commits or files to cherry-pick — without re-reading the original PR threads.
- A future reader of the new plan doc can answer two questions from the doc alone: "what are we no longer doing, and why" and "what from the original PR is still good, and why."
- The original PR remains discoverable from the new plan and unmodified on disk and on GitHub.

---

## Scope Boundaries

- No Git execution: branch creation, cherry-picking, force-push, PR closure, or draft-marking are all out of scope. The skill writes a doc and stops.
- No non-PR variant in v1. Rethinking a plan that was never PR'd stays in `ce-plan`.
- No multi-PR consolidation. One PR in, one plan out.
- No paired execution skill. Handoff to existing `ce-work` is sufficient.
- No auto-decision about whether replanning is the right move. The user invoking the skill has already decided.
- No editing of the original plan doc or PR. They are preserved as superseded artifacts by reference.

---

## Key Decisions

- **Replan is anchored to a PR, not to a plan doc**: Distinguishes the rethink-with-existing-implementation case from the rethink-with-only-a-plan case. The latter is what `ce-plan` already handles.
- **Re-grounding is the core move, not a side-effect**: The failure mode this skill exists to prevent is silent inheritance of original framing. Without forced re-grounding, the skill would degenerate into an in-place plan edit and stop being valuable.
- **Single combined output doc, not separate brainstorm + plan**: A reader needs the rethink rationale and the new plan together. Splitting them creates the lookup tax this skill is supposed to remove.
- **Original artifacts are preserved by reference, never modified**: Keeps replanning low-risk and reversible. If the replan turns out wrong, the original PR is still the source of truth.
- **Discovery mirrors `ce-resolve-pr-feedback`**: PR-anchored skills already share a discovery pattern; reusing it keeps the user's mental model consistent.
- **Ships as a beta skill (`ce-replan-beta`)**: Re-grounding behavior, discovery heuristics, and doc shape will need iteration based on real use. The beta framework prevents accidental auto-triggering (`disable-model-invocation: true`) and signals to users that the contract may change. Promotion to a stable `ce-replan` happens once the workflow has matured against real branches.

---

## Dependencies / Assumptions

- The user's repo follows this plugin's `docs/brainstorms/` and `docs/plans/` conventions, or close enough that auto-discovery has reasonable hit rates. When discovery fails, the skill should ask rather than guess.
- `gh` CLI is available and authenticated for PR + thread discovery (same dependency `ce-resolve-pr-feedback` already carries).
- The user has read access to PR review threads on the relevant PR.

---

## Outstanding Questions

### Resolve Before Planning

- [Affects R4][User decision] How aggressively should the re-grounding interrogate original requirements vs. take them as soft anchors? Specifically: should the synthesis checkpoint always ask the user to revisit each original requirement, or only ones the agent flags as suspect based on learnings?
- [Affects R5][User decision] Filename and location convention for the new plan doc — same `docs/plans/YYYY-MM-DD-<topic>.md` shape as `ce-plan`, with a suffix (e.g., `-replan`) or marker in the topic, or no marker at all?

### Deferred to Planning

- [Affects R2][Technical] Auto-discovery heuristics for matching original plan docs to PRs — branch-name match, in-PR-body link, recency, or some combination.
- [Affects R6][Technical] How cherry-pick guidance is structured in the doc when the original PR has many commits — per-commit table, per-file inventory, or per-concern grouping.
- [Affects R3][Needs research] Whether the re-grounding phase reuses `ce-brainstorm` content (loaded as a reference) or specifies its own lighter facilitation pattern. Reuse is cleaner; bespoke is faster to read for the agent.
