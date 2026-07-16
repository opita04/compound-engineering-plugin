import { readFile } from "fs/promises"
import path from "path"
import { describe, expect, test } from "bun:test"

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8")
}

async function readImplementationContract(): Promise<string> {
  const skill = await readRepoFile("skills/ce-work/SKILL.md")
  const implementationLoop = await readRepoFile("skills/ce-work/references/implementation-loop.md").catch(() => "")
  return `${skill}\n${implementationLoop}`
}

function sliceSection(content: string, startAnchor: string, endAnchor: string): string {
  const start = content.indexOf(startAnchor)
  expect(start, `start anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = content.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `end anchor not found: ${endAnchor}`).toBeGreaterThan(start)
  return content.slice(start, end)
}

describe("ce-work native characterization", () => {
  test("opens with result, next consumer, done condition, and host-owned canonical integration", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const outcome = sliceSection(skill, "## Outcome", "## Input Document")

    expect(outcome).toContain("**Result:**")
    expect(outcome).toContain("**Next consumer:**")
    expect(outcome).toContain("**Done:**")
    expect(outcome).toContain("**Intent:**")
    expect(outcome).toContain("host orchestrator")
    expect(outcome).toContain("authoritative verification and canonical commits")
    expect(skill.indexOf("## Outcome")).toBeLessThan(skill.indexOf("## Execution Workflow"))
  })

  test("classifies caller mode, legacy aliases, bare prompts, and plans before execution", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const triage = sliceSection(skill, "### Phase 0: Input Triage", "### Phase 1: Quick Start")

    expect(triage).toContain("**First, parse a leading mode token.**")
    expect(triage).toContain("mode:return-to-caller")
    expect(triage).toContain("mode:caller-owned-tail")
    expect(triage).toContain("caller:lfg")
    expect(triage).toContain("**Plan document**")
    expect(triage).toContain("**Blank invocation latest-plan discovery:**")
    expect(triage).toContain("**Bare prompt**")
  })

  test("keeps the existing native engines and synchronous inline path", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const engineGate = sliceSection(skill, "4. **Choose Execution Engine, then Strategy**", "### Phase 2: Execute")

    expect(engineGate).toContain("inline/subagent")
    expect(engineGate).toContain("goal-mode")
    expect(engineGate).toContain("dynamic-workflow")
    expect(engineGate).toMatch(/\*\*Inline\*\* \| Trivial work/)
    expect(engineGate).toContain("ordinary native workers")
    expect(engineGate).toContain("never run `git worktree add` yourself")
    expect(engineGate).toContain("external cross-model controller")
  })

  test("bounds worker scope while leaving canonical verification and commits with the orchestrator", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const dispatch = sliceSection(skill, "**Dispatch** uses your harness's subagent/worker mechanism", "### Phase 2: Execute")

    expect(dispatch).toContain("**bounded unit packet**")
    expect(dispatch).toContain("A downstream worker may narrow that unit and authority, never broaden either")
    expect(dispatch).toContain("Do not send \"read the whole plan\"")
    expect(dispatch).toContain("**Do not commit.**")
    expect(dispatch).toContain("**orchestrator owns staging, committing, and the authoritative test runs**")
    expect(dispatch).toContain("Review, test, and commit each unit in dependency order — the orchestrator owns commits")
  })

  test("preserves standalone shipping and return-to-caller tail ownership", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const standalone = sliceSection(skill, "### Phase 3-4: Quality Check and Finishing Work", "## Return-to-Caller Mode")
    const caller = sliceSection(skill, "## Return-to-Caller Mode", "## Key Principles")

    expect(standalone).toContain("references/shipping-workflow.md")
    expect(caller).toContain("implementation and local verification only")
    expect(caller).toContain("structured summary instead of running the standalone shipping tail")
    expect(caller).toContain("standalone_shipping_skipped: true")
    expect(caller).toContain("must not open a PR")
  })
})

describe("ce-work cross-model engine contract", () => {
  test("adds a dormant fourth engine with exact binding precedence and config modes", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const engines = await readRepoFile("skills/ce-work/references/execution-engines.md")
    const engineGate = sliceSection(skill, "4. **Choose Execution Engine, then Strategy**", "### Phase 2: Execute")

    expect(engineGate).toContain("cross-model execution")
    expect(engineGate).toContain("native execution remains the default")
    expect(engines).toContain("current-turn directive > typed caller binding > per-checkout configuration > native")
    expect(engines).toContain("work_engine_mode")
    expect(engines).toContain("`off | prefer | require`")
    expect(engines).toContain("work_engine_target")
    expect(engines).toContain("work_engine_model")
    expect(engines).toContain("`off` disables only the standing preference")
    expect(engines).toContain("strict Composer")
    expect(engines).toContain("caller Codex")
    expect(engines).toContain("config Claude")
  })

  test("keeps the caller carrier implementation-only and exactly four fields", async () => {
    const engines = await readRepoFile("skills/ce-work/references/execution-engines.md")
    const carrier = sliceSection(engines, "### Typed caller binding", "### Target and identity vocabulary")

    expect(carrier).toContain("implementation_engine")
    for (const field of ["mode", "target", "model", "source"]) {
      expect(carrier).toContain(`\`${field}\``)
    }
    expect(carrier).toContain("exactly these four fields")
    expect(carrier).toContain("only at the `ce-work` seam")
    expect(carrier).toContain("never enter planning or review input")
    expect(engines).not.toContain("work_delegate_")
  })

  test("distinguishes Cursor from Composer and collapses same-host default execution", async () => {
    const protocol = await readRepoFile("skills/ce-work/references/cross-model-execution.md")

    expect(protocol).toContain("`cursor` means the Cursor harness with its configured default model")
    expect(protocol).toContain("`composer` means a Composer-family model through Cursor")
    expect(protocol).toContain("same-host default")
    expect(protocol).toContain("collapse to native execution")
    expect(protocol).toContain("codex")
    expect(protocol).toContain("claude")
    expect(protocol).toContain("grok")
  })

  test("defines prefer, require, fixed-recipient sanction, and restriction failure", async () => {
    const protocol = await readRepoFile("skills/ce-work/references/cross-model-execution.md")

    expect(protocol).toContain("Preference-strength")
    expect(protocol).toContain("Requirement-strength")
    expect(protocol).toContain("automatic or headless")
    expect(protocol).toContain("must not prompt")
    expect(protocol).toContain("fixed recipient")
    expect(protocol).toContain("every intermediary")
    expect(protocol).toContain("material exposed")
    expect(protocol).toContain("caller restrictions")
    expect(protocol).toContain("required restriction")
    expect(protocol).toContain("route unavailable")
    expect(protocol).toContain("never switch recipients")
  })

  test("preserves host-only canonical authority and narrows the worktree exception", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const protocol = await readRepoFile("skills/ce-work/references/cross-model-execution.md")
    const engineGate = sliceSection(skill, "4. **Choose Execution Engine, then Strategy**", "### Phase 2: Execute")

    expect(engineGate).toContain("ordinary native workers")
    expect(engineGate).toContain("external cross-model controller")
    expect(protocol).toContain("isolated transport commit")
    expect(protocol).toContain("host-only canonical")
    for (const forbiddenAuthority of ["canonical commit", "push", "PR", "shipping", "recipient-switch"]) {
      expect(protocol).toContain(forbiddenAuthority)
    }
    expect(protocol).toContain("may narrow")
    expect(protocol).toContain("never broaden")
  })

  test("loads the cross-model protocol only when that engine is selected", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const engineGate = sliceSection(skill, "4. **Choose Execution Engine, then Strategy**", "### Phase 2: Execute")

    expect(engineGate).toContain("If and only if cross-model execution is selected")
    expect(engineGate).toContain("read `references/cross-model-execution.md`")
    expect(skill.match(/references\/cross-model-execution\.md/g)?.length).toBe(1)
  })

  test("returns requested and actual route, model, fallback, run, unit, blocker, and recovery receipts", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const caller = sliceSection(skill, "## Return-to-Caller Mode", "## Key Principles")

    for (const receipt of [
      "implementation_engine_binding",
      "requested_route",
      "actual_route",
      "requested_model",
      "actual_model",
      "fallback_reason",
      "run_id",
      "unit_receipts",
      "blockers",
      "recovery_path",
      "plan_checkpoint",
    ]) {
      expect(caller).toContain(receipt)
    }
    expect(caller).toContain("standalone_shipping_skipped: true")
  })

  test("defines an executable serial external-unit transaction before any parallel protocol", async () => {
    const protocol = await readRepoFile("skills/ce-work/references/cross-model-execution.md")
    const serial = sliceSection(protocol, "## Serial external-unit protocol", "## Preserve tail ownership")

    for (const command of [
      "unit-workspace.py` `init",
      "unit-workspace.py` `checkpoint-plan",
      "unit-workspace.py` `prepare",
      "peer-job-runner.py` `start --no-sweep",
      "cross-model-work.sh",
      "unit-workspace.py` `record-job",
      "unit-workspace.py` `terminalize",
      "unit-workspace.py` `integration-acquire",
      "unit-workspace.py` `preflight",
      "git cherry-pick --no-commit",
      "unit-workspace.py` `mark-applied",
      "unit-workspace.py` `mark-verified",
      "unit-workspace.py` `mark-committed",
      "unit-workspace.py` `cleanup",
      "unit-workspace.py` `integration-release",
    ]) {
      expect(serial).toContain(command)
    }
    expect(serial).toContain("one bounded unit packet")
    expect(serial).toContain("inspect the actual transport diff")
    expect(serial).toContain("authoritative canonical verification")
    expect(serial).toContain("restore")
    expect(serial).toContain("before fallback, retry, or another unit")
    expect(serial.indexOf("integration-acquire")).toBeLessThan(serial.indexOf("git cherry-pick --no-commit"))
    expect(serial.indexOf("mark-verified")).toBeLessThan(serial.indexOf("mark-committed"))
  })

  test("defines exactly-once resume, recovery discovery, and post-start fallback gates", async () => {
    const protocol = await readRepoFile("skills/ce-work/references/cross-model-execution.md")

    expect(protocol).toContain("unit-workspace.py` `resume --run-id")
    expect(protocol).toContain("list the matching run ids")
    expect(protocol).toContain("must not redispatch, reapply, recommit, or run either owning tail")
    expect(protocol).toContain("unit-workspace.py` `claim-fallback")
    expect(protocol).toContain("exactly one native fallback")
    expect(protocol).toContain("FALLBACK_ALREADY_AUTHORIZED")
    expect(protocol).toContain("CHOICE_REQUIRED")
    expect(protocol).toContain("headless `require` remains blocked")
    expect(protocol).toContain("exact restoration")
    expect(protocol).toContain("expected post-apply tree and changed-path set")
    expect(protocol).toContain("unknown dirt blocks without destructive restoration")
    expect(protocol).toContain("status`, `reap`, and `cleanup")
  })

  test("separates scheduling from engine/workspace selection and declines unsafe waves", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const loop = await readRepoFile("skills/ce-work/references/implementation-loop.md")
    const gate = sliceSection(skill, "**Parallel Safety Check**", "**Dispatch** uses your harness's subagent/worker mechanism")

    expect(gate).toContain("separate from engine and workspace selection")
    expect(gate).toContain("decline parallelism")
    expect(gate).toContain("dependencies")
    expect(gate).toContain("declared files")
    expect(gate).toContain("shared types/APIs/interfaces")
    expect(gate).toContain("migrations")
    expect(gate).toContain("lockfiles")
    expect(gate).toContain("generated")
    expect(gate).toContain("registry")
    expect(gate).toContain("config")
    expect(gate).toContain("environment singleton")
    expect(gate).toContain("expected merge")
    expect(gate).toContain("3-5")
    expect(gate).toContain("every concurrent worker")
    expect(gate).toContain("isolated workspace")
    expect(gate).toContain("synchronous native")
    expect(gate).toContain("active checkout")
    expect(loop).toContain("Repeated collision")
    expect(loop).toContain("disable further parallel waves")
  })

  test("defines same-base parallel authoring with serial semantic fold-in", async () => {
    const protocol = await readRepoFile("skills/ce-work/references/cross-model-execution.md")
    const wave = sliceSection(protocol, "## Parallel external-wave protocol", "## Resume and fallback exactly once")

    expect(wave).toContain("one recorded wave base")
    expect(wave).toContain("terminalize every worker")
    expect(wave).toContain("before the first fold-in")
    expect(wave).toContain("sequentially")
    expect(wave).toContain("wave-advance")
    expect(wave).toContain("exact earlier host-owned canonical commits")
    expect(wave).toContain("semantic")
    expect(wave).toContain("clean textual apply")
    expect(wave).toContain("restoration")
    expect(wave).toContain("dependents remain queued")
    expect(wave).toContain("unaffected siblings")
    expect(wave).toContain("re-dispatch")
    expect(wave).toContain("serial fallback")
    expect(wave).toContain("never blind-merge")
  })
})

describe("ce-work implementation evidence characterization", () => {
  test("loads the extracted protocol only at the implementation gate", async () => {
    const skill = await readRepoFile("skills/ce-work/SKILL.md")
    const implementationLoop = await readRepoFile("skills/ce-work/references/implementation-loop.md")
    const phase2 = sliceSection(skill, "### Phase 2: Execute", "### Phase 3-4: Quality Check and Finishing Work")

    expect(phase2).toContain("you must read `references/implementation-loop.md`")
    expect(phase2.indexOf("references/implementation-loop.md")).toBeLessThan(phase2.indexOf("2. **Incremental Commits**"))
    expect(skill).not.toContain("1. **Task Execution Loop**")
    expect(skill).not.toContain("**Evidence Strategy** — Test discovery decides where proof belongs")
    expect(implementationLoop).toContain("1. **Task Execution Loop**")
    expect(implementationLoop).toContain("**Evidence Strategy** — Test discovery decides where proof belongs")
  })

  test("retains every task evidence and verification stop across relocation", async () => {
    const contract = await readImplementationContract()
    const orderedStops = [
      "Mark task as in-progress",
      "Choose the evidence strategy for this task before changing behavior",
      "verify the expected failure or baseline capture before changing production code",
      "Implement following existing conventions",
      "Run System-Wide Test Check",
      "Run tests after changes",
      "Assess testing coverage",
      "Record verification evidence for the task",
      "Mark task as completed",
      "Evaluate for incremental commit",
    ]

    let previous = -1
    for (const stop of orderedStops) {
      const current = contract.indexOf(stop)
      expect(current, `missing implementation stop: ${stop}`).toBeGreaterThan(previous)
      previous = current
    }

    expect(contract).toContain("Guardrails for execution evidence:")
    expect(contract).toContain("**Test Discovery**")
    expect(contract).toContain("**Evidence Strategy**")
    expect(contract).toContain("**Test Scenario Completeness**")
    expect(contract).toContain("**System-Wide Test Check**")
  })
})
