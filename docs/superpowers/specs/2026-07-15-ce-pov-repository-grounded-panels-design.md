# Repository-Grounded Cross-Model Panels for `ce-pov`

## Outcome

Extend `ce-pov` so a short, intent-aware request can convene named independent reviewers, let each reviewer inspect the current repository within a common read boundary, reconcile disagreements against coordinator-verified project evidence, and return an auditable verdict. The POV remains the deliverable; mutation occurs only through an explicitly authorized downstream workflow.

## Invocation and Participant Resolution

`ce-pov` resolves deictic subjects such as "the approach," "these options," and "the three options presented" from the active conversation when there is one unambiguous referent. It asks one focused clarification only when multiple plausible referents would materially change the review.

`oracle` requests immediate independent-panel convergence. Explicitly named peers select the exact participants and take precedence over automatic availability discovery. For example:

```text
/ce-pov oracle with codex and composer on the approach
/ce-pov oracle with codex and composer on the 3 options presented
```

## Shared Read Scope

Before dispatch, the host discloses that repository content included in prompts or read by external peer harnesses may leave the current harness's trust boundary and obtains the consent required by the existing panel protocol.

By default, every peer receives the repository root as its read-only working scope. A narrower user- or host-supplied filter is binding and is passed identically to every peer. The skill never broadens that scope. Adapters enforce the boundary through read-only sandbox and workspace controls where the harness supports them; otherwise the prompt states the exact restriction and the disclosure identifies that enforcement is cooperative. Higher-priority host restrictions always win.

Peers may search and read within the allowed scope but may not edit files, run mutating commands, or inspect outside it. Temporary prompt and result artifacts remain in OS temp and are not treated as project evidence.

## Panel Protocol

1. The host forms its own repository-grounded POV before reading peer conclusions.
2. Each peer independently inspects the same read scope and returns a structured initial position with evidence locations.
3. The host compares positions and identifies disputed claims that could change the decision.
4. Before each reconciliation round, the host verifies those claims against the repository and produces one bounded evidence delta. Each entry is classified `verified`, `contradicted`, or `unverifiable` and includes source locations when available.
5. Every peer receives the same positions and evidence delta, then returns an explicit movement state:
   - `initial` for its first position;
   - `moved` when the decision-relevant position changed, with what changed and why;
   - `held` when it did not, with why the new evidence was insufficient.
6. The host stops on convergence, a bounded no-movement round, or the existing round/time budget, then reports the decisive disagreement rather than manufacturing consensus.

Explicit movement makes convergence auditable. It distinguishes a substantive change of position from a wording change and makes a no-movement stop reliable; the earlier free-form comparison could not do either consistently.

## Mutation and Handoff Boundary

`ce-pov` does not mutate project state while forming or reconciling a POV.

If the original request authorized only analysis, the result offers one logical next step and waits for the user. If the original request explicitly authorized a downstream action, such as "consult the panel, then implement the winner," `ce-pov` may hand the final verdict to the owning execution skill with the inherited scope and authority. This is a downstream continuation, not panel mutation.

The workflow returns to the user before action when the panel is stalemated, the recommended action expands scope, or the action is destructive or otherwise requires fresh authority.

## Failure and Degradation

Missing peers, timeouts, malformed output, or unavailable enforcement controls are reported per participant. The host may continue with the remaining valid positions if the result still satisfies the requested panel shape; otherwise it returns the partial evidence and names the blocker. Repository access is an input to peer judgment, never permission to mutate.

## Validation

Deterministic tests will pin:

- exact-participant precedence for `oracle` plus named peers;
- unambiguous conversational subject resolution and focused ambiguity handling;
- repository-root default access and identical propagation of a narrowed scope;
- read-only adapter arguments and truthful cooperative-enforcement disclosure;
- identical coordinator evidence deltas for all peers;
- required `initial`, `moved`, and `held` output states;
- no mutation for analysis-only requests and downstream handoff only when originally authorized.

Fresh-context skill evaluations will exercise the two shorthand examples, an ambiguous referent, a restricted read filter, a disagreement that produces both `moved` and `held`, analysis-only next-step offering, and an explicitly authorized implementation handoff. The repository's full mechanical verification contract remains required before completion.

## Non-Goals

- Depending on Orca orchestration as a runtime requirement.
- Promising identical tool enforcement across peer CLIs that expose different sandbox controls.
- Allowing peers to edit the repository or treating consensus as a substitute for evidence.
- Automatically implementing a recommendation that the original user request did not authorize.
