---
date: 2026-05-06
topic: ce-replan-beta-skill
revision: 2
supersedes: docs/brainstorms/2026-05-06-ce-replan-skill-requirements.md
---

# `ce-replan-beta` Skill

## Summary

`ce-replan-beta` is a beta skill that, when an existing PR's approach has been outgrown by new learnings, runs a two-phase **re-brainstorm → re-plan** cycle and produces fresh artifacts that always start from `main`. Phase one forks the original requirements doc into a new dated version with R-IDs carried forward stably; phase two derives a full-redo plan from the updated requirements. The original PR, plan, and brainstorm are preserved untouched — the new artifacts supersede them by reference. The skill performs no Git operations; the user starts a fresh branch from `main` themselves.

The shape closes a compounding loop. Each revolution sharpens the requirements layer (with stable R-IDs serving as anchors across revisions) and produces a new plan that traces back to those requirements. After many revolutions, the latest brainstorm + latest plan are the live source of truth, and the chain of supersedes-links lets a reader walk back through the history.

---

## Problem Frame

A long-running PR is a snapshot of one moment of understanding. Reviewers find issues, the user reads more code, an adjacent brainstorm surfaces an alternative — the original plan's framing slowly stops fitting. By the time the user knows what they should have planned, they're stuck in one of two failure modes:

- **Re-running `/ce-plan` from scratch.** Loses every good thing the PR has accumulated and treats the original work as wasted, even though much of it is still right.
- **Patching the existing plan in place.** Silently inherits the framing and scope assumptions that should have been re-questioned. The new "plan" is the old plan with edits, not a rethink.

Both failures share a root cause: the **requirements layer rots**. The original `*-requirements.md` was written before the new learnings; if it isn't refreshed, every downstream plan reasons against stale framing. v1 of this skill (shipped on PR #785) tried to compensate by annotating requirements *inside the new plan doc* — but that conflated WHAT and HOW into a single artifact, and left the original brainstorm untouched, so future planning runs would still find the stale doc.

The first real run of v1 (cora session `10b929fb-c03f-4daf-b675-32c00ac44b43` on PR #2382) surfaced the issue cleanly. v1 produced a delta-shaped plan against `brief-view`'s tree — units referencing post-pivot code that didn't exist on `main`. ce-work caught the mismatch and asked the user to choose a branch base; the user replied **"no it replan so start from main no base don we redo the full plan."** The verb *replan*, in the user's mental model, means *redo from main with the latest understanding folded in* — not *adjust forward from where the PR is*.

v2 takes that signal seriously. It does what the verb says.

---

## Actors

- A1. **User invoking the skill.** Has decided the PR's approach needs rethinking and wants the skill to walk them from rethink → fresh requirements → fresh plan.
- A2. **`ce-replan-beta` skill.** Discovers context inside the working repo (PR, original plan, original brainstorm, prior conversation), runs the re-brainstorm and re-plan phases, and writes two new dated artifacts.
- A3. **Downstream `ce-work`.** Consumes the new plan to drive execution against a fresh branch from `main`. Out of scope to build, but the handoff must commit to a branch base so ce-work doesn't re-ask the user.

---

## Key Flows

- F1. **Replan with original brainstorm available.**
  - **Trigger:** User invokes `/ce-replan-beta` (blank or with a PR number) on a PR whose plan was derived from a `*-requirements.md`.
  - **Actors:** A1, A2.
  - **Steps:**
    1. Skill detects the PR (auto or explicit) and discovers the original plan, original brainstorm, recent brainstorm activity, PR review threads, and prior conversation.
    2. **Phase 2a — re-brainstorm.** Skill re-derives the problem frame from user discussion language, walks every original requirement and assigns `[unchanged]` / `[revised]` / `[discarded]` with reasoning, lists new requirements, and presents a synthesis at the requirements scope.
    3. **Phase 3a — re-brainstorm synthesis checkpoint.** User confirms or revises (interactive); pipeline mode skips the prompt.
    4. **Phase 4a — write forked brainstorm.** Skill writes a new dated `*-requirements.md` with stable R-IDs, `supersedes:` and `revision:` frontmatter, and a `## Discarded Requirements` section that preserves the gap-with-reason.
    5. **Phase 2b — re-plan.** Skill derives a fresh plan from the forked brainstorm, with units written for the from-`main` baseline. Cherry-pick guidance names what to preserve from the original PR.
    6. **Phase 3b — re-plan synthesis checkpoint.** User confirms or revises; pipeline mode skips the prompt.
    7. **Phase 4b — write plan.** Skill writes the new plan with R-ID references back to the forked brainstorm.
    8. **Phase 5 — handoff.** Skill commits to `main` as the branch base and presents three options: start `ce-work`, open in Proof, or done. ce-work invocation passes the plan path and the branch base forward.
  - **Outcome:** Two new dated artifacts in `docs/brainstorms/` and `docs/plans/`. Original PR, plan, and brainstorm are untouched.
  - **Covered by:** R1, R2, R4–R12, R14, R16

- F2. **Replan with no original brainstorm.**
  - **Trigger:** User invokes `/ce-replan-beta` on a PR whose plan was written from scratch (no `origin:` link, no matching `docs/brainstorms/` doc).
  - **Actors:** A1, A2.
  - **Steps:** Skill skips Phase 2a / 3a / 4a entirely. Re-plan phase derives directly from the original plan + PR + learnings. Output is one artifact: the new plan.
  - **Outcome:** One new dated plan in `docs/plans/`. No brainstorm is synthesized out of thin air.
  - **Covered by:** R3, R12

- F3. **No PR found.**
  - **Trigger:** User invokes `/ce-replan-beta` with no argument and no PR exists for the current branch, or with an explicit PR number that doesn't exist or is inaccessible.
  - **Actors:** A1, A2.
  - **Steps:** Skill writes nothing, explains that `ce-replan-beta` is anchored to existing PRs, and routes the user to `ce-plan` or `ce-brainstorm`.
  - **Outcome:** No artifacts written.
  - **Covered by:** R17

---

## Requirements

**Skill identity**
- R1. Standalone beta skill named `ce-replan-beta` under `plugins/compound-engineering/skills/`. Frontmatter sets `disable-model-invocation: true` and an `argument-hint` of `[PR number, or blank for current branch's PR]`. Description is `[BETA]`-prefixed per the beta-skills framework.

**Two-phase flow**
- R2. The skill runs as two sequential phases: re-brainstorm followed by re-plan. The shape mirrors `ce-brainstorm` → `ce-plan` but is anchored to existing artifacts and learnings.
- R3. When no original brainstorm exists for the PR, the re-brainstorm phase is skipped and the skill proceeds directly to re-plan. The skill does not synthesize a brainstorm out of thin air.
- R4. Each phase has its own synthesis checkpoint in interactive mode. They are presented sequentially, not combined — confirming requirement edits and plan units in the same breath conflates WHAT and HOW.
- R5. In pipeline mode (LFG / `disable-model-invocation`), both phases run silently. Inferred bets route to a `## Assumptions` section in each artifact. Neither phase blocks.

**Re-brainstorm phase — fork, never mutate**
- R6. The phase forks a new dated `docs/brainstorms/YYYY-MM-DD-<topic>-rebrainstorm-requirements.md` that supersedes the original by reference. The original brainstorm is **never edited or deleted on disk**.
- R7. **R-IDs carry forward stably.** Original IDs preserved; revisions keep the ID with new wording; discards leave a gap (R3 absent is fine — gaps are how the loop stays auditable). New requirements get the next-unused R-ID. No renumbering, ever.
- R8. Forked brainstorm frontmatter names the original via `supersedes:` (path) and includes `revision:` (integer that increments each revolution).
- R9. Each carried-forward requirement is annotated `[unchanged from rev N]` or `[revised from rev N]` inline. Discarded requirements move to a `## Discarded Requirements` section with the original wording and a one-line reason — they leave their gap in the active list, but the gap is documented.

**Re-plan phase — always full redo from `main`**
- R10. The plan derives from the freshly-forked brainstorm (or from the original brainstorm when re-brainstorm was skipped per R3). Plan units cite R-IDs from whichever brainstorm fed them.
- R11. The output plan is a **full redo from `main`**, not a delta layered on the existing PR's tree. Plan units must not reference code, IDs, files, or designs that exist only on the original PR's branch unless explicitly named in the Cherry-Pick Guidance section as targets to preserve.
- R12. The plan doc contains: a Re-Grounded Problem Frame, Requirements (referenced by R-ID, no annotation block — that lives in the forked brainstorm now), Discarded Approaches with reasoning, Cherry-Pick Guidance (files / commits / IDs / designs from the original PR worth preserving, with rationale), Supersedes (original PR + plan), New Learnings inventory, then the standard `ce-plan` body sections.

**Discovery**
- R13. The skill discovers context inside the working repo without user help: PR (auto-detect from current branch or explicit number), original plan, original brainstorm, recent brainstorm activity in `docs/brainstorms/`, PR review threads, prior conversation.
- R14. Discovery categorizes prior plans by merge state. A plan whose commits are all reachable from `main` is treated as merged context; plans with unmerged units must be folded into the new plan's coverage so a full-redo doesn't lose in-flight work. The cora session had two prior plans where some units had landed and some hadn't — the new plan needs to know.

**Preservation discipline**
- R15. The skill performs no Git operations: no branch creation, no cherry-picking, no force-push, no PR closure or draft-marking. It writes new files; it never modifies originals.
- R16. The handoff phase commits to `main` as the branch base for downstream `ce-work` and passes that base forward when invoking ce-work, so ce-work does not re-ask the user. The plan also names a suggested fresh branch name; the user creates the branch themselves.
- R17. When invoked without a discoverable PR, the skill writes no artifacts. It explains that `ce-replan-beta` is anchored to existing PRs and routes the user to `ce-plan` for fresh planning or `ce-brainstorm` if the work is upstream of planning.

**Discovery-script reliability**
- R18. `scripts/fetch-pr-context.sh` surfaces missing-key conditions structurally. Use `// null` defaults or per-key probes so a missing field produces an explicit null rather than empty stdout the agent has to silently absorb. (Three jq exit-5 errors in the cora run; synthesis recovered, but a different shape of missing data could have produced wrong output.)

**Anti-patterns made explicit**
- R19. The skill does not emit unsolicited "what is not in this plan" summaries after writing artifacts. Write the artifacts, present the handoff options, stop. (Cora session emitted one alongside a self-edit, making the transcript hard to reason about.)

---

## Acceptance Examples

- AE1. **Covers R1, R2, R4.** Given an existing PR with a discoverable original brainstorm, when the user invokes `/ce-replan-beta` interactively, the skill produces two synthesis checkpoints in sequence (re-brainstorm, then re-plan) and writes two output artifacts.
- AE2. **Covers R3.** Given a plan with no `origin:` link and no matching brainstorm, when `/ce-replan-beta` runs, the skill skips Phase 2a / 3a / 4a and writes only a new plan.
- AE3. **Covers R6, R7, R8, R9.** Given an original brainstorm with R1–R6, when the re-brainstorm phase decides to revise R3, discard R5, and add a new requirement, the forked brainstorm carries R1, R2, R3 (revised wording with `[revised from rev 1]` marker), R4, R6, R7 (new). R5 is absent from the active list and present in `## Discarded Requirements` with the original wording. Frontmatter has `supersedes: <original-path>` and `revision: 2`.
- AE4. **Covers R10, R11.** Given a PR's branch contains code at `app/foo.rb` that does not exist on `main`, when the re-plan phase runs, plan unit `Files:` and `Approach:` references treat `app/foo.rb` as something the new branch will create (potentially via cherry-pick from the original PR), not as something already in the tree.
- AE5. **Covers R5.** Given the skill is invoked from LFG (pipeline mode), when both phases run, the synthesis prompts are skipped and Inferred bets land in a `## Assumptions` section in each output artifact.
- AE6. **Covers R16.** Given the user selects "Start ce-work" from the handoff menu, when ce-work begins, it does not re-ask which branch base to use — the base is `main`, committed by the replan handoff.
- AE7. **Covers R17.** Given the user runs `/ce-replan-beta` on a branch with no PR, the skill writes no artifacts and emits a redirect message naming `ce-plan` and `ce-brainstorm`.

---

## Success Criteria

- A user can replan a long-running PR and produce both a refreshed requirements doc and a from-`main` plan in one skill invocation, without hand-stitching artifacts or re-reading PR threads.
- After several revolutions of the loop, walking the chain of `supersedes:` links lets a reader trace requirements (by R-ID) and approach decisions all the way back to v1.
- The new plan gives `ce-work` everything it needs to execute on a fresh branch — including which existing PR commits or files to cherry-pick — without asking the user about branch base or sequencing.
- The original PR remains discoverable from the new artifacts and unmodified on disk and on GitHub. Same for the original plan and original brainstorm.

---

## Scope Boundaries

- **No Git execution.** Branch creation, cherry-picking commits, force-push, PR closure or draft-marking — all out of scope. The skill writes files and stops.
- **No mutation of original artifacts.** Original brainstorm, original plan, and original PR are referenced but never edited or deleted.
- **No combined synthesis.** Re-brainstorm and re-plan checkpoints are sequential, not merged into one. The brainstorm/plan separation is what the loop relies on for clean R-ID anchoring.
- **No synthesized brainstorm for plans without one.** When there's no upstream brainstorm, the skill skips Phase 2a entirely. It does not invent a brainstorm.
- **No delta-shaped plans.** Plan units are written for the from-`main` baseline. Code on the original PR's branch must be named in Cherry-Pick Guidance to be referenced.
- **No multi-PR consolidation.** One PR in, one set of artifacts out.
- **No re-grounding-quality-gate.** The skill trusts that the user invoking it has decided replanning is appropriate. It does not push back on the decision.
- **No legacy-plan support beyond v1's R-ID format.** Original brainstorms must follow the project's R-ID convention; older brainstorms without IDs require the agent to derive implicit IDs first (documented as a fallback in the re-brainstorm workflow reference).

### Deferred to Follow-Up Work

- Promotion path from `ce-replan-beta` to a stable `ce-replan`: separate PR after the v2 has matured against real branches. The promotion checklist already exists at `docs/solutions/skill-design/beta-skills-framework.md`.
- LFG / `slfg` orchestration that auto-routes from `ce-brainstorm` (or from a new brainstorm doc that visibly supersedes a current PR's plan) into `ce-replan-beta` without manual invocation.

---

## Key Decisions

- **Always full redo from `main`.** No shape question. The verb "replan" maps to "redo from main" in user mental models — confirmed by the cora session. A shape question would let the failure mode resurface; defaulting to delta-shape silently is what produced the cora friction.
- **Two-phase, sequential synthesis.** Mirrors the original `ce-brainstorm` → `ce-plan` separation. The R-ID anchor at the requirements layer is what makes the compounding loop work; without it, plan-unit traceability degrades each revolution.
- **Fork the brainstorm, never mutate.** Symmetric with how the skill treats the original PR and original plan. Each forked brainstorm is dated and links back to its predecessor via `supersedes:`. After many revolutions, the chain itself is a useful artifact.
- **R-ID stability is load-bearing.** Original IDs carry across the fork; revisions keep their ID with new wording; discards leave gaps; new IDs continue from max+1. The discipline echoes how `ce-plan`'s U-IDs survive plan edits.
- **Two new artifacts, not one combined doc.** Trying to fit requirements + plan into a single output (v1's mistake) collapses WHAT and HOW into the same surface. Two docs is more output but matches the rest of the workflow's separation.
- **Skip the brainstorm phase when there's nothing to fork.** Synthesizing a brainstorm out of thin air for a plan that never had one would be inventing requirements after the fact. Better to be honest: if there was no brainstorm, the new plan has no brainstorm to derive from either.

---

## Dependencies / Assumptions

- The user's repo follows the project's `docs/brainstorms/` and `docs/plans/` conventions, including the R-ID format. Brainstorms without R-IDs are handled via a derivation fallback documented in the re-brainstorm workflow reference.
- `gh` CLI is available and authenticated for PR + thread discovery (same dependency `ce-resolve-pr-feedback` already carries).
- The user has read access to PR review threads on the relevant PR.
- The `main` branch (or repo default branch) is the canonical baseline. The skill resolves the default branch via `git symbolic-ref refs/remotes/origin/HEAD`; `main` is just shorthand throughout the docs.

---

## Outstanding Questions

### Resolve Before Planning

None. All v1 open questions were resolved by the cora-session learnings:
- *How aggressively should the re-brainstorm interrogate original requirements?* — Walk every requirement explicitly, default to `[unchanged]`. The discipline is to never silently drop a requirement.
- *Filename convention for the forked brainstorm?* — `<topic>-rebrainstorm-requirements.md` suffix to disambiguate when two revolutions happen on the same day. Frontmatter (`supersedes:`, `revision:`) carries the lineage.
- *One synthesis or two?* — Two, sequential. WHAT and HOW are different scope levels.

### Deferred to Planning

- **Discovery heuristics for matching original brainstorms to PRs** — likely walk: PR-body link → original-plan's `origin:` frontmatter → recency in `docs/brainstorms/`. Resolve at script-write time once `gh` and filesystem outputs are in front of the implementer.
- **Cherry-pick guidance representation** — per-commit table, per-file inventory, or per-concern grouping. Decide based on what reads cleanly when populated against a real PR with multiple commits.
- **Whether the re-brainstorm phase reuses any of `ce-brainstorm`'s reference content** — Probably no: cross-skill `references/` traversal is banned by AGENTS.md, and re-brainstorming is shaped enough by the existing-artifacts anchor that a bespoke `references/rebrainstorm-workflow.md` is faster to load. Confirm at implementation time.
- **Whether the re-plan phase needs its own re-grounding reference** — The re-grounding logic mostly moved up to the re-brainstorm phase. The re-plan phase may not need a dedicated workflow reference at all; the `ce-plan`-style template might be sufficient. Decide once the re-plan phase is wired.
