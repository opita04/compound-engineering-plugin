---
date: 2026-05-06
topic: ce-replan-beta-skill
---

# `ce-replan-beta` Skill

## Summary

A new beta skill (`ce-replan-beta`) that produces a fresh plan when an existing PR's approach has been outgrown by new learnings. Re-grounds at the brainstorm tier — re-walks the user story and re-questions the original requirements rather than patching the existing plan in place. Output is a single plan doc that combines re-grounded framing with a normal `ce-plan` body, plus discarded-approach and cherry-pick guidance. The original PR is preserved as a superseded artifact; no Git execution. Ships as a beta per the plugin's beta-skills framework so it can mature before promotion to a stable `ce-replan`.

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
