#!/usr/bin/env bash
#
# fetch-pr-context.sh — Fetch PR metadata, review threads, top-level review
# bodies, and commit list for ce-replan-beta's discovery phase.
#
# Usage:
#   fetch-pr-context.sh PR_NUMBER [OWNER/REPO]
#
# Output: a single JSON object on stdout with keys:
#   pr             — top-level PR metadata (number, url, title, body, headRefName, baseRefName)
#   review_threads — review threads (resolved + unresolved), with comment bodies and authors
#   review_bodies  — review submission bodies with non-empty text
#   pr_comments    — top-level PR conversation comments (excludes PR author and codecov)
#   commits        — list of commits with sha, message subject, and author
#
# This is read-only context for the agent's re-grounding phase. Filtering is
# minimal — the agent decides what's signal and what's noise.

set -e

if [ $# -lt 1 ]; then
    echo "Usage: fetch-pr-context.sh PR_NUMBER [OWNER/REPO]" >&2
    exit 1
fi

PR_NUMBER=$1

if [ -n "$2" ]; then
    OWNER=$(echo "$2" | cut -d/ -f1)
    REPO=$(echo "$2" | cut -d/ -f2)
else
    OWNER=$(gh repo view --json owner -q .owner.login)
    REPO=$(gh repo view --json name -q .name)
fi

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
    echo "Error: Could not detect repository. Pass OWNER/REPO as second argument." >&2
    exit 1
fi

gh api graphql \
    -f owner="$OWNER" \
    -f repo="$REPO" \
    -F pr="$PR_NUMBER" \
    -f query='
query FetchPRContext($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      number
      url
      title
      body
      headRefName
      baseRefName
      author { login }
      reviewThreads(first: 50) {
        edges {
          node {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 20) {
              nodes {
                author { login }
                body
                createdAt
                url
              }
            }
          }
        }
      }
      comments(first: 100) {
        nodes {
          author { login }
          body
          createdAt
        }
      }
      reviews(first: 50) {
        nodes {
          author { login }
          body
          state
          submittedAt
        }
      }
      commits(first: 100) {
        nodes {
          commit {
            oid
            messageHeadline
            messageBody
            author { name }
          }
        }
      }
    }
  }
}' | jq '.data.repository.pullRequest as $pr |
  ["codecov"] as $ci_bots |
  {
    pr: {
      number: $pr.number,
      url: $pr.url,
      title: $pr.title,
      body: $pr.body,
      headRefName: $pr.headRefName,
      baseRefName: $pr.baseRefName,
      author: $pr.author.login
    },
    review_threads: [$pr.reviewThreads.edges[]
      | { resolved: .node.isResolved,
          outdated: .node.isOutdated,
          path: .node.path,
          line: .node.line,
          comments: [.node.comments.nodes[]
            | { author: .author.login, body: .body, createdAt: .createdAt, url: .url }] }],
    review_bodies: [$pr.reviews.nodes[]
      | select(.body != null and .body != "")
      | select(.author.login as $l | $ci_bots | index($l) | not)
      | { author: .author.login, body: .body, state: .state, submittedAt: .submittedAt }],
    pr_comments: [$pr.comments.nodes[]
      | select(.author.login != $pr.author.login)
      | select(.author.login as $l | $ci_bots | index($l) | not)
      | select(.body | test("^\\s*$") | not)
      | { author: .author.login, body: .body, createdAt: .createdAt }],
    commits: [$pr.commits.nodes[]
      | { sha: .commit.oid,
          subject: .commit.messageHeadline,
          body: .commit.messageBody,
          author: .commit.author.name }]
  }'
