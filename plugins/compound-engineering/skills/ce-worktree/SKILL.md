---
name: ce-worktree
description: Ensure work happens in an isolated git worktree without disturbing the current checkout. Use when starting work that should stay isolated, or when `ce-work` or `ce-code-review` offers a worktree option. Detects existing isolation first, prefers the harness's native worktree tool, and falls back to plain git.
---

# Worktree Isolation

Ensure the current work happens in an isolated workspace, without disturbing the user's main checkout. Most coding harnesses now create a worktree by default at session start, so the common case is that **isolation already exists** — detect that first and do not create a redundant one.

Order of operations: **detect existing isolation -> prefer a native worktree tool -> fall back to plain git.** Never create a worktree the harness cannot see.

## Step 0: Detect existing isolation

Before creating anything, check whether the current directory is already a linked worktree. Compare the **resolved absolute** git dir against the **resolved absolute** common git dir — resolve each to an absolute path first and compare those, not the raw `git rev-parse` output. Git mixes absolute and relative forms depending on the current directory (from a subdirectory of a normal checkout, `--git-dir` comes back absolute while `--git-common-dir` may be relative), so a raw string compare yields a false "already isolated":

```bash
git rev-parse --absolute-git-dir                     # absolute git dir for this worktree
(cd "$(git rev-parse --git-common-dir)" && pwd -P)   # absolute shared (common) git dir
```

If the two absolute paths are **equal**, this is a normal checkout — continue to Step 1.

If they **differ**, you are in a linked worktree *or* a submodule. Distinguish them:

```bash
git rev-parse --show-superproject-working-tree
```

- **Non-empty** output -> you are in a submodule; treat it as a normal checkout and continue to Step 1.
- **Empty** output -> you are **already in an isolated worktree**. Report the worktree path (`git rev-parse --show-toplevel`) and current branch, and **work in place**. Do not create another worktree — a worktree-from-worktree lands in the wrong tree and is invisible to the harness that made the current one.

## Step 1: Prefer the harness's native worktree tool

If the harness provides a native worktree primitive — for example an `EnterWorktree` / `WorktreeCreate` tool, a `/worktree` command, or a `--worktree` flag — use it and stop. Native tools place, track, and clean up the worktree so the harness can manage it. A behind-the-back `git worktree add` creates phantom state the harness cannot see, navigate to, or clean up.

## Step 2: Git fallback

Only when there is no native tool **and** Step 0 found no existing isolation. You are in the main checkout here, so the repo root is simply `git rev-parse --show-toplevel`.

1. Choose a meaningful branch name from the work description (e.g. `feat/login`, `fix/email-validation`) — avoid opaque auto-generated names. Pick a base branch (default: origin's default branch, else `main`).
2. **Ensure `.worktrees/` is gitignored before creating anything**, so worktree contents are never committed: check `git check-ignore -q .worktrees`; if it is not ignored, add a `.worktrees` line to `.gitignore`.
3. Fetch the base branch without disturbing the current checkout: `git fetch origin <from-branch>`.
4. Create the worktree: `git worktree add -b <branch-name> .worktrees/<branch-name> origin/<from-branch>`. If `origin/<from-branch>` is unavailable, use the local `<from-branch>` ref instead.
5. Switch into it: `cd .worktrees/<branch-name>`.

If `git worktree add` fails with a sandbox or permission error, report it and work in the current directory instead — do not retry alternative paths.

## Other worktree operations

Use `git` directly — no wrapper is needed:

```bash
git worktree list                          # list worktrees
git worktree remove .worktrees/<branch>    # remove a worktree
cd .worktrees/<branch>                     # switch to a worktree
cd "$(git rev-parse --show-toplevel)"      # return to the current checkout root
```

## When to create a worktree

Create one (Step 1/2) only when you are **not** already isolated and you need a separate workspace:

- Reviewing a PR while keeping the current checkout free for other work
- Running multiple features in parallel without branch-switching overhead

Do not create a worktree for single-task work that can happen on a branch in the current checkout — and never when Step 0 shows you are already in one.

## Integration

`ce-work` and `ce-code-review` offer this skill as an option. When the user selects "worktree" in those flows, run Step 0 first: if the work is already isolated, proceed in place; otherwise create one (native tool preferred) with a meaningful branch name derived from the work description.

## Troubleshooting

**"Worktree already exists"**: the path is in use. Switch to it (`cd .worktrees/<branch>`) or remove it (`git worktree remove .worktrees/<branch>`) before recreating.

**"Cannot remove worktree: it is the current worktree"**: `cd` out of the worktree first, then `git worktree remove`.
