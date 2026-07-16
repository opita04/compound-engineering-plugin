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
    expect(engineGate).toContain("**Isolation is the harness's job, never ce-work's**")
    expect(engineGate).toContain("never run `git worktree add` yourself")
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
