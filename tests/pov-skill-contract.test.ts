import { readFile } from "fs/promises"
import path from "path"
import { describe, expect, test } from "bun:test"

const ROOT = process.cwd()

async function skillFile(relative: string): Promise<string> {
  return readFile(path.join(ROOT, "skills/ce-pov", relative), "utf8")
}

function between(content: string, start: string, end: string): string {
  const from = content.indexOf(start)
  const to = content.indexOf(end, from + start.length)
  if (from < 0 || to <= from) throw new Error(`missing contract region: ${start} -> ${end}`)
  return content.slice(from, to)
}

describe("ce-pov subject-shape contract", () => {
  test("the activation contract names all three POV shapes and preserves the cache helper", async () => {
    const skill = await skillFile("SKILL.md")

    expect(skill).toContain("external-adoption question")
    expect(skill).toContain("holistic take")
    expect(skill).toContain("approach set")
    expect(skill).toContain('scripts/repo-profile-cache.py" get')
  })

  test("intake and boundaries distinguish takes, findings reviews, and supplied approaches", async () => {
    const [intake, boundaries] = await Promise.all([
      skillFile("references/intake.md"),
      skillFile("references/boundaries.md"),
    ])

    expect(intake).toContain("**Document-take**")
    expect(intake).toContain("**Approach-set**")
    expect(boundaries).toContain('"review this doc"')
    expect(boundaries).toContain('"what do you think of this doc?"')
    expect(boundaries).toContain("`ce-doc-review`")
    expect(boundaries).toContain("Options supplied")
    expect(boundaries).toContain("`ce-ideate`")
  })

  test("method keeps adoption grades and defines honest non-adoption outcomes", async () => {
    const method = await skillFile("references/method.md")

    for (const grade of ["**Adopt**", "**Trial**", "**Hold**", "**Reject**", "**Not-our-problem**"]) {
      expect(method).toContain(grade)
    }
    expect(method).toContain('**"Blocked — insufficient project grounding"**')
    expect(method).toContain('**"Blocked — external evidence unavailable"**')
    expect(method).toContain('**"Either is viable"**')
    expect(method).toContain("Never manufacture certainty with a scorecard")
  })
})

describe("ce-pov cross-model panel contract", () => {
  test("pins participation counts and the complete stop-rule enum", async () => {
    const panel = await skillFile("references/cross-model-panel.md")

    expect(panel).toContain("Named peers are exact and uncapped")
    expect(panel).toContain("**2-peer panel cap**")
    for (const stop of ["**`confident`**", "**`no-movement`**", "**`cap-2`**"]) {
      expect(panel).toContain(stop)
    }
  })

  test("pins material dissent for every subject and bounded reconcile context", async () => {
    const panel = await skillFile("references/cross-model-panel.md")

    expect(panel).toContain("adoption: a different grade")
    expect(panel).toContain("approach set: a different chosen option")
    expect(panel).toContain("document: bottom lines imply different reader actions")
    expect(panel).toContain("full original subject payload")
    expect(panel).toContain("5 succinct, source-attributed evidence bullets per voice")
  })

  test("pins pre-egress candidate-chain and debate-round disclosure", async () => {
    const panel = await skillFile("references/cross-model-panel.md")

    expect(panel).toContain("Before any payload leaves the host")
    expect(panel).toContain("full ordered candidate chain")
    expect(panel).toContain("every intermediary that may receive the payload")
    expect(panel).toContain("a debate round additionally sends every surviving voice's position")
    expect(panel).toContain("reasoning, and evidence summaries")
  })

  test("the worker rejects output without non-empty string position and reasoning", async () => {
    const worker = await skillFile("scripts/cross-model-pov.sh")
    const usableOutputGate = between(worker, "out_missing_or_invalid()", "# The cursor-agent route")

    expect(usableOutputGate).toContain('(.position|type)=="string" and (.position|length)>0')
    expect(usableOutputGate).toContain('(.reasoning|type)=="string" and (.reasoning|length)>0')
  })
})
