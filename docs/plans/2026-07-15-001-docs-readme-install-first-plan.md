---
title: README Install-First Reorder - Plan
type: docs
date: 2026-07-15
topic: readme-install-first
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# README Install-First Reorder - Plan

> **Base note.** This plan was first drafted against `README.md` at 481 lines with eleven platform paths, then re-derived against `origin/main` at `1f29eabc`, where the README is **575 lines with fourteen platform paths** (Cline, Grok Build CLI, and Devin CLI landed in between). Every line number, count, and percentage below reflects the current base. The growth is not incidental — see **OQ1**, whose arithmetic it inverts.

## Goal Capsule

- **Objective:** A visitor landing on the `compound-engineering-plugin` repo sees how to install Compound Engineering as the first substantive content, immediately below the project's name and one-line description.
- **Product authority:** The Product Contract below (bootstrapped from the user's request; no upstream brainstorm).
- **Stop conditions:** Surface a blocker instead of guessing if the relocation cannot preserve the Install content verbatim, if any anchor would break, or if the change would require editing install instructions rather than reordering them.
- **Execution profile:** Documentation-only content relocation in `README.md`. No code, no tests, no runtime behavior.
- **Open blockers:** None. OQ1 and OQ2 are decisions for PR review, not blockers.

**Product Contract preservation:** N/A — solo invocation, no upstream Product Contract to preserve. Requirements below were bootstrapped from the user's request.

---

## Product Contract

### Summary

`README.md` currently opens with Philosophy, Workflow, Quick Example, and a 30-row skill inventory, and places `## Install` at line 150 — roughly 26% of the way down a 575-line file. This plan moves the entire `## Install` section, unchanged, to sit directly beneath the H1, badge, and tagline, so the Claude Code install commands are visible within the first ~14 lines. Nothing else about the README's content changes.

### Problem Frame

The README's front matter sells the idea before it lets anyone act on it. A visitor who already wants the plugin — see A5 on how load-bearing and unvalidated that assumption is — must scroll past ~146 lines of philosophy, a six-step workflow table, additional-skills table, five code-block examples, and the full 30-skill inventory before finding `/plugin marketplace add`. The information is present and correct; it is ordered for persuasion rather than for action.

A secondary incoherence falls out of the same ordering: `## Getting Started` (line 107) opens with "After installing, run `/ce-setup` in any project" while sitting *above* the install instructions it refers to.

### Requirements

- **R1.** Install is the first substantive content — a visitor sees how to install without scrolling past philosophy, workflow, examples, or the skill inventory.
- **R2.** The Install section's content is preserved verbatim: all fourteen platform paths (Claude Code, Cursor, Codex App, Codex CLI, Kimi Code CLI, Cline, Grok Build CLI, Devin CLI, GitHub Copilot, Factory Droid, Qwen Code, OpenCode, Pi, Antigravity CLI) plus `### Existing Installs`, with no additions, deletions, or rewording.
- **R3.** Every existing anchor continues to resolve — the two intra-README links (`#full-skill-inventory`, `#existing-installs`) and any external deep-link to `#install`.
- **R4.** The rendered document has no doubled or stray horizontal rules, and all non-Install sections keep their current relative order.
- **R5.** The project's identity — name, CI badge, and the one-line "AI skills that make each unit of engineering work easier than the last." — remains above the install instructions.

### Acceptance Examples

- **AE1.** A visitor reading the README sees the project name, badge, tagline, then immediately `## Install`, `### Claude Code`, and the two `/plugin` commands — no README content intervenes, and the commands land within the first ~14 source lines. (On github.com the repo file browser and header render above the README, so absolute viewport visibility is not achievable on the landing page and is not claimed here.)
- **AE2.** A Codex CLI user following the in-page find for "Codex CLI" lands on the same instructions they would have found before this change, worded identically.
- **AE3.** A visitor following an existing external link to `…/compound-engineering-plugin#install` still lands on the Install heading.
- **AE4.** A reader who scrolls past Install reaches Philosophy, then Workflow, Quick Example, Getting Started, Local Development, Limitations, FAQ, Contributing, License — the same order as before.

---

## Assumptions

Headless run (LFG pipeline) — the scoping confirmation was skipped, so the inferred calls below are recorded here for review rather than confirmed in chat. Each is cheap to reverse; the whole change is a reorder.

- **A1.** "All the way to the top" means immediately after the H1 + badge + tagline identity block, not above it. The H1 cannot be displaced, and a reader needs one line of what-it-is before install commands. This places the install commands at lines 12-13 — the goal is fully met without a contentless opening.
- **A2.** The ask is ordering-only. The Install section's internal structure — fourteen platform subsections, ~296 lines — moves unchanged. Restructuring it to shrink its visible height is a separate decision (see OQ1).
- **A3.** `## Getting Started` does not travel with Install. It stays where it is and becomes a correct forward-reference once Install precedes it.
- **A4.** Philosophy, Workflow, and Quick Example moving below the Install block is the intended tradeoff of "really focus on that," not an unwanted side effect. This is the load-bearing scope assumption: if A4 is wrong, the change is not mis-scoped, it is unwanted. **OQ1 documents why the re-derived base makes this assumption harder to hold than it looked at first draft.**
- **A5.** The dominant repo visitor already intends to install, rather than arriving from a linked article to evaluate the idea. **Unvalidated** — there is no README traffic data, no issue history on install discoverability, and no upstream brainstorm; the README itself links two Every articles as inbound paths, and readers arriving that way are mid-evaluation, not mid-install. The whole plan's value rests on this assumption. It came from the user's direct instruction, which is authority enough to proceed, but it is a bet, not an established fact.

---

## Planning Contract

### Key Technical Decisions

- **KTD-1. Insertion point: after the tagline (line 5), before `## Philosophy`.** The identity block (H1, badge, tagline) is five lines and cannot be moved below Install without leaving the page contentless at the top. Install starting at line 7 puts `### Claude Code` and its two commands at lines 12-13 — the first thing a visitor reads after learning what the project is. Rejected: inserting above the badge/tagline, which trades a one-line orientation cost for no scroll benefit.

- **KTD-2. Pure block relocation — content unchanged.** Lines 149-445 — the Install content (150-443) plus its trailing blank and horizontal rule (444-445) and the blank line at 149 that precedes the heading, per KTD-4 — move as one unit with zero edits. `### Claude Code` is already the first platform inside Install, so the primary audience gets its two commands immediately without any restructuring. This keeps the diff reviewable as a move, keeps R2 trivially verifiable, and carries no risk of corrupting install instructions across fourteen platforms.

- **KTD-3. Anchors are heading-text-derived and all heading text is unique, so a reorder cannot break them.** GitHub slugifies heading text position-independently **except** for duplicate heading text, which it disambiguates with positional `-1`/`-2` suffixes — so a reorder *can* swap anchors when two headings share text. That precondition is satisfied here: verified that all 33 of the README's headings are textually unique. (The per-platform labels under `## Local Development` and `### Existing Installs` are bold text, not headings, so they generate no anchors and cannot collide with `### Claude Code` and its peers.) With no duplicate slugs and no heading text changing, `#install`, `#existing-installs`, and `#full-skill-inventory` all survive. This is the finding that de-risks the change: R3 needs no link edits. Verified by grep — the README contains exactly two anchor references (line 56 → `#full-skill-inventory`, line 159 → `#existing-installs`), and no file outside `docs/plans/` links to a README anchor.

- **KTD-4. Cut lines 149-445 — the blank line, the heading, the content, and the trailing rule — and leave the leading rule at 148 in place.** Install is currently fenced by `---` at 148 and `---` at 445. Two off-by-one traps sit here, both empirically simulated:
  - Moving only **150-443** leaves the two rules adjacent — a visible `---` `---` artifact that R4 forbids.
  - Moving **150-445** fixes the rules but strands the blank at 149 next to the blank at 446, leaving two consecutive blanks before `## Local Development`. Worse, the block then needs a *new* blank inserted above it at the top, so the diff adds one more line than it removes, the file grows to 576 lines, and R2's "added and removed line sets are equal" check becomes false.
  - Moving **149-445** (297 lines: blank + heading + content + trailing blank + rule) is correct. The traveling blank supplies the separator after the tagline, so no new line is added. At the vacated position, `---` (148) is followed by the surviving blank (446) and `## Local Development` — mirroring the original rule/blank/heading spacing exactly. The file stays at 575 lines and the added and removed line sets are exactly equal. Verified by simulation: the two `/plugin` commands land at lines 12-13, rules end at 302 and 445, and no doubled blank appears at either seam.

  **The content-anchored description is authoritative over these line numbers.** Every span here is pinned to `README.md` at `origin/main` = `1f29eabc`; any commit touching the README before U1 executes silently rots them — which already happened once during this plan's own drafting (see the Base note). If the numbers and the description disagree, re-derive the span from the description (the blank line before `## Install` through the `---` following `### Existing Installs`) rather than cutting the stated range.

- **KTD-5. `## Getting Started` stays put.** It owns the `### Full Skill Inventory` table (~35 lines of reference content, not install content), so promoting it with Install would drag the inventory to the top and undercut R1. Leaving it fixes its "After installing…" opening as a side effect of Install moving above it.

- **KTD-6. Plan depth: Lightweight; no flow analysis or deepening pass.** Phase 1.4b would escalate to Standard for work touching "documentation referenced by external URLs," but KTD-3 establishes that the externally-referenced surface — the anchors — is provably undisturbed by a heading-text-preserving reorder. There is no user flow, state transition, or contract to analyze in a single-block content move. Recorded here so a reviewer can challenge the classification rather than infer it.

### Scope Boundaries

#### Non-Goals

- No changes to install instruction content, commands, or platform coverage.
- No changes to any other section's content or internal order.
- No new sections, and no removal of existing ones.
- No changes to `docs/skills/README.md`, `.opencode/INSTALL.md`, `.agy/INSTALL.md`, or any platform manifest.

#### Deferred to Follow-Up Work

- **Collapse the thirteen non-primary platform subsections into `<details>` blocks.** Would cut Install's visible height at the top from ~296 lines to ~15, so install-first costs almost no vertical space. Real tradeoff to weigh first: GitHub's in-page find does not search collapsed `<details>` content, which would hurt discoverability for the thirteen non-Claude platforms and directly conflicts with AE2. This is a decision about Install's internal structure, distinct from this plan's ordering question. See OQ1 for the stronger alternative.
- **Split `### Existing Installs` out of Install.** It is upgrade guidance, not first-install guidance, and currently adds ~35 lines to the section now sitting at the top.
- **Reconcile `## Local Development`'s "From your local checkout" per-harness list with Install's per-platform list.** The two maintain parallel per-platform instructions that can drift.
- **Trim per-platform install prose.** Several subsections repeat a "no separate Bun install step is needed" explanation.

---

## Implementation Units

### U1. Move the Install block above Philosophy

- **Goal:** Relocate `## Install` (with its trailing horizontal rule) from line 150 to directly below the tagline, leaving all content byte-identical.
- **Requirements:** R1, R2, R3, R4, R5 (all of them — this is a single-unit plan).
- **Dependencies:** None.
- **Files:** `README.md`
- **Approach:** Cut lines 149-445 — the blank line preceding `## Install`, through the `---` that follows `### Existing Installs` — and reinsert the block immediately after line 5 (the tagline). Do not add a separator blank: the blank at 149 travels with the block and supplies it. Leave the `---` at line 148 in place; it becomes the rule between `### Full Skill Inventory` and `## Local Development`, followed by the surviving blank at 446 (KTD-4 — read its off-by-one analysis before cutting). Touch nothing inside the moved block and nothing in any other section. Resulting top-level order: identity block → Install → `---` → Philosophy → Workflow → Quick Example → Getting Started → `---` → Local Development → Limitations → FAQ → Contributing → License.
- **Execution note:** Docs-only relocation. Prove the block moved verbatim by comparing the file's sorted line-multiset against `HEAD` — that equality, not new test coverage, is the evidence R2 is met. Do not add tests; there is no behavior to assert.
- **Patterns to follow:** The README's existing `---` convention — horizontal rules fence major structural blocks (currently Install; after this change, Install at the top and the Local-Development boundary). Section heading levels and text stay exactly as-is.
- **Test scenarios:** `Test expectation: none -- pure content reordering of a documentation file.` No behavior changes and no test in the suite asserts README structure. Verified: `tests/release-preview.test.ts:25` uses `"README.md"` only as a synthetic changed-file path for release-component mapping, and `src/release/components.ts` maps it by path (order-agnostic); `tests/release-metadata.test.ts` does not read the README. The `bun test` and `release:validate` runs in Verification are regression guards against unexpected coupling, not new coverage.
- **Verification:**
  - The file is still 575 lines, and the sorted multiset of its lines is unchanged from `HEAD` — the strongest single proof that the move added and removed nothing (R2).
  - `## Install`, `### Claude Code`, and both `/plugin` commands appear within the first ~14 source lines (AE1).
  - Top-level section order matches the sequence in **Approach** above (AE4).
  - The file contains exactly two `^---$` horizontal rules, none adjacent to another (R4), and no two consecutive blank lines were introduced at either seam.
  - Both anchor references still resolve to headings present in the file: `#full-skill-inventory` and `#existing-installs` (R3, AE3).
  - No two headings share the same text, so no positional `-1`/`-2` slug suffix exists for the reorder to swap (R3, KTD-3's precondition).
  - `git diff --stat` shows `README.md` as the only changed file, and the diff's added and removed line sets are equal apart from position — no content edits smuggled into the move (R2, AE2).
  - `bun test` passes and `bun run release:validate` passes.

---

## Verification Contract

- **Structural:** Install is the first `##` heading in the file; the identity block precedes it; every other section retains its prior relative order.
- **Content fidelity:** The file is still 575 lines and its sorted line-multiset is unchanged from `HEAD`. `git diff` on `README.md` shows relocation only — no reworded, added, or dropped lines.
- **Link integrity:** Both intra-README anchors resolve; no heading text changed and no two headings share text, so no slug is position-dependent and external `#install` deep-links survive.
- **Rendering:** Exactly two horizontal rules, no doubling, no stray rule left at the vacated position, and no doubled blank line at either seam.
- **Regression:** `bun test` green, `bun run release:validate` green.

## Definition of Done

- `README.md` opens with the identity block followed immediately by the complete `## Install` section.
- All fourteen platform install paths and `### Existing Installs` are present and verbatim.
- Exactly two horizontal rules remain, correctly placed per KTD-4.
- Both anchor references resolve; no heading text changed.
- `bun test` and `bun run release:validate` pass.
- The change lands as a single `docs(readme):` commit on a feature branch via PR (README.md is docs-only per the repo's commit conventions; the intent is reordering documentation, not changing product behavior).

---

## Open Questions

### OQ1. Should Install be split rather than moved whole?

**Not a blocker.** The plan proceeds on the literal instruction — move the section — and this question is recorded so the reviewer can redirect on the PR rather than discover the tradeoff after merge.

Document review raised a sharper alternative than either arm this plan considered, and **re-deriving against the current base inverted the arithmetic in its favor.** The observation: only **R1** is load-bearing ("a visitor sees how to install"), and `### Claude Code`'s two commands (~8 lines) satisfy it by themselves. The other thirteen platform paths are what create the cost.

The measured effect of moving the block whole, on the current 575-line base:

| | Position | Depth |
|---|---|---|
| `## Install` today (the stated problem) | line 150 | **26%** down |
| `## Philosophy` after the move (the cost) | line 304 | **53%** down |

The change does not just trade one burial for a comparable one — it buries the "what is this" content **twice as deep as the install content currently sits.** At first draft, against a 481-line README with eleven platforms, the same math read 31% vs 47% and was arguable. Fourteen platforms later it is not close. Adversarial review predicted this drift explicitly ("Install's height at the top grows with each platform added"), and it grew by three platforms *during this plan's own drafting*.

The alternative: keep `## Install` at the top containing only `### Claude Code` plus a one-line pointer, and move the remaining thirteen platform subsections and `### Existing Installs` verbatim into a second section below Quick Example. That meets R1 and R5 at ~10 lines instead of ~297, keeps orientation content near the top, preserves both `#install` and `#existing-installs` anchors (both headings survive), and avoids the in-page-find problem that makes the deferred `<details>` mitigation unattractive.

Why it is not the plan of record:

- It is a different change than the one requested. "Move the install section all the way to the top" asks for a relocation; splitting the section into two is a restructuring, and **A2**, **KTD-2**, **R2**, and the Goal Capsule's stop condition all commit to ordering-only by construction. Adopting it means amending all four.
- It has its own cost: install guidance would live in two places, which is worse for the thirteen non-Claude platforms — they would land on a top section that does not contain their instructions.
- The plan's whole premise (**A5**) is already an unvalidated bet on visitor intent. Layering a second unvalidated bet — that splitting reads better than moving — on top of it compounds the guess rather than reducing it.

If the reviewer wants the split, the cheapest path is to amend A2/KTD-2/R2 and the stop condition, then re-scope U1 into two units (extract Claude Code; relocate the remainder). Nothing in this plan forecloses that — the move is trivially revertable.

### OQ2. What signal would trigger revisiting the ordering?

The first entry under **Risks** accepts the below-the-fold cost as "reversible, and intended," but names no condition for reconsidering it, and an open-source README has no analytics to supply one. Absent a trigger, the ~297-line front page ships and stays by default — reversible in principle, unexercised in practice. The install matrix also grows with each platform added (fourteen today, up from eleven within this session), so the accepted tradeoff worsens monotonically. A cheap convention: revisit the ordering the next time a README change touches Philosophy or the platform list, whichever comes first.

---

## Risks

- **The "what is this?" content moves below the fold — measurably further than Install is buried today.** A first-time visitor who does not yet want the plugin now meets ~297 lines of install matrix before Philosophy (line 304, 53% down, vs Install's current line 150, 26% down). This is the accepted tradeoff of the explicit ask ("to really focus on that") and it is cheap to reverse, but the re-derived numbers make it a sharper cost than the first draft implied. OQ1 carries the alternative that would eliminate it. *Severity: medium — reversible and intended, but no longer a small cost.*
- **Monotonic worsening.** Each new platform path lengthens the block now sitting at the top. Three landed during this plan's drafting alone. Without OQ2's trigger, nothing prompts a revisit. *Severity: low now, rising.*
- **Silent content edit inside the moved block.** A 297-line cut-and-paste is the one way this change could do real damage. The sorted-multiset equality check in U1's Verification is the specific guard. *Severity: low, given the check.*
- **Line-number rot.** Every span is pinned to `origin/main` = `1f29eabc`. This already bit once mid-drafting. KTD-4's content-anchored override is the mitigation. *Severity: low, given the override.*

## Sources & Research

- `README.md` at `origin/main` = `1f29eabc` — current structure: 575 lines; `## Install` at 150-443; horizontal rules at 148 and 445; `## Getting Started` at 107 opening with "After installing…"; `### Full Skill Inventory` at 113; 30 inventory rows; fourteen platform subsections; 33 headings, all textually unique.
- Cut simulation (`149-445` → insert after line 5) — verified: 575 lines preserved, sorted line-multiset identical to `HEAD`, `/plugin` commands at lines 12-13, rules at 302 and 445, zero consecutive blank-line pairs, `## Philosophy` at 304. Also verified the two rejected ranges produce the artifacts KTD-4 describes.
- Anchor-reference grep (`*.md`, `*.ts`, `*.json`, `*.yaml`) — exactly two README anchor references exist, both intra-file (line 56, line 159); no file outside `docs/plans/` deep-links a README anchor. Supports KTD-3 and R3.
- Test-coupling grep — no test asserts README content or section order; `src/release/components.ts` maps `README.md` to the `compound-engineering` release component by path only. Supports U1's `Test expectation: none`.
- Directional-language grep — the only positional claim in the README is line 56's "The complete inventory is [below](#full-skill-inventory)", which remains accurate (`### Full Skill Inventory` stays below line 56).
- Repo conventions (project instructions in context) — `docs:` is reserved for docs-only files including `README.md`; feature branches and PRs are required for all changes to `main`; markdown tables must stay pipe-delimited.
