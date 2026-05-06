---
title: "feat: ce-replan-beta v2 — two-phase re-brainstorm + re-plan from main"
type: replan
status: active
date: 2026-05-06
origin: docs/brainstorms/2026-05-06-ce-replan-skill-rebrainstorm-requirements.md
supersedes: docs/plans/2026-05-06-001-feat-ce-replan-beta-plan.md
original_pr: 785
---

# `ce-replan-beta` v2

## Summary

Restructure the `ce-replan-beta` skill from v1's single-doc delta-replan into a two-phase **re-brainstorm → re-plan** flow that always produces a from-`main` plan. Phase one forks the original `*-requirements.md` into a new dated requirements doc (R-IDs carried forward stably); phase two derives a fresh plan from the forked brainstorm. Original PR (#785), original plan, and original brainstorm are preserved — the new artifacts supersede them by reference. v1's discovery scripts and frontmatter survive as cherry-picks; the SKILL.md body and reference layer are rewritten.

---

## Re-Grounded Problem Frame

v1 of `ce-replan-beta` shipped on PR #785 with a six-phase flow that produced a single combined plan doc. The intent was to mark every original requirement `[unchanged]/[revise]/[discard]` *inside the new plan* and emit cherry-pick guidance against the existing PR's tree.

The first real run on `cora` PR #2382 (session `10b929fb-c03f-4daf-b675-32c00ac44b43`, 2026-05-06) surfaced two structural problems:

- The plan units referenced post-pivot code that lived only on `brief-view`, not on `main`. ce-work caught the mismatch and asked the user about branch base. The user replied **"no it replan so start from main no base don we redo the full plan"** — *replan*, in their mental model, is a from-main rewrite, not a forward-delta on the PR's tree.
- The original `*-requirements.md` was left untouched. Annotating requirements *inside the plan doc* didn't refresh the requirements layer. Future planning runs would still find the stale brainstorm.

The v2 brainstorm (`docs/brainstorms/2026-05-06-ce-replan-skill-rebrainstorm-requirements.md`) addresses both: split the work into a re-brainstorm phase (forks the requirements doc, R-IDs carry stably) and a re-plan phase (full redo from `main`). This plan implements that shape.

---

## Requirements

This plan satisfies all requirements R1–R19 from `docs/brainstorms/2026-05-06-ce-replan-skill-rebrainstorm-requirements.md`. Per-unit traceability appears in each implementation unit's `Requirements:` line below. The grouping below maps requirements to implementation areas:

- **Skill identity (R1):** U1.
- **Two-phase flow (R2, R4, R5):** U6.
- **Skip-brainstorm fallback (R3):** U6.
- **Re-brainstorm phase, fork-not-mutate, R-ID stability (R6, R7, R8, R9):** U3, U4, U6.
- **Re-plan phase, full redo from `main` (R10, R11, R12):** U5, U6.
- **Discovery (R13, R14):** U2.
- **Preservation discipline (R15, R16):** U6.
- **No-PR routing (R17):** U6.
- **Discovery-script reliability (R18):** U2.
- **Anti-patterns (R19):** U6.

**Origin actors:** A1 (User), A2 (`ce-replan-beta`), A3 (`ce-work`).
**Origin flows:** F1 (replan with brainstorm), F2 (replan without brainstorm), F3 (no PR found).
**Origin acceptance examples:** AE1–AE7.

---

## Discarded Approaches

- **Single combined plan doc (v1's shape).** Conflated WHAT and HOW into one artifact and left the original brainstorm to rot. The cora session showed this directly. Replaced by two-artifact output: forked brainstorm + new plan.
- **Per-requirement annotation block inside the plan doc (v1's R10).** The right place for `[unchanged]/[revise]/[discard]` is the requirements layer, not the plan. The plan now references R-IDs and the disposition lives in the forked brainstorm.
- **Delta-shape plan units (v1 implicit default).** Plan units written against the existing PR's tree referenced files and IDs that didn't exist on `main`, forcing ce-work to ask sequencing questions the user didn't think should exist. Replaced by the from-`main` baseline rule (R11): cherry-pick targets must be named explicitly, never assumed.
- **Optional "shape question" (proposed mid-design then rejected).** Adding "delta vs full-redo?" as an interactive question would let the v1 failure mode resurface. The verb *replan* means full-redo; the skill defaults to it without asking.
- **Mutating the original brainstorm in place.** Considered as a simpler alternative to forking. Rejected: the original is a historical snapshot; rewriting it deletes audit trail and breaks the symmetry with how the skill already preserves the original PR and original plan.
- **Combined re-brainstorm + re-plan synthesis.** Considered as a one-prompt simplification. Rejected: collapsing scope levels is what the brainstorm/plan separation exists to prevent. Sequential synthesis is the cost the loop pays for clean R-ID anchoring.
- **Unsolicited "what is not in this plan" emission after Phase 4 (v1 behavior).** The cora run produced one and accompanied it with a self-edit ("Plan updated to reflect option 2"). Removed entirely; write the artifacts, present the handoff, stop.

---

## Cherry-Pick Guidance

What to preserve from PR #785, with rationale:

| Item | Type | Source | Why preserve |
|------|------|--------|--------------|
| `plugins/compound-engineering/skills/ce-replan-beta/SKILL.md` frontmatter | Skill frontmatter (4 lines) | PR #785 commit `9c1d439` | `name`, `[BETA]` description, `disable-model-invocation: true`, `argument-hint` are correct and follow the beta-skills framework. Body is rewritten in U6; frontmatter survives verbatim. |
| `plugins/compound-engineering/skills/ce-replan-beta/scripts/detect-pr.sh` | Script | PR #785 commit `8bba1cd` | Auto-detect / explicit PR with exit-code-2 sentinel for no-PR routing works correctly against real PRs. Cherry-pick verbatim. |
| `plugins/compound-engineering/skills/ce-replan-beta/scripts/find-original-plan.sh` | Script | PR #785 commit `8bba1cd` + autofix `3f6b835` | Branch-fragment scoring + PR-body link discovery works. The `tr` range bug was fixed via autofix on the same PR. Cherry-pick the autofixed version. |
| `plugins/compound-engineering/skills/ce-replan-beta/scripts/fetch-pr-context.sh` | Script (with fix) | PR #785 commit `8bba1cd` | Core GraphQL fetch shape is correct. Cherry-pick with the `// null` jq surfacing fix per R18 — see U2. |
| `plugins/compound-engineering/skills/ce-replan-beta/references/regrounding-workflow.md` content | Reference content | PR #785 commit `27ddf04` | The four-step pattern, anti-pattern callouts, and brief-view worked example port up into U3's new `rebrainstorm-workflow.md` at the requirements scope. Original file is deleted; content is rehomed. |
| `plugins/compound-engineering/skills/ce-replan-beta/references/doc-template.md` content | Template content | PR #785 commit `b3f0bfd` | Sections (Discarded Approaches, Cherry-Pick Guidance, Supersedes, New Learnings, Suggested Branch Name) are reusable in U5's new `replan-template.md`. The per-requirement annotation block is dropped (now in U4). |
| `plugins/compound-engineering/README.md` Beta Skills entry for `ce-replan-beta` | README row | PR #785 commit `332e46f` | Description still applies. May need light wording update to reflect two-phase shape; see U7. |

What is **not** worth preserving from PR #785:

- v1's SKILL.md body (rewritten in U6 — phase structure changed).
- v1's `references/regrounding-workflow.md` as a standalone file (content rehomed to U3; file is removed).
- v1's `references/doc-template.md` as a standalone file (content rehomed to U5; file is removed).

---

## Supersedes

- **Original PR:** #785 (the v1 implementation). Left open and untouched in this plan; the user decides whether to close it as superseded, force-push v2 over it, or land v1 first and follow with v2 as a separate PR. **Recommendation:** force-push v2 onto the same branch (`feat/ce-replan-beta`) so the PR's history shows the iteration. The branch is the right granularity — the skill is being shipped fresh.
- **Original plan:** `docs/plans/2026-05-06-001-feat-ce-replan-beta-plan.md`. Marked superseded; not edited.
- **Original brainstorm:** `docs/brainstorms/2026-05-06-ce-replan-skill-requirements.md`. Marked superseded; not edited.

**Diff from the original plan.** v1 had 6 implementation units producing a single-doc skill with delta-shaped output. v2 has 7 units producing a two-phase skill with two artifacts and a from-`main` baseline. Three v1 units (U1 frontmatter, U2 scripts, U6 README) survive as cherry-picks; three (U3 regrounding, U4 doc-template, U5 SKILL.md body) are replaced by U3, U4, U5, U6 in v2.

---

## New Learnings

- **`cora` session `10b929fb-c03f-4daf-b675-32c00ac44b43`** (2026-05-06, PR #2382). The v1 skill produced a delta-shaped plan; the user's correction *"no it replan so start from main no base don we redo the full plan"* is the load-bearing source for the always-full-redo decision.
- **Slack thread with Trevin** (2026-05-06): "the trick is the plan doc references requirements by ID if it was derived from a brainstorm requirements doc." Source for R-ID stability being load-bearing — without stable IDs, plan-unit traceability degrades each revolution and the compounding loop breaks.
- **PR #785's autofix of the `tr` range bug in `find-original-plan.sh`.** The bug only mattered for branches with uppercase or digit fragments, but it surfaced from inline review of the v1 implementation and is worth carrying as a lesson: bash `tr` SETs interpret `-` between characters as a range. Always put `-` first in a SET if you want it literal.

---

## Scope Boundaries

- No Git execution at any phase.
- No mutation of the original brainstorm, original plan, or original PR.
- No combined synthesis (re-brainstorm and re-plan checkpoints stay sequential).
- No synthesized brainstorm for plans without one (Phase 2a/3a/4a are skipped per R3).
- No delta-shaped plans (units are always written for the from-`main` baseline).
- No multi-PR consolidation.
- No automatic conversion to other agent platforms beyond what `bun run release:validate` exercises.

### Deferred to Follow-Up Work

- Promotion path from `ce-replan-beta` to a stable `ce-replan`: separate PR after v2 has matured against real branches.
- LFG / `slfg` orchestration that auto-routes from `ce-brainstorm` (or from a new brainstorm doc that visibly supersedes a current PR's plan) into `ce-replan-beta` without manual invocation.
- Multi-PR consolidation (one replan covering several PRs being unified into one).

---

## Context & Research

### Relevant Code and Patterns

- `plugins/compound-engineering/skills/ce-brainstorm/SKILL.md` and `references/synthesis-summary.md` — three-bucket synthesis pattern that the re-brainstorm phase mirrors.
- `plugins/compound-engineering/skills/ce-brainstorm/references/requirements-capture.md` — canonical brainstorm-doc template that U4's `rebrainstorm-template.md` extends.
- `plugins/compound-engineering/skills/ce-plan/SKILL.md` — canonical plan-doc structure that U5's `replan-template.md` extends. Especially the U-ID stability rule (carried over for R-ID stability in U4).
- `plugins/compound-engineering/skills/ce-resolve-pr-feedback/scripts/get-pr-comments` — pattern for `gh`-based PR data fetching that U2's discovery scripts already follow.
- v1 of this skill on branch `feat/ce-replan-beta` (PR #785) — primary cherry-pick source for U1 and U2.

### Institutional Learnings

- `docs/solutions/skill-design/beta-skills-framework.md` — directory naming, frontmatter shape, plan-file naming convention. Already followed in v1; v2 maintains conformance.
- `docs/solutions/skill-design/script-first-skill-architecture.md` — guidance on extracting shell-heavy logic into `scripts/`. v1 followed this; v2 extends with the brainstorm-finder logic.
- `docs/solutions/skill-design/post-menu-routing-belongs-inline-2026-04-28.md` — relevant for U6's handoff menu (route the action inline, don't just announce).
- `docs/solutions/skill-design/pass-paths-not-content-to-subagents-2026-03-26.md` — relevant for U6 when discovery dispatches subagents to read PR data.
- The plugin's own `AGENTS.md` — adding-components checklist, file-references rules, cross-platform interaction patterns.

### External References

None warranted.

---

## Key Technical Decisions

- **Cherry-pick v1's discovery scripts; rewrite the SKILL.md body.** The scripts are correct and orthogonal to the phase structure; the SKILL.md body is where v2's two-phase shape lives. Splitting the work this way minimizes churn and makes the diff between v1 and v2 readable.
- **One reference per phase**: `rebrainstorm-workflow.md` for re-brainstorm, `replan-template.md` for the new plan output. v1's `regrounding-workflow.md` is deleted — its content rehomes to the rebrainstorm reference because re-grounding is fundamentally a requirements-layer activity.
- **Force-push v2 onto branch `feat/ce-replan-beta` over PR #785.** The skill is shipping fresh; the branch is the right granularity. Force-push preserves the PR thread and reviewer context. Alternative considered: open a new PR. Rejected because it produces two open PRs implementing overlapping skills, which confuses reviewers.
- **R-ID derivation fallback for legacy brainstorms** (no R-IDs in the original) is documented in U3's reference, not enforced by U6 SKILL.md logic. Keeps SKILL.md lean; the agent reads the fallback when the situation arises.
- **Branch-base committed in handoff (R16)** is implemented as a structured argument passed to the `ce-work` skill invocation, not as an instruction to the user. The user only sees the menu options; the base is wired through the skill-invocation primitive.

---

## Open Questions

### Resolved During Planning

- *Should v1 and v2 ship as separate PRs?* — No. Force-push v2 onto branch `feat/ce-replan-beta`. The branch is the right granularity; opening a second PR confuses reviewers.
- *Where does the re-grounding logic live in v2?* — Inside the re-brainstorm phase reference (U3), at the requirements scope. The re-plan phase doesn't need its own re-grounding workflow — it derives from a freshly-forked brainstorm and follows the standard `ce-plan`-flavored template.

### Deferred to Implementation

- **Discovery heuristic order** for matching original brainstorms to PRs (PR-body link → original-plan's `origin:` frontmatter → recency in `docs/brainstorms/`). Decide at U2 implementation time once the actual `gh` and filesystem outputs are visible.
- **Cherry-pick guidance representation** in the U5 template (per-commit table vs per-file inventory vs per-concern grouping). Decide based on what reads cleanly when populated against a real PR.
- **Plan-merge-state classification** (R14): probe each prior plan's commits with `git merge-base --is-ancestor` against `main`, or check the plan's frontmatter `status:` field, or both. Decide at U2 implementation time.

---

## Output Structure

    plugins/compound-engineering/skills/ce-replan-beta/
    ├── SKILL.md                                  # frontmatter cherry-picked, body rewritten (U1, U6)
    ├── references/
    │   ├── rebrainstorm-workflow.md              # new (U3)
    │   ├── rebrainstorm-template.md              # new (U4)
    │   └── replan-template.md                    # new, replaces v1's doc-template.md (U5)
    └── scripts/
        ├── detect-pr.sh                          # cherry-picked verbatim (U2)
        ├── fetch-pr-context.sh                   # cherry-picked + jq surfacing fix (U2)
        ├── find-original-plan.sh                 # cherry-picked verbatim (U2)
        └── find-original-brainstorm.sh           # new (U2)

Removed from v1: `references/regrounding-workflow.md` (content rehomed to U3), `references/doc-template.md` (content rehomed to U5).

---

## Implementation Units

- U1. **Skill scaffold and frontmatter (cherry-pick + intro rewrite)**

**Goal:** Carry v1's frontmatter forward verbatim and rewrite the SKILL.md intro paragraph to reflect the two-phase shape.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `plugins/compound-engineering/skills/ce-replan-beta/SKILL.md` (frontmatter cherry-picked from v1; body rewritten in U6 — this unit just lays the scaffold)

**Approach:**
- Frontmatter stays: `name: ce-replan-beta`, `[BETA]`-prefixed description, `disable-model-invocation: true`, `argument-hint: "[PR number, or blank for current branch's PR]"`.
- Update the description to reflect two-phase output: "...runs re-brainstorm → re-plan to produce fresh requirements + plan that always start from main..." Keep under 1024 chars.
- Intro paragraph (the prose under `# Replan from an Existing PR (Beta)`) rewritten to introduce the two phases. Detailed phase content lands in U6.
- No raw angle-bracket tokens in the description (Cowork validator rule).

**Patterns to follow:**
- Existing v1 SKILL.md frontmatter layout.
- `plugins/compound-engineering/skills/ce-polish-beta/SKILL.md` for beta-skill frontmatter idioms.

**Test scenarios:**
- Happy path: `tests/frontmatter.test.ts` passes (description ≤1024 chars, `name` matches directory, `ce-` prefix).
- Edge case: description doesn't contain raw `<...>` tokens.

**Verification:**
- `bun test tests/frontmatter.test.ts` green.
- Manual eyeball: intro paragraph names both phases without prescribing implementation.

---

- U2. **Discovery scripts (cherry-pick + jq fix + new brainstorm finder)**

**Goal:** Carry v1's three discovery scripts forward, fix the silent-jq-failure issue surfaced by the cora run, and add a new script for finding the original brainstorm linked from the original plan.

**Requirements:** R13, R14, R18

**Dependencies:** U1

**Files:**
- Cherry-pick (verbatim from PR #785):
  - `plugins/compound-engineering/skills/ce-replan-beta/scripts/detect-pr.sh`
  - `plugins/compound-engineering/skills/ce-replan-beta/scripts/find-original-plan.sh`
- Cherry-pick + modify:
  - `plugins/compound-engineering/skills/ce-replan-beta/scripts/fetch-pr-context.sh` — add `// null` defaults to jq filters for keys that may legitimately be absent (`reviewThreads.edges`, `comments.nodes`, `reviews.nodes`, `commits.nodes`). Goal: explicit nulls in output rather than empty stdout.
- Create:
  - `plugins/compound-engineering/skills/ce-replan-beta/scripts/find-original-brainstorm.sh` — given a plan path, parse its frontmatter for an `origin:` field; if present and the file exists, emit the path. If absent, fall back to scoring `docs/brainstorms/*-requirements.md` by topic-fragment match against the plan's filename topic.

**Approach:**
- `find-original-brainstorm.sh` argument: a path to the original plan file (already discovered by `find-original-plan.sh`). Parse `origin:` from frontmatter using a small awk/sed snippet — no jq dependency. If the field is missing or the path doesn't exist, fall back to filename-fragment scoring against `docs/brainstorms/`.
- Plan-merge-state probe (R14) is implemented as inline logic in U6 SKILL.md (not a separate script): for each candidate prior plan, run `git merge-base --is-ancestor <plan's-mentioned-commits> main` or check the plan's frontmatter `status:` field. Prefer status-field check first; fall back to git probe only if status is missing or unclear.

**Patterns to follow:**
- v1's existing scripts in PR #785 for shell idioms (`set -e`, `#!/usr/bin/env bash`, owner/repo detection).
- `plugins/compound-engineering/skills/ce-resolve-pr-feedback/scripts/get-pr-comments` for jq filter shape.

**Test scenarios:**
- Happy path: against a real PR with full data, `fetch-pr-context.sh` output is structurally identical to v1.
- Edge case: against a PR with no review threads, `review_threads` is `[]` (not missing).
- Edge case: `find-original-brainstorm.sh` against a plan with `origin:` set returns that path; against a plan without `origin:`, falls back to topic match.
- Error path: `find-original-brainstorm.sh` against a plan whose `origin:` points to a nonexistent file falls back to topic match (does not exit non-zero).

**Verification:**
- Re-run `fetch-pr-context.sh` against the cora `brief-view` PR. Confirm zero jq exit-5 errors.
- `find-original-brainstorm.sh` against `docs/plans/2026-05-06-002-replan-ce-replan-beta-beta-plan.md` returns `docs/brainstorms/2026-05-06-ce-replan-skill-rebrainstorm-requirements.md`.

---

- U3. **Re-brainstorm workflow reference**

**Goal:** Document the re-brainstorm phase pattern in `references/rebrainstorm-workflow.md`. Loaded on demand when the skill enters Phase 2a.

**Requirements:** R6, R7, R9

**Dependencies:** U1

**Files:**
- Create: `plugins/compound-engineering/skills/ce-replan-beta/references/rebrainstorm-workflow.md`
- Delete: `plugins/compound-engineering/skills/ce-replan-beta/references/regrounding-workflow.md` (content moves to this new reference)

**Approach:**
- Four-step pattern at requirements scope:
  1. Read artifacts in order — PR threads first, original plan, original brainstorm last (so the original framing doesn't anchor the agent's thinking).
  2. Re-derive the problem frame from user discussion language.
  3. Walk every original requirement: assign `[unchanged]` / `[revised]` (with reasoning + new wording) / `[discarded]` (with reasoning, moves to `## Discarded Requirements`).
  4. Compose a Stated/Inferred/Out three-bucket synthesis at the requirements scope.
- R-ID stability rule: original IDs preserved, revisions keep ID with new wording, discards leave gaps, new IDs continue from max+1. Never renumber.
- Anti-pattern callouts (port from v1's `regrounding-workflow.md`): no diff-against-the-plan thinking, no critique-mode, no brainstorm-from-zero, no preserving the original framing's language verbatim.
- Worked example: brief-view scenario from v1, retold at the requirements layer (R3 `[revised]`, R5 `[discarded]`, new R7 added, etc.).
- Legacy fallback: if the original brainstorm has no R-IDs, derive implicit ones first (one R-ID per bullet in its Requirements section), then proceed.
- Keep under 200 lines.

**Patterns to follow:**
- Three-bucket synthesis from `plugins/compound-engineering/skills/ce-brainstorm/references/synthesis-summary.md`.
- Anti-pattern callout format from v1's `regrounding-workflow.md`.

**Test scenarios:**
- Happy path: agent reads the reference and produces a forked brainstorm with stable R-IDs against the cora scenario (manual eval via skill-creator).
- Edge case: original brainstorm with R1, R2, R5 (gaps already exist) — fork preserves the gaps and continues from R6 for new requirements.
- Edge case: original brainstorm with no R-IDs — agent derives implicit R-IDs first, then proceeds.

**Verification:**
- Reference loads via backtick path from SKILL.md.
- Manual eval: agent given just this reference + the brief-view artifacts can produce a sensible forked brainstorm.

---

- U4. **Re-brainstorm output template reference**

**Goal:** Document the forked-brainstorm output template in `references/rebrainstorm-template.md`. Loaded on demand when Phase 4a writes the doc.

**Requirements:** R6, R7, R8, R9

**Dependencies:** U1

**Files:**
- Create: `plugins/compound-engineering/skills/ce-replan-beta/references/rebrainstorm-template.md`

**Approach:**
- Frontmatter contract:
  ```
  ---
  date: YYYY-MM-DD
  topic: <kebab-case-topic>
  revision: <integer, supersedes-rev + 1>
  supersedes: <repo-relative path to original brainstorm>
  ---
  ```
- Sections in order: Summary, Re-Grounded Problem Frame, Actors, Key Flows (when relevant), Requirements (with stable R-IDs + `[unchanged from rev N]` / `[revised from rev N]` markers), Acceptance Examples, Success Criteria, Scope Boundaries, Key Decisions, Dependencies / Assumptions, Outstanding Questions, **`## Discarded Requirements`** (new section unique to forked brainstorms).
- `## Discarded Requirements` format: each entry shows the original R-ID, the original wording, and a one-line reason for discard. The R-ID is preserved here so the gap in the active list is documented, not implied.
- Filename pattern: `docs/brainstorms/YYYY-MM-DD-<topic>-rebrainstorm-requirements.md` (today's date; topic matches the original or the latest fork). The `-rebrainstorm-` infix disambiguates when multiple revolutions happen on the same day.
- Repo-relative paths only.

**Patterns to follow:**
- `plugins/compound-engineering/skills/ce-brainstorm/references/requirements-capture.md` for canonical section structure.
- v1's `references/doc-template.md` for the supersedes/learnings idioms (not the full template).

**Test scenarios:**
- Happy path: a populated template against the cora scenario produces a doc with stable R-IDs, `## Discarded Requirements` for R5, and `revision: 2` frontmatter.
- Edge case: forked brainstorm passes through `ce-doc-review` cleanly (manual eval).
- Integration: forked brainstorm is consumable by `ce-plan` (Phase 2b in U6) without re-asking the user.

**Verification:**
- Reference loads via backtick path from SKILL.md.
- Sample populated brainstorm has visible `[unchanged from rev N]` / `[revised from rev N]` markers on every carried-forward R-ID.

---

- U5. **Re-plan output template reference**

**Goal:** Document the new plan output template in `references/replan-template.md`, replacing v1's `doc-template.md`.

**Requirements:** R10, R11, R12

**Dependencies:** U1

**Files:**
- Create: `plugins/compound-engineering/skills/ce-replan-beta/references/replan-template.md`
- Delete: `plugins/compound-engineering/skills/ce-replan-beta/references/doc-template.md` (content rehomed into this new reference, with the per-requirement annotation block dropped)

**Approach:**
- Frontmatter contract:
  ```
  ---
  title: "<short replan title>"
  type: replan
  status: active
  date: YYYY-MM-DD
  origin: <repo-relative path to forked brainstorm>
  supersedes: <repo-relative path to original plan>
  original_pr: <PR number or URL>
  ---
  ```
- Sections in order: Summary, Re-Grounded Problem Frame, Requirements (cite R-IDs from `origin:`; **no per-requirement annotation block** — that lives in the forked brainstorm), Discarded Approaches (with reasoning), Cherry-Pick Guidance (table or list of files / commits / IDs / designs from the original PR worth preserving, with rationale), Supersedes (links to original PR + plan + brainstorm), New Learnings inventory, Scope Boundaries, Context & Research, Key Technical Decisions, Implementation Units (standard `ce-plan` shape with U-IDs), Suggested Branch Name, Sources & References.
- **Always-from-`main` rule** documented prominently: plan units' `Files:`, `Approach:`, and code references must be written for the from-`main` baseline. Code that exists only on the original PR's branch must be named in Cherry-Pick Guidance to be referenced.
- Filename pattern: `docs/plans/YYYY-MM-DD-NNN-replan-<topic>-beta-plan.md`. The `-beta-plan.md` suffix is mandated by the beta-skills framework. Topic is derived from the new approach.
- Repo-relative paths only.

**Patterns to follow:**
- Plan template from `plugins/compound-engineering/skills/ce-plan/SKILL.md` Phase 4.2.
- v1's `doc-template.md` for the Discarded-Approaches / Cherry-Pick / Supersedes / New-Learnings idioms.

**Test scenarios:**
- Happy path: populated template against the cora scenario produces a doc whose units don't reference post-pivot code that doesn't exist on `main`.
- Edge case: when `origin:` is the original brainstorm (no fork because Phase 2a was skipped per R3), R-ID references in the plan resolve against the original.
- Integration: an output plan handed to `/ce-work` produces an actionable execution session (manual eval).

**Verification:**
- Reference loads via backtick path from SKILL.md.
- Sample plan against the brief-view scenario has zero unit references to code that doesn't exist on `main`.

---

- U6. **SKILL.md body — two-phase rewrite**

**Goal:** Rewrite SKILL.md body for the two-phase flow. The frontmatter cherry-picked in U1 is unchanged; the entire body below the frontmatter is rewritten.

**Requirements:** R2, R3, R4, R5, R10, R11, R15, R16, R17, R19

**Dependencies:** U2, U3, U4, U5

**Files:**
- Modify: `plugins/compound-engineering/skills/ce-replan-beta/SKILL.md` (body)

**Approach:**
- Phase 0 — Mode detection (PR# / blank / no-PR routing). Same shape as v1; surface `<input>` and route. Per R17, no-PR exits cleanly with a redirect message.
- Phase 1 — Discovery via the four scripts (detect-pr, fetch-pr-context, find-original-plan, find-original-brainstorm) plus the inline plan-merge-state probe. When no original brainstorm is found, branch the flow to skip Phases 2a/3a/4a per R3.
- Phase 2a — Re-brainstorm: load `references/rebrainstorm-workflow.md`. Run the four-step pattern. Output: a synthesis at the requirements scope.
- Phase 3a — Re-brainstorm synthesis checkpoint: present synthesis as prose. Wait for confirmation in interactive mode; skip prompt in pipeline mode and route Inferred bets to `## Assumptions` in the forked brainstorm. **Do not present a menu** — option sets bias the answer.
- Phase 4a — Write forked brainstorm: load `references/rebrainstorm-template.md`. Compose and write to `docs/brainstorms/YYYY-MM-DD-<topic>-rebrainstorm-requirements.md`. Discipline check before write: every original R-ID is annotated or moved to `## Discarded Requirements`; no silent drops.
- Phase 2b — Re-plan: derive the new plan from the forked brainstorm (or from the original brainstorm when Phase 2a was skipped, or from the original plan when neither brainstorm exists per R3). Cite R-IDs from `origin:`.
- Phase 3b — Re-plan synthesis checkpoint: present synthesis. Same interactive-vs-pipeline behavior as Phase 3a.
- Phase 4b — Write plan: load `references/replan-template.md`. Compose and write to `docs/plans/YYYY-MM-DD-NNN-replan-<topic>-beta-plan.md`. Discipline check before write per R11: plan units' `Files:` and `Approach:` references treat `main` as baseline; any reference to original-PR-only code is named in Cherry-Pick Guidance.
- Phase 5 — Handoff:
  - Three options via `AskUserQuestion`: Start `ce-work` against the new plan / Open in Proof / Done.
  - Option 1 dispatches `ce-work` via the platform skill-invocation primitive, passing both the plan path **and** the branch base (`main`) so ce-work doesn't re-ask (R16).
  - **No unsolicited "what is not in this plan" emission** (R19). Write the artifacts, present the menu, route the choice. Stop.
- Cross-platform interaction: name `AskUserQuestion` (Claude Code) plus `request_user_input`/`ask_user`/`ask_user` for Codex/Gemini/Pi at every blocking question site.
- All file paths repo-relative.

**Patterns to follow:**
- v1 SKILL.md from PR #785 for mode-detection and discovery-dispatch shape (carries forward where unchanged).
- `plugins/compound-engineering/skills/ce-plan/SKILL.md` Phase 5.4 for inline post-menu routing.
- `plugins/compound-engineering/skills/ce-resolve-pr-feedback/SKILL.md` for the PR-anchored skill body structure.

**Execution note:** Test the full flow against the actual `~/cora origin/brief-view` scenario via skill-creator before declaring U6 complete. The skill's value rests on producing both a sensible forked brainstorm and a from-`main` plan against that real branch.

**Test scenarios:**
- Happy path: invoked on a PR with discoverable original plan + brainstorm, the skill produces two artifacts and dispatches ce-work with the plan path + branch base. Covers AE1, AE6.
- Edge case: original brainstorm not discoverable — Phase 2a/3a/4a skipped, only the plan is written. Covers AE2.
- Edge case: re-brainstorm produces R3 `[revised]`, R5 `[discarded]`, new R7. Forked brainstorm has the markers, gap, and frontmatter `revision: 2`. Covers AE3.
- Edge case: original PR's branch contains code at a path that doesn't exist on `main`. Plan unit references treat that path as a cherry-pick target, not as already-present. Covers AE4.
- Edge case: pipeline-mode invocation (LFG). Synthesis prompts skipped, Inferred bets in `## Assumptions` in each artifact. Covers AE5.
- Edge case: no PR found. No artifacts written; user redirected. Covers AE7.
- Error path: `gh` not authenticated — scripts surface the error verbatim; SKILL.md instructs the agent to surface and abort.

**Verification:**
- skill-creator eval against the brief-view scenario produces a usable forked brainstorm + plan.
- Frontmatter test suite still passes.
- No regressions in `ce-plan` or `ce-resolve-pr-feedback` (both untouched).
- Transcript of a real run does not contain unsolicited "what is not in this plan" emissions or self-edit lines.

---

- U7. **README + validation**

**Goal:** Surface the v2 shape in the plugin README (light wording update) and confirm the plugin still validates cleanly.

**Requirements:** R1 (skill discoverability)

**Dependencies:** U1, U2, U3, U4, U5, U6

**Files:**
- Modify: `plugins/compound-engineering/README.md` (Beta Skills row for `ce-replan-beta` — wording reflects two-phase output)

**Approach:**
- Update the Beta Skills row's description: "Replan from an existing PR — re-brainstorm + re-plan from main, with R-IDs carried forward stably across the loop."
- Run `bun run release:validate` and `bun test`. Both must pass.
- Per AGENTS.md, do not manually bump any plugin.json `version` field — release-please owns it.
- No additions to `STALE_SKILL_DIRS` (skill is not being removed, just iterated).

**Patterns to follow:**
- Existing Beta Skills entries in `plugins/compound-engineering/README.md`.

**Test scenarios:**
- Happy path: `bun run release:validate` passes after wording update.
- Happy path: `bun test` passes.
- Edge case: a converter run emits the updated skill in target output.

**Verification:**
- `bun run release:validate` clean.
- `bun test` green.
- README's Beta Skills section accurately describes two-phase shape.

---

## System-Wide Impact

- **Interaction graph:** Skill is invoked manually only (`disable-model-invocation: true`). It does not extend `ce-brainstorm` or `ce-plan` handoffs. `ce-work` consumes the new plan via the same path it consumes any plan; ce-work also receives the branch base argument, which is a new contract for the ce-work invocation site.
- **Error propagation:** Discovery scripts surface `gh` errors verbatim; the skill aborts cleanly when `gh` is unauthenticated or the PR is inaccessible. `fetch-pr-context.sh`'s jq surfacing means missing-key conditions produce structured nulls instead of silent gaps (R18).
- **State lifecycle risks:** None. The skill is read-only against the working tree; it writes two new files (forked brainstorm + new plan) and stops. Original artifacts are explicitly preserved.
- **API surface parity:** Skill ships across Claude Code, Cursor, Codex, and OpenCode via standard skill conversion. No skill-specific converter logic required.
- **Integration coverage:** Forked brainstorm must be consumable by `ce-plan`. Plan must be consumable by `ce-work` with the new branch-base argument. Verified manually via skill-creator (per AGENTS.md "Validating Agent and Skill Changes").
- **Unchanged invariants:** `ce-plan`, `ce-brainstorm`, `ce-resolve-pr-feedback`, `ce-work`, and LFG remain unchanged. The branch-base argument to ce-work is additive — ce-work continues to work without it.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Two synthesis checkpoints feel like two prompts to confirm. Users abandon the flow midway. | Pipeline mode skips both prompts. In interactive mode, each synthesis is short and scoped to its own layer. The cora session showed users accept synthesis confirmations quickly when the synthesis is sound; the friction was structural (wrong shape), not cognitive (too many prompts). |
| Forked brainstorm filename collisions when two revolutions happen on the same day. | The `-rebrainstorm-` infix disambiguates. Frontmatter `supersedes:` and `revision:` carry the lineage independently. Future revisions can extend with `-rebrainstorm-rev3-` if needed. |
| Plan-merge-state classification (R14) is brittle if neither `status:` frontmatter nor merge-base probing produces clear answers. | The agent surfaces uncertainty in the synthesis ("two prior plans found; could not determine merge state for plan X"). Pipeline mode notes the assumption in `## Assumptions`. The classification is best-effort, not blocking. |
| Force-push v2 onto branch `feat/ce-replan-beta` over PR #785 loses v1's commit history. | The git log preserves v1's commits in reflog and on the branch's existing commits before force-push. The PR history of comments/reviews is preserved on the GitHub side. Reviewers can read the v1-then-v2 transition through the commit list and PR description. |
| Original brainstorm has no R-IDs (older format) — re-brainstorm phase has nothing to anchor on. | Documented fallback in U3: derive implicit R-IDs from the Requirements section's bullets, then proceed. Surface the derivation in the synthesis so the user can correct any misreading. |
| Behavioral changes to the skill cache at session start. | Iteration uses the `skill-creator` skill, which spawns a generic subagent that reads current source from disk. Documented in plugin AGENTS.md. |

---

## Documentation / Operational Notes

- README's Beta Skills row gets a wording update.
- No CHANGELOG edit (release-please owns it).
- No `docs/solutions/` entry needed beyond the existing beta-skills framework doc.
- After v2 has been used against 2-3 real branches and the doc shapes have stabilized, schedule a follow-up to begin the promotion path (`ce-replan-beta` → `ce-replan`).

---

## Sources & References

- **Origin requirements:** `docs/brainstorms/2026-05-06-ce-replan-skill-rebrainstorm-requirements.md`
- **Superseded plan:** `docs/plans/2026-05-06-001-feat-ce-replan-beta-plan.md`
- **Original PR:** #785 (`feat/ce-replan-beta` branch)
- **Cora session driving the rewrite:** `~/.claude/projects/-Users-kieranklaassen-cora/10b929fb-c03f-4daf-b675-32c00ac44b43.jsonl`
- **Beta-skills framework:** `docs/solutions/skill-design/beta-skills-framework.md`
- **Pattern reference (PR-anchored skills):** `plugins/compound-engineering/skills/ce-resolve-pr-feedback/`
- **Pattern reference (planning skill):** `plugins/compound-engineering/skills/ce-plan/`
- **Pattern reference (existing beta skill):** `plugins/compound-engineering/skills/ce-polish-beta/`
- **Plugin contributor instructions:** `plugins/compound-engineering/AGENTS.md`
