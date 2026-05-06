---
title: "feat: Add ce-replan-beta skill for PR-anchored replanning with re-grounding"
type: feat
status: active
date: 2026-05-06
origin: docs/brainstorms/2026-05-06-ce-replan-skill-requirements.md
---

# `ce-replan-beta` Skill

## Summary

Build a new beta skill at `plugins/compound-engineering/skills/ce-replan-beta/` that takes an existing PR plus accumulated learnings and produces a fresh plan document. The skill discovers context in the working repo (original plan, PR review threads, recent brainstorms), re-grounds at the brainstorm tier rather than patching the existing plan, and writes a single combined plan doc to `docs/plans/`. Original PR and plan are preserved untouched. Ships under the plugin's beta-skills framework with `disable-model-invocation: true`.

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
