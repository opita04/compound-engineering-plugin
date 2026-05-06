---
name: ce-replan-beta
description: "[BETA] Replan from an existing PR after new learnings have emerged. Runs as a two-phase re-brainstorm + re-plan flow: phase one forks the original requirements doc with R-IDs carried forward stably; phase two derives a fresh full-redo plan that always starts from main. Original PR, plan, and brainstorm are preserved as superseded artifacts; no Git execution. Use when a PR's approach has been outgrown by review back-and-forth, code reading, or a new brainstorm. Invoke with /ce-replan-beta [PR number, or blank for current branch's PR]."
disable-model-invocation: true
argument-hint: "[PR number, or blank for current branch's PR]"
allowed-tools: Bash(bash *detect-pr.sh), Bash(bash *fetch-pr-context.sh), Bash(bash *find-original-plan.sh), Bash(bash *find-original-brainstorm.sh)
---

# Replan from an Existing PR (Beta)

`ce-brainstorm` defines **WHAT** to build. `ce-plan` defines **HOW** to build it. `ce-work` executes. `ce-replan-beta` is for the moment when an existing PR's approach has been outgrown by new learnings — review back-and-forth, code reading, a new brainstorm, or a "this could be much simpler" realization — and the original requirements and plan are grounded in assumptions that no longer hold.

The skill runs as two sequential phases. **Phase one (re-brainstorm)** re-questions the original requirements with the new learnings folded in; it forks the original `*-requirements.md` into a new dated revision with R-IDs carried forward stably. **Phase two (re-plan)** derives a fresh plan from the forked brainstorm — always a full redo from `main`, never a delta layered on the existing PR's tree.

The skill performs no Git operations. The original PR, original plan, and original brainstorm remain untouched on disk and on GitHub; the new artifacts supersede them by reference. The user starts a fresh branch from `main` themselves.

## Interaction Method

When asking the user a question, use the platform's blocking question tool: `AskUserQuestion` in Claude Code (call `ToolSearch` with `select:AskUserQuestion` first if its schema isn't loaded), `request_user_input` in Codex, `ask_user` in Gemini, `ask_user` in Pi (requires the `pi-ask-user` extension). Fall back to numbered options in chat only when no blocking tool exists in the harness or the call errors. Never silently skip the question.

Synthesis checkpoints are presented as **prose**, not menus — option sets bias the answer at the synthesis layer.

## Pipeline Mode

When invoked from an automated workflow such as LFG or any `disable-model-invocation` context, run non-interactively: skip both synthesis prompts (Phase 3a and Phase 3b) and skip the handoff menu (Phase 5). Inferred bets route to a `## Assumptions` section in each artifact (the forked brainstorm and the new plan) so downstream review can scrutinize them.

## Phase 0 — Mode detection

Read `<input>` to determine the mode:

| Argument | Mode | Action |
|----------|------|--------|
| Blank | **Auto-detect** | Continue to Phase 1; PR is the current branch's PR |
| PR number (e.g., `1234`) | **Explicit** | Continue to Phase 1; PR is the explicit number |

If the user provided something that is not a PR number and not blank (URL, branch name, path), surface the input and ask which PR they meant before continuing.

## Phase 1 — Discovery

Run the discovery scripts and probe prior plans for merge state. Use the platform's parallel execution where independent calls are supported.

### 1.1 PR detection

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/detect-pr.sh" "$PR_NUMBER"
```

- Argument is the explicit PR number, or empty for auto-detect.
- Exit code `0` with JSON on stdout: PR found. Capture the PR's `number`, `url`, `title`, `body`, and `headRefName` (branch).
- Exit code `2`: no PR found for current branch. **Route to no-PR redirect**: write nothing, tell the user `ce-replan-beta` is anchored to existing PRs, and point them to `ce-plan` (fresh planning) or `ce-brainstorm` (work upstream of planning). End the skill.
- Exit code `1`: gh CLI error. Surface the error verbatim and end the skill — do not produce degraded artifacts against missing data.

### 1.2 PR context fetch

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/fetch-pr-context.sh" "$PR_NUMBER"
```

- Returns a JSON bundle with PR metadata, review threads, review bodies, top-level comments, and commits. Missing keys produce explicit empty arrays / nulls (no silent gaps).
- Save the output to a temporary file via `mktemp -d -t ce-replan-XXXXXX` and pass the **path** (not the content) to subagents during re-brainstorming.

### 1.3 Original plan discovery

Write the PR body from 1.1 to a temp file, then:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/find-original-plan.sh" "$HEAD_REF" "$PR_BODY_FILE"
```

- Empty stdout means no candidate cleared the heuristic. Continue without an original plan; surface the gap in the synthesis (the forked brainstorm and new plan can still be produced — the skill explains the absence).
- Non-empty stdout: a repo-relative path. Read the candidate plan doc.

### 1.4 Original brainstorm discovery

If 1.3 returned a plan path:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/find-original-brainstorm.sh" "$ORIGINAL_PLAN_PATH"
```

- Prefers the plan's `origin:` frontmatter; falls back to topic-fragment scoring against `docs/brainstorms/`.
- Empty stdout means no upstream brainstorm — Phase 2a/3a/4a are **skipped** (per R3 / R17 in the brainstorm). The re-plan phase runs against the original plan + PR + learnings; no fork is produced.
- Non-empty stdout: a repo-relative path to the brainstorm. Read it.

### 1.5 Recent brainstorm scan

Use the native file-search tool (e.g., `Glob` in Claude Code) to list `docs/brainstorms/*-requirements.md` files modified in the last 30 days. Read any whose topic plausibly matches the PR's. Brainstorms that postdate the original are often *the* new learning.

### 1.6 Plan-merge-state probe

For each prior plan discovered (the original found in 1.3, plus any sibling plans in `docs/plans/` that share the topic), categorize merge state:

1. Read the plan's frontmatter `status:` field. `status: completed` indicates merged work.
2. When status is `active` or absent, probe the commits the plan references via `git merge-base --is-ancestor <sha> main` for each `<sha>` named in the plan's body or in PR commits that landed before the plan was opened. The classification is best-effort.

Carry the categorization forward into the re-brainstorm and re-plan synthesis. **Plans with unmerged units must be folded into the new plan's coverage** so the full-redo doesn't lose in-flight work.

## Phase 2a — Re-brainstorm

**Skip this phase when 1.4 found no original brainstorm.** Continue directly to Phase 2b.

Read `references/rebrainstorm-workflow.md` for the four-step pattern, R-ID stability rule, anti-patterns, and worked example. Execute the four steps against the artifacts gathered in Phase 1:

1. Read artifacts in order — PR threads first, original brainstorm last.
2. Re-derive the problem frame from user discussion language.
3. Walk every original requirement assigning `[unchanged]` / `[revised]` / `[discarded]` with reasoning. R-IDs carry stably; gaps preserved.
4. Compose a Stated / Inferred / Out three-bucket synthesis at the **requirements scope** (not the plan scope).

## Phase 3a — Re-brainstorm synthesis checkpoint

Present the Phase 2a synthesis as prose. Wait for confirmation, revision, or redirect before writing the forked brainstorm.

If the user revises, integrate the change and re-present the revised synthesis. Phase 4a fires only on explicit confirmation.

**Pipeline mode:** skip this phase entirely. Inferred bets route to a `## Assumptions` section in the forked brainstorm written in Phase 4a.

## Phase 4a — Write forked brainstorm

**Skip this phase when 1.4 found no original brainstorm** (matching the Phase 2a skip).

Read `references/rebrainstorm-template.md` for filename conventions, frontmatter contract, section order, and discipline checks. Then:

1. Determine the output filename: `docs/brainstorms/YYYY-MM-DD-<topic>-rebrainstorm-requirements.md`. Today's date; topic matches the original brainstorm's.
2. Compose the doc per the template — frontmatter (`supersedes:`, `revision:`), Summary, Re-Grounded Problem Frame, Actors / Flows / Acceptance Examples (when applicable, with disposition markers), Requirements (with `[unchanged from rev N]` / `[revised from rev N]` markers, gaps where requirements were discarded), `## Discarded Requirements` (for each discarded item, with original wording and reason), Success Criteria, Scope Boundaries, Key Decisions, Dependencies / Assumptions, Outstanding Questions.
3. Run the discipline checks listed at the end of `references/rebrainstorm-template.md` before writing — every original R-ID accounted for, no silent drops, frontmatter `supersedes:` resolves on disk, repo-relative paths only.
4. Use the Write tool to save the file.
5. Confirm the path back to the user (absolute path so the reference is clickable in modern terminals).

The original brainstorm is **never** edited or deleted.

## Phase 2b — Re-plan

Derive the new plan from the forked brainstorm produced in Phase 4a (or, when Phase 2a was skipped, from the original brainstorm or directly from the original plan + PR + learnings).

Plan units cite **R-IDs from `origin:`** (the doc that fed this phase). The plan does not carry per-requirement disposition markers — those live in the forked brainstorm.

**Always-from-`main` baseline** (load-bearing): plan units' `Files:`, `Approach:`, and `Test scenarios:` are written for the `main` baseline. Code, IDs, files, or designs that exist only on the original PR's branch must be named in `## Cherry-Pick Guidance` and referenced from units explicitly.

## Phase 3b — Re-plan synthesis checkpoint

Present the Phase 2b synthesis as prose. Wait for confirmation, revision, or redirect before writing the plan.

**Pipeline mode:** skip this phase entirely. Inferred bets route to a `## Assumptions` section in the new plan written in Phase 4b.

## Phase 4b — Write new plan

Read `references/replan-template.md` for filename conventions, frontmatter contract, the always-from-`main` rule, full section order, and discipline checks. Then:

1. Determine the output filename: `docs/plans/YYYY-MM-DD-NNN-replan-<topic>-beta-plan.md`. Today's date; next sequence number for the day starting at `001`; `<topic>` is a kebab-cased short label from the new approach.
2. Compose the doc per the template — frontmatter (`type: replan`, `origin:` to the forked brainstorm or original brainstorm, `supersedes:` to the original plan, `original_pr:`), Summary, Re-Grounded Problem Frame, Requirements (cite R-IDs from `origin:`), Discarded Approaches with reasoning, Cherry-Pick Guidance, Supersedes, New Learnings inventory, Scope Boundaries, Context & Research, Key Technical Decisions, Implementation Units (with U-IDs), Suggested Branch Name, Sources & References.
3. Run the discipline checks at the end of `references/replan-template.md` — every plan unit's `Files:` / `Approach:` references treat `main` as baseline; no silent assumption that PR-branch code is on `main`; original artifacts referenced but not edited.
4. Use the Write tool to save the file.
5. Confirm the path back to the user (absolute path).

## Phase 5 — Handoff

**Pipeline mode:** skip this phase. Return control to the caller after the artifacts are written. Do not emit unsolicited summaries.

**Interactive mode:** present the handoff menu using the platform's blocking question tool (load `AskUserQuestion` via `ToolSearch` first in Claude Code if its schema isn't loaded).

**Question:** "Replan written. Forked brainstorm: `<absolute path>`. New plan: `<absolute path>`. What would you like to do next?"

**Options:**

1. **Start `/ce-work` against the new plan** (recommended) — invoke the `ce-work` skill via the platform's skill-invocation primitive (`Skill` in Claude Code, equivalents on Codex / Gemini / Pi), passing the new plan path **and** the branch base (`main`) as arguments so `ce-work` does not re-ask the user about branch base. Do not merely tell the user to type a command — fire the invocation.
2. **Open both artifacts in Proof for review** — load the `ce-proof` skill in HITL-review mode for the forked brainstorm and the new plan.
3. **Done for now** — display a brief confirmation and end the turn.

For free-text revisions outside the three options, accept the input, apply the revision to the relevant doc, and loop back to this menu.

**Hard rule (R19):** do not emit an unsolicited "what is not in this plan" summary or "things to consider" essay before, during, or after the menu render. Write the artifacts, present the menu, route the choice. Stop.

**Completion check:** the skill is not complete until the post-write menu has been presented, the user has selected an option, and the inline routing for that option has been executed.

---

> **Note:** This is a beta skill. The invocation contract, doc shapes, and discovery heuristics may change before promotion to a stable `ce-replan`. See `docs/solutions/skill-design/beta-skills-framework.md` for the framework and promotion path.
