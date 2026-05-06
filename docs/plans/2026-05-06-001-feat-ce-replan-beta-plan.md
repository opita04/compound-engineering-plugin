---
title: "feat: Add ce-replan-beta skill for PR-anchored replanning with re-grounding"
type: feat
status: active
date: 2026-05-06
origin: docs/brainstorms/2026-05-06-ce-replan-skill-requirements.md
---

# `ce-replan-beta` Skill

> **⚠ Superseded.** This document is the v1 plan. Live plan lives in `docs/plans/2026-05-06-002-replan-ce-replan-beta-beta-plan.md`. Kept here as the historical snapshot of what shipped to PR #785; the v2 Implementation Adjustments section below captured the post-cora-session reasoning that motivated the rewrite.

## Summary

Build a new beta skill at `plugins/compound-engineering/skills/ce-replan-beta/` that, when an existing PR's approach has been outgrown by new learnings, runs a two-phase **re-brainstorm → re-plan** cycle and produces a fresh plan that always starts from `main`. Phase one forks the original `*-requirements.md` into a new dated requirements doc with R-IDs carried forward stably. Phase two derives a full-redo plan from the updated requirements. Original PR, plan, and brainstorm are preserved untouched. Ships under the plugin's beta-skills framework with `disable-model-invocation: true`.

> **v2 Update (2026-05-06):** This summary reflects the post-cora-session shape. The v1 implementation (units U1–U6) shipped a delta-shaped single-plan-doc skill; the first real run on cora PR #2382 surfaced that the user's verb maps to "redo from main," not "delta on the PR's tree." See `docs/brainstorms/2026-05-06-ce-replan-skill-requirements.md` § *v2 Shape* for the requirements rationale. The **v2 Implementation Adjustments** section below extends and revises U1–U6.

---

## v2 Implementation Adjustments

Source: cora session `10b929fb-c03f-4daf-b675-32c00ac44b43`, brainstorm § *v2 Shape* (R11–R24, AE6–AE10). v1 units U1–U6 are already shipped on PR #785; v2 layers new units on top and revises a few of the existing ones. U-IDs continue from `U7`; gaps are not introduced.

### Revisions to existing units

- **U3 (`references/regrounding-workflow.md`)** — split into per-phase guidance. The four-step pattern stays, but step 3 (re-question requirements with `[unchanged]/[revise]/[discard]`) **moves up to the re-brainstorm phase** (U7 below). What remains in U3 is the re-grounding-from-artifacts pattern that informs the re-brainstorm's synthesis. Document the load order: re-brainstorm phase reads the rebrainstorm reference (U7), re-plan phase reads the regrounding reference (U3) for any plan-tier re-derivation that doesn't belong in the requirements layer.
- **U4 (`references/doc-template.md`)** — drop the `[unchanged]/[revise]/[discard]` requirements block from the plan template. The plan now references R-IDs from the forked brainstorm; per-requirement disposition lives in the brainstorm. Cherry-Pick Guidance, Discarded Approaches, Supersedes, and New Learnings sections stay. Filename pattern unchanged. Add an explicit rule: plan units treat `main` as the baseline; code, IDs, or designs that exist only on the original PR's branch must be named in Cherry-Pick Guidance or created by a unit, never assumed present.
- **U5 (SKILL.md body)** — restructure Phase 2 into two phases: Phase 2a (re-brainstorm, loads U7) and Phase 2b (re-plan-side re-grounding, loads U3). Phase 3 (synthesis) becomes Phase 3a (re-brainstorm synthesis) and Phase 3b (re-plan synthesis); they fire **sequentially** in interactive mode, both silently in pipeline mode. Phase 4 splits: Phase 4a writes the forked brainstorm, Phase 4b writes the new plan. Phase 5 (handoff) commits to `main` as the branch base; ce-work invocation passes the base forward so ce-work doesn't re-ask. Drop any unsolicited "what is not in this plan" emission.

### New units

- U7. **Re-brainstorm workflow reference**

**Goal:** Document the re-brainstorm phase pattern in `references/rebrainstorm-workflow.md`. Loaded on demand when the skill enters Phase 2a.

**Requirements:** R11, R14, R15, R16

**Dependencies:** U1, U2, U3 (script outputs feed re-brainstorm phase)

**Files:**
- Create: `plugins/compound-engineering/skills/ce-replan-beta/references/rebrainstorm-workflow.md`

**Approach:**
- Four steps: (1) read original brainstorm + PR threads + recent learnings + commits; (2) re-derive problem frame from user discussion language; (3) walk every original requirement and assign `[unchanged]/[revise]/[discard]` with reasoning, plus list new requirements; (4) compose a Stated/Inferred/Out three-bucket synthesis at the requirements scope (not the plan scope).
- Document the R-ID stability rule explicitly: original IDs carry through, revisions keep their ID with new wording, discards leave a gap, new IDs continue from max+1. No renumbering, ever.
- Document frontmatter contract for the forked brainstorm: `supersedes:` (path or filename) and `revision:` (integer, increments on each revolution).
- Anti-patterns: do not mutate the original brainstorm; do not re-derive WHAT and HOW in one synthesis; do not synthesize a brainstorm out of thin air when none exists upstream.
- Worked example based on the cora `brief-view` scenario: original sidecar requirements R1–R6, learnings reveal saved-view pivot, output marks R3 `[revise]` with new wording, R5 `[discard]`, adds R7 (post-collapse correctness gaps).
- Keep under 200 lines.

**Patterns to follow:**
- Three-bucket synthesis from `plugins/compound-engineering/skills/ce-brainstorm/references/synthesis-summary.md`
- Anti-pattern callouts from `plugins/compound-engineering/skills/ce-replan-beta/references/regrounding-workflow.md` (U3, already shipped)
- Frontmatter shape from existing brainstorms in `docs/brainstorms/`

**Test scenarios:**
- Happy path: agent reads the reference and produces a forked brainstorm with stable R-IDs against the cora scenario (manual eval via skill-creator).
- Edge case: an original brainstorm with R1, R2, R5 (gaps already exist) produces a fork that preserves the gaps and continues from R6 for new requirements.
- Edge case: when no original brainstorm exists, the agent skips Phase 2a entirely (covered by R17; verified by U5 routing).

**Verification:**
- Reference loads via backtick path from SKILL.md without resolution errors.
- Markdown lints clean.
- Sample populated brainstorm carries R-IDs correctly across revisions.

---

- U8. **Brainstorm output template reference**

**Goal:** Document the forked-brainstorm output template in `references/brainstorm-template.md`. Loaded on demand when Phase 4a writes the doc.

**Requirements:** R14, R15, R16

**Dependencies:** U1, U7

**Files:**
- Create: `plugins/compound-engineering/skills/ce-replan-beta/references/brainstorm-template.md`

**Approach:**
- Follows the existing `ce-brainstorm` requirements template (Summary, Problem Frame, Requirements with R-IDs, Scope Boundaries, etc.) with these v2 additions:
  - Frontmatter includes `supersedes:` and `revision:`.
  - Each carried-forward R-ID has a one-line marker `[unchanged from rev N]` or `[revised from rev N]` so the loop's history is visible inline. Discarded R-IDs are listed in a `## Discarded Requirements` section with the original wording and the reason — they leave a gap in the active list, but the gap is documented.
  - `## New Learnings` section names the sources that drove this revision (PR thread URLs, brainstorm doc paths, conversation references).
- Filename convention: `docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md` with today's date. Topic stays the same as the original; `supersedes:` and `revision:` carry the lineage.
- Repo-relative paths only; no absolute paths.

**Patterns to follow:**
- `plugins/compound-engineering/skills/ce-brainstorm/references/requirements-capture.md` for the canonical template shape.
- v1's `references/doc-template.md` (U4) for the supersedes/learnings idioms.

**Test scenarios:**
- Happy path: a populated brainstorm template against the cora scenario produces a doc with stable R-IDs and visible lineage (manual eval).
- Edge case: original brainstorm with no R-IDs (older format) — the re-brainstorm phase derives implicit R-IDs first, then forks. Document the fallback in this reference.
- Integration: forked brainstorm passes through `ce-doc-review` cleanly (manual eval).

**Verification:**
- Reference loads via backtick path from SKILL.md.
- Sample populated brainstorm is consumable by `ce-plan` (or `ce-replan-beta`'s Phase 2b) without re-asking the user.

---

- U9. **Surface jq failures in `fetch-pr-context.sh`**

**Goal:** Eliminate silent jq exit-5 failures in PR context fetching, so downstream synthesis sees structured signals rather than empty stdout.

**Requirements:** R22

**Dependencies:** U2

**Files:**
- Modify: `plugins/compound-engineering/skills/ce-replan-beta/scripts/fetch-pr-context.sh`

**Approach:**
- Audit the existing jq filter for keys that may not always be present (review threads with empty `comments.nodes`, PRs with no reviews, no commits, etc.). Three jq calls in the cora run exited with code 5; document which keys were missing and add `// null` defaults or `// empty` filters as appropriate.
- Where a key is genuinely optional, prefer `// null` so the consumer (the agent reading the JSON) sees an explicit null rather than absence.
- For required keys that genuinely shouldn't be missing on a valid PR (`pr.number`, `pr.url`), keep the strict access — a missing required key should still surface as an error, just with a clearer message.
- Do not swallow real errors. The fix is "no silent gaps," not "no errors at all."

**Patterns to follow:**
- Existing jq idioms in `plugins/compound-engineering/skills/ce-resolve-pr-feedback/scripts/get-pr-comments`.

**Test scenarios:**
- Happy path: against a real PR with full data, the script's output is unchanged.
- Edge case: against a PR with no review threads, the `review_threads` key in the output is `[]`, not missing.
- Edge case: against a PR with no top-level reviews, the `review_bodies` key is `[]`.
- Error path: against a PR the user lacks access to, the script exits non-zero with a clear `gh` error on stderr.

**Verification:**
- Re-run against the cora `brief-view` PR. Confirm zero jq errors on a normal invocation.
- Sample output against a freshly-opened PR with no reviews yet; confirm structured empty arrays.

---

- U10. **Handoff cleanup — commit to branch base, drop unsolicited essay**

**Goal:** Phase 5 of the skill commits to `main` as the branch base and hands off cleanly to `ce-work` without ce-work re-asking. The unsolicited "what is not in this plan" emission from the cora run is removed.

**Requirements:** R23, R24

**Dependencies:** U5

**Files:**
- Modify: `plugins/compound-engineering/skills/ce-replan-beta/SKILL.md` (Phase 5 section)

**Approach:**
- Phase 5's handoff menu remains three options: Start `ce-work` / Open in Proof / Done. Wording and routing stay; the skill-invocation primitive call to `ce-work` carries the new plan path AND the branch base (`main`).
- Document explicitly: do not emit unsolicited summaries about what is excluded from the plan after writing it. The plan doc itself is the artifact; commentary belongs in chat earlier or not at all.
- Add a discipline check at the end of Phase 4b: confirm the plan doc was written with `Files:` references against `main`, not against the existing PR's branch. The check fires before the handoff menu.

**Patterns to follow:**
- Inline post-menu routing pattern from `plugins/compound-engineering/skills/ce-plan/SKILL.md` Phase 5.4.

**Test scenarios:**
- Happy path: invoke skill, accept synthesis, write doc, select "Start ce-work." ce-work begins with `main` as base, no branch-base question to the user.
- Edge case: select "Open in Proof" — branch base is irrelevant; doc loads in Proof for review.
- Edge case: select "Done" — skill ends cleanly; no unsolicited essay.

**Verification:**
- Manual eval against the cora scenario via skill-creator.
- Confirm transcript has no "Plan updated to reflect option 2" or similar self-edits between menu render and user selection.

---

### Sequencing

1. U7 (re-brainstorm workflow) and U8 (brainstorm template) can land in parallel — independent references.
2. U9 (jq fix) is independent of U7/U8; can land any time.
3. U3, U4, U5 revisions land **after** U7 and U8 because U5 imports U7 and U4 references the new brainstorm template's R-ID conventions.
4. U10 (handoff cleanup) lands with U5 since both modify SKILL.md.
5. README and validation (analogous to v1's U6) updates in the same PR; no new skill name, no count change.

### Validation strategy

Same as v1: behavioral testing manual via skill-creator. The cora scenario serves as the canonical regression check — re-running v2 against `brief-view` should produce a forked brainstorm with stable R-IDs and a from-`main` plan whose units don't reference post-pivot code.

---

## Problem Frame

Long-running PRs accumulate decisions that compound. By the time real understanding emerges through review back-and-forth or a new brainstorm, the existing plan is grounded in assumptions that no longer hold — and the two recovery moves available today are bad: running `ce-plan` from scratch loses every good thing the PR has accumulated, and patching the existing plan in place silently inherits the original framing. Origin doc captures the pain in detail (`docs/brainstorms/2026-05-06-ce-replan-skill-requirements.md`).

---

## Requirements

- R1. Invokable as `/ce-replan-beta` with optional PR number argument; auto-detects current branch's PR when blank. Skill ships with `disable-model-invocation: true`.
- R2. Auto-discovers contextual inputs in the working repo: original plan(s) in `docs/plans/`, PR review threads via `gh`, recent docs in `docs/brainstorms/`, and prior conversation context.
- R3. Re-derives the problem frame and user story from scratch using PR + plan + learnings as evidence, not as authoritative framing to inherit.
- R4. When invoked interactively, presents re-derived framing as a synthesis checkpoint and waits for user confirmation before writing the plan.
- R5. Writes a single fresh plan doc to `docs/plans/` using the `-beta-plan.md` suffix convention, dated and sequenced.
- R6. Plan doc contains four sections specific to a replan: discarded approaches with reasoning, cherry-pick guidance, supersedes link + diff from original plan, and new learnings inventory.
- R7. Plan doc names the original PR and original plan by reference; neither is edited or deleted on disk or on GitHub.
- R8. Plan doc instructs user to start a fresh branch from `main` and names a suggested branch name. Skill performs no Git operations.
- R9. When invoked without a discoverable PR, skill writes no plan and routes user to `ce-plan` or `ce-brainstorm`.
- R10. Skill does not silently propagate original requirements. Each requirement carried from the original plan is either visibly re-affirmed or visibly revised in the new doc.

**Origin actors:** A1 (User invoking the skill), A2 (`ce-replan-beta` skill), A3 (Downstream `ce-work`)
**Origin flows:** F1 (Replan from current branch's PR), F2 (Replan with explicit PR number), F3 (No PR found)
**Origin acceptance examples:** AE1 (covers R1), AE2 (covers R3, R4, R10), AE3 (covers R6), AE4 (covers R7, R8), AE5 (covers R9)

---

## Scope Boundaries

- No Git execution: branch creation, cherry-picking, force-push, PR closure, draft-marking are all out of scope.
- No non-PR variant in v1.
- No multi-PR consolidation.
- No paired execution skill — handoff to existing `ce-work` is sufficient.
- No editing of original plan doc or PR — preserved by reference only.
- No automatic conversion to other agent platforms beyond what `bun run release:validate` exercises (skills auto-convert).

### Deferred to Follow-Up Work

- Promotion path from `ce-replan-beta` to a stable `ce-replan`: separate PR after the beta has matured against real branches. Promotion checklist already exists at `docs/solutions/skill-design/beta-skills-framework.md`.
- LFG / `slfg` integration (auto-routing into the replan flow): out of v1; beta is manual-invocation only by framework default.
- `ce-brainstorm` handoff into `ce-replan-beta` when a new brainstorm clearly supersedes an existing PR's plan: future enhancement once invocation contract is stable.

---

## Context & Research

### Relevant Code and Patterns

- `plugins/compound-engineering/skills/ce-plan/SKILL.md` — canonical planning skill structure; `ce-replan-beta` reuses its synthesis discipline and doc template, layered with replan-specific sections.
- `plugins/compound-engineering/skills/ce-plan/references/synthesis-summary.md` — synthesis pattern that re-grounding mirrors (three-bucket scope summary, prose lead-in).
- `plugins/compound-engineering/skills/ce-plan/references/requirements-capture.md` — base plan-doc template the replan extends with four extra sections.
- `plugins/compound-engineering/skills/ce-resolve-pr-feedback/SKILL.md` and its `scripts/` directory — canonical pattern for PR-anchored skills: auto-detect PR, dispatch parallel work, gh-CLI shell scripts for read-only PR data fetching.
- `plugins/compound-engineering/skills/ce-resolve-pr-feedback/scripts/get-pr-comments` — script-first architecture for `gh`-CLI shell operations; ce-replan-beta needs a similar fetch script.
- `plugins/compound-engineering/skills/ce-polish-beta/` — reference for an existing beta skill's frontmatter shape and references/scripts split.
- `plugins/compound-engineering/skills/ce-brainstorm/SKILL.md` — re-grounding logic mirrors brainstorm-tier facilitation, but anchored to existing artifacts. The skill loads its own slimmed re-grounding workflow rather than re-using ce-brainstorm wholesale (decision rationale below).

### Institutional Learnings

- `docs/solutions/skill-design/beta-skills-framework.md` — load-bearing for this plan: directory naming, frontmatter shape (`-beta` suffix, `[BETA]` description prefix, `disable-model-invocation: true`), plan-file naming convention (`-beta-plan.md`), promotion path.
- `docs/solutions/skill-design/script-first-skill-architecture.md` — guidance on extracting shell-heavy logic into `scripts/` rather than inlining in SKILL.md.
- `docs/solutions/skill-design/post-menu-routing-belongs-inline-2026-04-28.md` — relevant for the skill's handoff menu (route action, don't just announce).
- `docs/solutions/skill-design/pass-paths-not-content-to-subagents-2026-03-26.md` — relevant if discovery dispatches subagents.
- The plugin's own `AGENTS.md` (`plugins/compound-engineering/AGENTS.md`) — adding-components checklist and stable/beta sync rule.

### External References

- None warranted — beta-skills framework, ce-plan/ce-resolve-pr-feedback patterns, and `gh` CLI usage all have multiple direct examples in this repo.

---

## Key Technical Decisions

- **Beta skill, not direct-to-stable**: Re-grounding behavior, discovery heuristics, and doc shape need real-branch iteration before the contract stabilizes. Beta framework prevents accidental auto-triggering and signals contract instability to users.
- **Re-grounding workflow lives in the skill, not as a `ce-brainstorm` import**: ce-brainstorm assumes greenfield exploration; ce-replan-beta needs to anchor to existing artifacts and explicitly *re-question* them. Importing ce-brainstorm wholesale would require the agent to reason against its facilitation rules to skip irrelevant phases. A bespoke, lighter `references/regrounding-workflow.md` is faster to read and avoids the cross-skill `references/` reference (banned by AGENTS.md "File References in Skills").
- **Script-first for PR + plan discovery**: Shell operations (`gh pr view`, `gh api repos/.../pulls/N/comments`, glob `docs/plans/`) live in `scripts/` rather than inlined in SKILL.md. Mirrors `ce-resolve-pr-feedback`'s pattern. Keeps SKILL.md lean and lets the skill re-run discovery deterministically.
- **Plan filename uses the `-beta-plan.md` suffix from the framework**: e.g., `docs/plans/YYYY-MM-DD-NNN-feat-<topic>-beta-plan.md`. Avoids collision with stable `ce-plan` outputs.
- **Synthesis checkpoint reuses the three-bucket pattern (Stated / Inferred / Out)**: Same shape as ce-plan and ce-brainstorm. The user already knows how to read it; consistency lowers cognitive load.
- **Pipeline-mode behavior mirrors ce-plan**: Skip the interactive synthesis; route Inferred bets to a `## Assumptions` section in the output doc; never block. Lets `ce-replan-beta` participate in LFG-style flows when called manually.
- **Discovery is opportunistic, not strict**: When a heuristic fails (no original plan found, branch-name doesn't match, PR has no review threads), the skill notes the gap in the synthesis and proceeds rather than blocking. Failure to discover is an information signal, not an error.

---

## Open Questions

### Resolved During Planning

- *How aggressively the re-grounding interrogates original requirements*: All original requirements are surfaced for re-affirm-or-revise as a default. Agent flags requirements as `[suspect]` when learnings directly contradict them, but the user controls each decision. This satisfies origin's R10 (no silent inheritance) without demanding wholesale re-derivation.
- *Filename convention for the new plan doc*: Use the beta-skills framework's existing `-beta-plan.md` suffix (e.g., `2026-05-06-002-feat-<topic>-beta-plan.md`). Same date-and-sequence shape as `ce-plan`.

### Deferred to Implementation

- Exact heuristic order for matching original plan docs to PRs (branch-name, PR-body link, recency). Resolved at script-write time once `gh` output shape is in front of the implementer.
- Cherry-pick guidance representation (per-commit table vs. per-file inventory vs. per-concern grouping). Decide based on what reads cleanly when populated against a real PR with multiple commits.
- Whether the synthesis section in the output plan doc is named `## Re-Grounded Framing` or absorbed into `## Problem Frame` + `## Requirements` like a normal plan. Decide at template-design time after writing one against the brief-view example.

---

## Output Structure

    plugins/compound-engineering/skills/ce-replan-beta/
    ├── SKILL.md
    ├── references/
    │   ├── regrounding-workflow.md
    │   └── doc-template.md
    └── scripts/
        ├── detect-pr.sh
        ├── fetch-pr-context.sh
        └── find-original-plan.sh

---

## Implementation Units

- U1. **Skill scaffold and frontmatter**

**Goal:** Create the directory, SKILL.md skeleton, and frontmatter following the beta-skills framework so the skill is discoverable but model-invocation-disabled.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `plugins/compound-engineering/skills/ce-replan-beta/SKILL.md`

**Approach:**
- Frontmatter: `name: ce-replan-beta`, `description: "[BETA] ..."` (intended-stable description prefixed with `[BETA]` per framework), `disable-model-invocation: true`, `argument-hint: "[PR number, or blank for current branch's PR]"`.
- Description names what the skill does (replan from PR + accumulated learnings) and when to use it (PR has been outgrown). Stay under 1024 chars.
- SKILL.md body uses imperative voice, mirrors ce-resolve-pr-feedback's section structure (Mode Detection, phases), and references `references/regrounding-workflow.md` and `references/doc-template.md` via backtick paths.
- No cross-skill `../` references, no absolute paths.

**Patterns to follow:**
- `plugins/compound-engineering/skills/ce-polish-beta/SKILL.md` for beta-skill frontmatter shape.
- `plugins/compound-engineering/skills/ce-resolve-pr-feedback/SKILL.md` for PR-anchored skill body structure.

**Test scenarios:**
- Happy path: `tests/frontmatter.test.ts` passes after the new skill is added (description ≤1024 chars, `name` matches directory, `ce-` prefix present).
- Edge case: skill is listed by `bun run release:validate` without errors.
- Test expectation: behavioral testing of the skill itself is manual (per AGENTS.md, behavioral changes to skills evaluate via the `skill-creator` skill, not unit tests).

**Verification:**
- Frontmatter test suite passes.
- `bun run release:validate` reports the new skill manifest without drift.
- Listing the skill via the plugin's marketplace JSON reveals it (auto-counted on validate).

---

- U2. **PR and context discovery scripts**

**Goal:** Provide deterministic shell scripts for PR detection, PR review thread fetching, and original plan discovery. Keeps SKILL.md lean and makes discovery reproducible.

**Requirements:** R2, R9

**Dependencies:** U1

**Files:**
- Create: `plugins/compound-engineering/skills/ce-replan-beta/scripts/detect-pr.sh`
- Create: `plugins/compound-engineering/skills/ce-replan-beta/scripts/fetch-pr-context.sh`
- Create: `plugins/compound-engineering/skills/ce-replan-beta/scripts/find-original-plan.sh`

**Approach:**
- `detect-pr.sh`: Accepts an optional PR number argument. If absent, runs `gh pr view --json number,url,title,body,headRefName,baseRefName` for the current branch. If no PR is associated, exits with code `2` and a structured "no PR" sentinel — calling skill body branches to F3 (No PR found) routing.
- `fetch-pr-context.sh`: Takes a PR number. Emits a JSON-shaped bundle covering PR metadata (title, body, head ref), review threads (`gh api repos/{owner}/{repo}/pulls/{n}/comments`), top-level review summaries, and the list of commit SHAs/messages. Single-purpose, no chaining, no error suppression beyond exit-code handling.
- `find-original-plan.sh`: Takes a branch name (or PR head ref). Globs `docs/plans/*.md` and scores candidates by (a) PR body hyperlink match, (b) branch-name fragment match in filename, (c) recency. Emits the top match's path or empty if no candidate clears a confidence threshold. Empty output is not an error — synthesis surfaces it.
- All scripts begin with `#!/usr/bin/env bash`, `set -e`, and follow the `gh`-CLI usage pattern from `ce-resolve-pr-feedback/scripts/get-pr-comments`.

**Patterns to follow:**
- `plugins/compound-engineering/skills/ce-resolve-pr-feedback/scripts/get-pr-comments` for `gh` CLI invocation, owner/repo detection, and argument parsing.

**Test scenarios:**
- Happy path: `detect-pr.sh` on a branch with a PR returns the PR's JSON; with `--help` or invalid args, exits non-zero with usage.
- Edge case: `detect-pr.sh` on a branch with no PR exits with code 2 and an empty/structured no-PR sentinel.
- Edge case: `find-original-plan.sh` against a branch with no matching plan emits empty output and exits 0.
- Error path: `fetch-pr-context.sh` against a PR the user lacks access to returns the underlying `gh` error message verbatim — caller is responsible for handling.
- Integration scenario: shell scripts are individually invokable by hand from the skill directory (manual smoke).

**Verification:**
- Each script is executable (`chmod +x`).
- `bash scripts/detect-pr.sh` from the plugin's skill directory works against a real branch in this repo.
- Scripts have no `&&`-chained actions, no `2>/dev/null`, and no shell traps beyond `set -e` per AGENTS.md.

---

- U3. **Re-grounding workflow reference**

**Goal:** Document the brainstorm-tier re-derivation pattern in `references/regrounding-workflow.md`. Loaded on demand when the skill enters the synthesis phase.

**Requirements:** R3, R4, R10

**Dependencies:** U1

**Files:**
- Create: `plugins/compound-engineering/skills/ce-replan-beta/references/regrounding-workflow.md`

**Approach:**
- The reference describes a four-step re-derivation:
  1. Read PR (title, body, threads, commits) + original plan + recent brainstorms + conversation context. Pass paths, not content, when dispatching subagents (per `pass-paths-not-content-to-subagents-2026-03-26`).
  2. Re-derive problem frame from artifacts: what is the user trying to do, in their words from the discussion threads, NOT from the original plan's framing.
  3. List original requirements, mark each `[unchanged]` / `[revise]` / `[discard]` based on learnings. Default to `[unchanged]`; require explicit reasoning for revise/discard. This satisfies R10 — no silent inheritance.
  4. Compose a Stated / Inferred / Out three-bucket synthesis (mirrors ce-plan/ce-brainstorm) and present for confirmation.
- Reference includes a "what re-grounding is NOT" anti-pattern list: not a diff against the plan; not a critique of the original work; not a fresh ce-brainstorm-from-zero. The agent treats the original artifacts as evidence to interrogate, not as a starting point to extend.
- Includes one worked example based on the `~/cora origin/brief-view` scenario from the origin doc — concrete enough to anchor agent behavior, generic enough to apply elsewhere.

**Patterns to follow:**
- Three-bucket synthesis structure from `plugins/compound-engineering/skills/ce-plan/references/synthesis-summary.md`.
- Anti-pattern callouts in the style of `plugins/compound-engineering/skills/ce-brainstorm/references/synthesis-summary.md`'s "synthesis as proposal-pitch" warning.

**Test scenarios:**
- Happy path: The reference is < 200 lines so it loads cheaply (per AGENTS.md "Conditional and Late-Sequence Extraction" guidance — re-grounding always runs, but its content is the bulk of the skill's prose, so referencing it via backtick path is correct).
- Edge case: The agent, given the brief-view scenario, marks at least one requirement `[revise]` with an explicit learning reference (manual eval via `skill-creator`).
- Test expectation: behavioral testing manual via skill-creator.

**Verification:**
- Reference loads via backtick path from SKILL.md without resolution errors.
- Markdown lints clean.
- Sample prose tested by reading the file fresh and confirming an agent could execute the four-step re-derivation without reading SKILL.md first.

---

- U4. **Plan doc template and four extra sections**

**Goal:** Document the output plan-doc template in `references/doc-template.md`, including the four replan-specific sections (discarded approaches, cherry-pick guidance, supersedes link + diff, learnings inventory) layered onto the standard `ce-plan` template.

**Requirements:** R5, R6, R7, R8

**Dependencies:** U1

**Files:**
- Create: `plugins/compound-engineering/skills/ce-replan-beta/references/doc-template.md`

**Approach:**
- Reference contains a single canonical template the skill writes to disk. Sections, in order:
  1. Frontmatter (`title`, `type: replan`, `status: active`, `date`, `original_pr`, `original_plan`, `supersedes`).
  2. `## Summary` — forward-looking 1-3 line gloss of the new approach.
  3. `## Re-Grounded Problem Frame` — backward-looking; pulled from re-derivation, not inherited from original plan's framing.
  4. `## Requirements` — explicit `[unchanged]` / `[revise]` / `[discard]` annotations on each carried requirement; new requirements added below.
  5. `## Discarded Approaches` — 2-4 named approaches from the original PR with the specific learning that ruled each out.
  6. `## Cherry-Pick Guidance` — table or list of files/commits/designs/IDs/migrations from the original PR worth preserving, with rationale.
  7. `## Supersedes` — `Original PR: #N`, `Original plan: docs/plans/...`, plus a 2-3 sentence diff describing what's changed in approach.
  8. `## New Learnings` — inventory of what changed in understanding (PR threads, code reading, new brainstorm, conversation), each with a source pointer.
  9. Standard `ce-plan` body sections from there: Scope Boundaries, Context & Research, Key Technical Decisions, Implementation Units, etc.
  10. `## Suggested Branch Name` — proposes `replan/<topic-slug>` (or similar) and instructs user to `git checkout -b <name>` themselves.
- Filename pattern documented: `docs/plans/YYYY-MM-DD-NNN-replan-<topic>-beta-plan.md`. Per beta-skills framework `-beta-plan.md` suffix.
- Repo-relative paths only.
- Original PR and original plan referenced by relative path / PR number; the doc instructs the agent to leave them untouched.

**Patterns to follow:**
- Plan template from `plugins/compound-engineering/skills/ce-plan/SKILL.md` Phase 4.2 Core Plan Template.
- Frontmatter shape from existing plans in `docs/plans/`.

**Test scenarios:**
- Happy path: A populated example template fills cleanly without missing sections (manual eval).
- Edge case: When the original PR has no review threads, the New Learnings section accommodates "from local conversation only" without breaking the template.
- Edge case: When the original plan doc cannot be located, frontmatter `original_plan:` is set to `null` and the Supersedes section explains the gap.
- Integration scenario: An output doc passes through `ce-doc-review` cleanly when run against the standard plan-doc rubric (manual eval).
- Covers AE3 (cherry-pick guidance representation), AE4 (supersedes link + originals untouched), AE7/AE8 implicit through frontmatter.

**Verification:**
- Reference loads via backtick path from SKILL.md.
- Sample populated template against the brief-view scenario produces a doc that another agent can execute against without re-asking the user.

---

- U5. **SKILL.md body: phases, mode detection, handoff routing**

**Goal:** Wire the discovery, re-grounding, and write phases into SKILL.md, including mode detection (PR # vs blank vs no-PR) and the handoff menu after writing.

**Requirements:** R1, R2, R4, R5, R7, R8, R9

**Dependencies:** U2, U3, U4

**Files:**
- Modify: `plugins/compound-engineering/skills/ce-replan-beta/SKILL.md`

**Approach:**
- Phase 0: Mode detection (mirror `ce-resolve-pr-feedback`'s argument table). Modes: PR number provided, blank (auto-detect), no PR (route to ce-plan/ce-brainstorm per F3 / R9).
- Phase 1: Discovery via `bash scripts/detect-pr.sh`, `bash scripts/fetch-pr-context.sh`, `bash scripts/find-original-plan.sh`. Run in parallel where independent. Pass-through outputs to the agent for synthesis.
- Phase 2: Re-grounding — read `references/regrounding-workflow.md` and execute the four-step re-derivation.
- Phase 3: Synthesis checkpoint (interactive: present three-bucket synthesis using `AskUserQuestion` per AGENTS.md cross-platform interaction rules; pipeline mode: skip prompt, route Inferred to `## Assumptions`).
- Phase 4: Write output plan doc using `references/doc-template.md` to `docs/plans/YYYY-MM-DD-NNN-replan-<topic>-beta-plan.md`.
- Phase 5: Handoff menu — options to start `/ce-work` against the new plan, open in Proof, or done. Route the action inline (per `post-menu-routing-belongs-inline-2026-04-28`).
- All file paths repo-relative; no absolute paths in SKILL.md or output doc.
- Honor the platform-variable fallback rule: scripts referenced by relative path, no `${CLAUDE_PLUGIN_ROOT}`-only assumptions without graceful fallback.

**Execution note:** Test the flow against the actual `~/cora origin/brief-view` scenario via skill-creator before declaring U5 complete — the skill's value rests on producing a sane plan against that real branch.

**Patterns to follow:**
- Mode-detection table in `plugins/compound-engineering/skills/ce-resolve-pr-feedback/SKILL.md`.
- Handoff menu and inline-routing pattern in `plugins/compound-engineering/skills/ce-plan/SKILL.md` Phase 5.4.
- `AskUserQuestion` schema-load pattern from any ce-plan / ce-brainstorm SKILL.md.

**Test scenarios:**
- Happy path: Invoked on a branch with a PR, the skill detects the PR, fetches threads, locates the original plan, runs re-grounding, presents synthesis, writes the doc to the correct path. (Manual eval via skill-creator + brief-view scenario.) Covers AE1, AE2, AE3, AE4.
- Edge case: Invoked on a branch with no PR, the skill emits the F3 routing message and writes no doc. Covers AE5.
- Edge case: Invoked with explicit PR number on a branch unrelated to that PR, the skill targets the explicit PR (not the current branch).
- Edge case: Original plan is not discoverable. Skill notes the gap in synthesis, frontmatter `original_plan: null`, plan still gets written with degraded supersedes section.
- Edge case: Pipeline mode invocation (e.g., from a script). Skill skips synthesis prompt, writes `## Assumptions` section in the output, exits without handoff menu.
- Error path: `gh` not authenticated. Scripts return upstream error verbatim; SKILL.md instructs agent to surface the error to the user and abort cleanly.
- Integration scenario: Output doc handed to `/ce-work` produces an actionable execution session (manual eval).

**Verification:**
- Skill-creator eval against brief-view scenario produces a usable plan.
- Frontmatter test suite still passes.
- No regressions in `ce-plan` or `ce-resolve-pr-feedback` (both untouched per scope).

---

- U6. **Marketplace, README, and cleanup-registry updates**

**Goal:** Surface the new skill in plugin metadata, README, and cleanup registries per the plugin's adding-components checklist.

**Requirements:** R1 (skill must be discoverable in the marketplace and listed in README)

**Dependencies:** U1, U2, U3, U4, U5

**Files:**
- Modify: `plugins/compound-engineering/README.md` (Beta Skills section + skill count)
- Modify: `plugins/compound-engineering/.claude-plugin/plugin.json` (description/counts auto-computed by `release:validate` — verify, do not hand-bump version)
- Verify (no manual edit unless validate flags drift): `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`, `.agents/plugins/marketplace.json`
- No edits required to `STALE_SKILL_DIRS` — skill is being added, not removed

**Approach:**
- Add `ce-replan-beta` to the README's Beta Skills table (existing section since `ce-polish-beta` and `ce-work-beta` live there). One-line description matching the SKILL.md frontmatter description.
- Update the README's skill-count line if it mentions a number.
- Run `bun run release:validate` and `bun test`. Both must pass before the unit is verified complete.
- Per AGENTS.md "Versioning Requirements", do NOT manually bump any plugin.json `version` field — release-please owns it.
- No additions to `src/utils/legacy-cleanup.ts` or `src/data/plugin-legacy-artifacts.ts` (those track removals, not additions).

**Patterns to follow:**
- Existing Beta Skills entries in `plugins/compound-engineering/README.md`.

**Test scenarios:**
- Happy path: `bun run release:validate` passes after additions.
- Happy path: `bun test` passes (frontmatter, schema, conversion).
- Edge case: A converter run (e.g., `bun run convert --to opencode --from plugins/compound-engineering`) emits the new skill in target output without errors.
- Test expectation: covered by existing test suites; no new test files required.

**Verification:**
- `bun run release:validate` reports clean (no manifest drift).
- `bun test` green.
- Skill visible in README's Beta Skills section.

---

## System-Wide Impact

- **Interaction graph:** New skill is invoked manually only (`disable-model-invocation: true`). It does not extend ce-brainstorm or ce-plan handoffs. ce-work consumes the output plan doc through the same path it consumes any plan — no ce-work changes needed.
- **Error propagation:** Discovery scripts surface `gh` errors verbatim. The skill aborts cleanly when `gh` is unauthenticated or the PR is inaccessible. No silent fallback that produces a degraded plan against missing data — better to fail loudly.
- **State lifecycle risks:** None. The skill is read-only against the working tree (writes one new file under `docs/plans/`). Original plan and PR are explicitly preserved.
- **API surface parity:** Skill ships across Claude Code, Cursor, Codex, and OpenCode via standard skill conversion. No skill-specific converter logic required — the converter copies skill directories as units.
- **Integration coverage:** A populated output plan must be consumable by `ce-work` without modification. Verified manually via skill-creator eval, not by automated test (per AGENTS.md "Validating Agent and Skill Changes").
- **Unchanged invariants:** `ce-plan`, `ce-brainstorm`, `ce-resolve-pr-feedback`, `ce-work`, and LFG remain untouched. The beta-skills framework explicitly states orchestration is unaffected by beta additions.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Re-grounding is verbose enough that users abandon it for a fast `/ce-plan`. | Keep `references/regrounding-workflow.md` short (< 200 lines); pipeline mode skips the prompt entirely; iteration during beta period addresses friction empirically. |
| Discovery heuristics for `find-original-plan.sh` produce wrong matches against branches with messy plan-naming history. | Synthesis surfaces the matched plan path; user can correct in the synthesis checkpoint. Pipeline mode notes the assumption in `## Assumptions`. |
| Beta-skills framework promotion path requires manual rename across many places (directory, frontmatter, references, README, cleanup registries). | Documented at `docs/solutions/skill-design/beta-skills-framework.md`; promotion is a separate PR after validation. |
| Output doc collides with stable `ce-plan` output naming. | Beta-skills framework's `-beta-plan.md` suffix prevents collision. Verified at U6 by `release:validate`. |
| `gh` CLI not authenticated in user's environment. | Scripts surface upstream `gh` error verbatim; SKILL.md instructs agent to surface and abort. Same dependency posture as `ce-resolve-pr-feedback`. |
| Behavioral changes to a skill cache at session start (per plugin AGENTS.md "Validating Agent and Skill Changes"). | Iteration uses the `skill-creator` skill, which spawns a generic subagent that reads current source from disk. Documented; not a code-level mitigation. |

---

## Documentation / Operational Notes

- README's Beta Skills section gets a new row.
- No CHANGELOG edit (release-please owns it).
- No docs/solutions entry needed — beta-skills framework already documents the pattern.
- After the skill has been used against 2-3 real branches and the doc shape has stabilized, schedule a follow-up to begin the promotion path (`ce-replan-beta` → `ce-replan`). Promotion is out of scope for this plan.

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-06-ce-replan-skill-requirements.md`
- Beta-skills framework: `docs/solutions/skill-design/beta-skills-framework.md`
- Script-first architecture: `docs/solutions/skill-design/script-first-skill-architecture.md`
- Inline post-menu routing pattern: `docs/solutions/skill-design/post-menu-routing-belongs-inline-2026-04-28.md`
- Pattern reference (PR-anchored skills): `plugins/compound-engineering/skills/ce-resolve-pr-feedback/`
- Pattern reference (planning skill): `plugins/compound-engineering/skills/ce-plan/`
- Pattern reference (existing beta skill): `plugins/compound-engineering/skills/ce-polish-beta/`
- Plugin contributor instructions: `plugins/compound-engineering/AGENTS.md`
- Repo-root contributor instructions: `AGENTS.md`
