# Cross-Model Execution Contract

Load this reference only after the cross-model engine is selected. It defines the fixed-route, authority, fallback, identity, and receipt contract. The controller and serial/parallel scheduling mechanics are supplied by the later runtime protocol; until a route has a qualified adapter and that machinery is present, treat it as unavailable rather than approximating the workflow.

## Resolve one requested route

Use only these targets: `codex`, `claude`, `grok`, `cursor`, and `composer`. Keep five identity facts separate in every disclosure and receipt: target, harness/intermediary route, requested model, actual model, and receipt status.

- `cursor` means the Cursor harness with its configured default model.
- `composer` means a Composer-family model through Cursor.
- `grok` prefers its fixed native route; a Grok model through Cursor is a different intermediary and must be separately permitted and sanctioned.

Attempt the preferred mapping first. After observed drift, the host may choose only a compatible substitute inside the requested target and model family. An explicit model pin cannot become another model. The adapter receives one fixed recipient and must never switch recipients, providers, or intermediaries internally.

If a target asks for the same-host default with no distinct serving route or model, collapse to native execution. Record the target as requested and native as actual; do not create an external job merely to call the current host's default model through itself.

## Apply preference or requirement strength

**Preference-strength (`prefer`):** attempt the fixed route in both direct and automatic workflows. If preflight proves it unavailable, continue with native execution and prominently report requested versus actual route/model plus the observed `fallback_reason`.

**Requirement-strength (`require`):** if preflight proves the route unavailable, an interactive standalone run asks whether to continue natively. An automatic or headless caller must not prompt or begin native implementation; return a structured blocker. A started attempt is not preflight-unavailable: no fallback begins until it reaches an authoritative terminal or reaped state.

## Sanction before egress

Before repository content or bounded mutation authority leaves the host, disclose and durably record:

- the binding `source` that authorizes external execution;
- the fixed recipient, provider, harness route, and every intermediary;
- the repository/unit material exposed, including the bounded plan packet and workspace content;
- the caller restrictions and which are adapter-enforced versus cooperative; and
- that linked worktree isolation contains accidental concurrent mutation but is not an OS security sandbox.

Treat a required restriction the adapter cannot enforce as route unavailable; apply `prefer` or `require` instead of weakening it silently. The sanction is route-specific. Any retry that changes a recipient or intermediary requires a newly resolved and sanctioned job.

## Bound worker authority

The worker receives one unit, one workspace, one fixed recipient, and only inherited authority. It may narrow scope or authority, never broaden either. Its packet grants no canonical commit, push, PR, shipping, recipient-switch, fallback, peer scheduling, or scope-expansion authority.

An external worker may edit and commit only inside its controller-owned detached worktree. Those worker commits are intermediate evidence. Successful output terminalizes as an isolated transport commit for the host to inspect. Only the host may apply output to the canonical checkout, run authoritative verification, create a host-only canonical commit, or proceed into the standalone or caller-owned tail.

Ordinary synchronous native units stay in the active checkout. Ordinary native subagent isolation remains harness-owned. Only the external cross-model controller may create detached sibling worktrees under its private run root; this exception does not authorize `ce-work` to create worktrees for native execution.

## Preserve route and lifecycle receipts

Direct and return-to-caller runs expose the same receipt facts even though their prompting and shipping tails differ:

- `implementation_engine_binding`: resolved `mode`, `target`, `model`, and `source`;
- `requested_route` and `actual_route`, including every intermediary;
- `requested_model`, `actual_model`, and served-model receipt status;
- `fallback_reason` or `null`;
- `run_id` and per-unit `unit_receipts` that distinguish process terminal state, integration, authoritative verification, host canonical commit, and cleanup;
- `plan_checkpoint`: a disclosed host commit only when the resolved selected plan was the sole canonical dirt;
- `blockers`; and
- `recovery_path` for preserved inspectable state.

Never infer success from detached-process completion alone. The run receipt is complete only after every required unit reaches its host-owned canonical state. A plan-only checkpoint is disclosed to the direct user or returned to an automatic caller; unrelated dirt never receives an implicit checkpoint and instead makes the external route unavailable.

## Preserve tail ownership

The engine changes only implementation authorship. A standalone invocation resumes `ce-work`'s quality and shipping workflow after local implementation. `mode:return-to-caller` returns implementation and local-verification receipts with `standalone_shipping_skipped: true`; it never runs simplify/review/PR/CI gates owned by the caller. External workers never inherit either tail.
