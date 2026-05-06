#!/usr/bin/env bash
#
# find-original-plan.sh — Locate the original plan doc that an existing PR
# was implementing, if one exists in the working repo's docs/plans/ tree.
#
# Usage:
#   find-original-plan.sh BRANCH_NAME [PR_BODY_FILE]
#
# Inputs:
#   BRANCH_NAME    — head ref of the PR (used to score filename matches)
#   PR_BODY_FILE   — optional path to a file containing the PR body. When
#                    provided, the script scans the body for explicit
#                    'docs/plans/...' references and prefers them.
#
# Output:
#   The repo-relative path of the most likely original plan, or empty when
#   no candidate clears a minimum confidence threshold.
#
# Exit code is always 0 when the script ran successfully — empty output is
# not an error. Callers must check for empty stdout, not exit code, to
# detect "no match found".

set -e

BRANCH_NAME="${1:-}"
PR_BODY_FILE="${2:-}"

if [ -z "$BRANCH_NAME" ]; then
    echo "Usage: find-original-plan.sh BRANCH_NAME [PR_BODY_FILE]" >&2
    exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$REPO_ROOT" ]; then
    echo "Error: not inside a git repository." >&2
    exit 1
fi

PLANS_DIR="$REPO_ROOT/docs/plans"
if [ ! -d "$PLANS_DIR" ]; then
    # No plans directory at all — emit empty output and exit cleanly.
    exit 0
fi

# Step 1: explicit PR-body link wins.
if [ -n "$PR_BODY_FILE" ] && [ -f "$PR_BODY_FILE" ]; then
    LINKED=$(grep -oE 'docs/plans/[A-Za-z0-9._/-]+\.md' "$PR_BODY_FILE" | head -n 1 || true)
    if [ -n "$LINKED" ] && [ -f "$REPO_ROOT/$LINKED" ]; then
        echo "$LINKED"
        exit 0
    fi
fi

# Step 2: score filenames by branch-name fragment matches.
# Strip common branch prefixes (feat/, fix/, refactor/, replan/) and split on -/_/+/.
NORMALIZED_BRANCH=$(echo "$BRANCH_NAME" | sed -E 's@^(feat|fix|refactor|replan|chore|docs)/@@')

# Build a list of fragments at least 4 characters long to avoid noisy short tokens.
FRAGMENTS=$(echo "$NORMALIZED_BRANCH" | tr '/-_+.' '\n\n\n\n\n' | awk 'length($0) >= 4')

if [ -z "$FRAGMENTS" ]; then
    # Branch name was too generic to score against.
    exit 0
fi

# For each plan file, count how many fragments appear in the basename.
# Output: SCORE\tPATH (tab-separated). Sort descending by score, then by mtime.
BEST=$(
    find "$PLANS_DIR" -maxdepth 1 -type f -name '*.md' -print0 |
    while IFS= read -r -d '' plan; do
        basename=$(basename "$plan")
        score=0
        while IFS= read -r frag; do
            [ -z "$frag" ] && continue
            if echo "$basename" | grep -qiF "$frag"; then
                score=$((score + 1))
            fi
        done <<<"$FRAGMENTS"
        if [ "$score" -gt 0 ]; then
            mtime=$(stat -f %m "$plan" 2>/dev/null || stat -c %Y "$plan" 2>/dev/null || echo 0)
            relpath=${plan#"$REPO_ROOT/"}
            printf '%d\t%d\t%s\n' "$score" "$mtime" "$relpath"
        fi
    done | sort -k1,1nr -k2,2nr | head -n 1
)

if [ -z "$BEST" ]; then
    exit 0
fi

# Emit the top candidate when at least one fragment matched. False positives
# are caught at the synthesis checkpoint where the user confirms or corrects
# the discovered original plan before it is relied on.
PATH_OUT=$(echo "$BEST" | cut -f3)
echo "$PATH_OUT"
