#!/usr/bin/env bash
#
# detect-pr.sh — Detect the PR that ce-replan-beta should target.
#
# Usage:
#   detect-pr.sh                   # auto-detect from current branch
#   detect-pr.sh PR_NUMBER         # use the explicit PR number
#   detect-pr.sh PR_NUMBER OWNER/REPO
#
# Exits with:
#   0 — PR found, JSON metadata emitted on stdout
#   1 — gh CLI error (auth, network, etc.); error message on stderr
#   2 — no PR found for current branch (sentinel for the "F3 / no-PR" route)

set -e

PR_NUMBER="${1:-}"

if [ -n "$2" ]; then
    OWNER=$(echo "$2" | cut -d/ -f1)
    REPO=$(echo "$2" | cut -d/ -f2)
    REPO_FLAG=(--repo "$OWNER/$REPO")
else
    REPO_FLAG=()
fi

# JSON fields requested for the PR. Keep this list intentionally small —
# downstream phases (fetch-pr-context.sh) cover deep data.
PR_FIELDS="number,url,title,body,headRefName,baseRefName,state,isDraft,author"

if [ -z "$PR_NUMBER" ]; then
    # Auto-detect: query current branch's PR. gh exits non-zero when no PR exists.
    if ! OUTPUT=$(gh pr view --json "$PR_FIELDS" "${REPO_FLAG[@]}" 2>&1); then
        # Distinguish "no PR" from real errors. gh's "no pull requests found" message
        # is the no-PR case; anything else propagates as a hard error.
        if echo "$OUTPUT" | grep -qE "no pull requests found|no open pull requests"; then
            exit 2
        fi
        echo "$OUTPUT" >&2
        exit 1
    fi
    echo "$OUTPUT"
    exit 0
fi

# Explicit PR number path.
if ! gh pr view "$PR_NUMBER" --json "$PR_FIELDS" "${REPO_FLAG[@]}"; then
    exit 1
fi
