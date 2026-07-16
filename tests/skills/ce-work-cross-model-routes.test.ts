import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

setDefaultTimeout(20_000)

const SCRIPT = path.join(process.cwd(), "skills/ce-work/scripts/cross-model-work.sh")
const SCHEMA = path.join(process.cwd(), "skills/ce-work/references/implementation-result-schema.json")
const ROUTES = ["codex", "claude", "grok-cli", "cursor", "composer", "grok-cursor"] as const
const roots: string[] = []

function temp(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix))
  roots.push(dir)
  return dir
}

afterAll(() => roots.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

function fixture() {
  const root = temp("ce-work-route-")
  const workspace = path.join(root, "workspace")
  const resultDir = path.join(root, "result")
  const packet = path.join(root, "packet.md")
  const capture = path.join(root, "capture")
  mkdirSync(workspace)
  mkdirSync(resultDir)
  mkdirSync(capture)
  writeFileSync(packet, "Implement U3 only.\n")
  spawnSync("git", ["init", "-q", workspace])
  spawnSync("git", ["-C", workspace, "config", "user.email", "test@example.com"])
  spawnSync("git", ["-C", workspace, "config", "user.name", "Test"])
  writeFileSync(path.join(workspace, "README.md"), "seed\n")
  spawnSync("git", ["-C", workspace, "add", "README.md"])
  spawnSync("git", ["-C", workspace, "commit", "-qm", "seed"])
  return { root, workspace, resultDir, packet, capture }
}

function fakeBin(route: typeof ROUTES[number], capture: string, response?: string) {
  const bin = temp("ce-work-bin-")
  const binary = route === "grok-cli" ? "grok" : route === "grok-cursor" || route === "cursor" || route === "composer" ? "cursor-agent" : route
  const final = response ?? '{"terminal_status":"completed","summary":"implemented","changed_files":["result.txt"],"evidence":["focused test passed"],"scope_expansion":null}'
  const script = `#!/bin/sh
set -eu
printf '%s\\n' "$@" > '${capture}/argv'
printf '%s' "$PWD" > '${capture}/pwd'
env | sort > '${capture}/env'
cat > '${capture}/stdin'
printf 'READY\\n' > result.txt
case '${route}' in
  codex)
    out=''
    previous=''
    for arg in "$@"; do
      if [ "$previous" = '-o' ]; then out="$arg"; fi
      previous="$arg"
    done
    printf '%s\\n' '{"type":"item.completed"}'
    printf '%s\\n' '${final.replaceAll("'", "'\\''")}' > "$out"
    ;;
  claude)
    printf '%s\\n' '{"type":"system","subtype":"init","model":"claude-fable-5"}'
    printf '%s\\n' '${final.replaceAll("'", "'\\''")}'
    ;;
  cursor|composer|grok-cursor)
    model='Cursor Grok 4.5 High'
    [ '${route}' = composer ] && model='Composer 2.5 Fast'
    printf '%s\\n' "{\\"type\\":\\"system\\",\\"subtype\\":\\"init\\",\\"model\\":\\"$model\\"}"
    printf '%s\\n' '${final.replaceAll("'", "'\\''")}'
    ;;
  grok-cli)
    printf '%s\\n' '{"type":"activity","message":"editing"}'
    printf '%s\\n' '${final.replaceAll("'", "'\\''")}'
    ;;
esac
`
  writeFileSync(path.join(bin, binary), script)
  chmodSync(path.join(bin, binary), 0o755)
  return bin
}

function run(
  route: typeof ROUTES[number],
  f: ReturnType<typeof fixture>,
  env: NodeJS.ProcessEnv = process.env,
) {
  const proc = spawnSync("bash", [SCRIPT, route, f.workspace, f.packet, f.resultDir], {
    encoding: "utf8",
    env,
  })
  const resultPath = path.join(f.resultDir, "implementation-result.json")
  return {
    code: proc.status ?? -1,
    stderr: proc.stderr ?? "",
    result: existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, "utf8")) : null,
  }
}

function emit(route: string, env: NodeJS.ProcessEnv = process.env) {
  return spawnSync("bash", [SCRIPT, "--emit-adapter", route], { encoding: "utf8", env })
}

describe("ce-work fixed write routes", () => {
  test("production argv uses the qualified noninteractive write posture", () => {
    for (const route of ROUTES) expect(emit(route).status).toBe(0)

    const codex = emit("codex").stdout
    expect(codex).toContain("exec")
    expect(codex).toContain("--ephemeral")
    expect(codex).toContain("-s workspace-write")
    expect(codex).toContain("-C <workspace>")

    const claude = emit("claude").stdout
    expect(claude).toContain("--safe-mode")
    expect(claude).toContain("--permission-mode acceptEdits")
    expect(claude).toContain("--tools Read,Write,Edit")
    expect(claude).toContain("--no-session-persistence")

    const grok = emit("grok-cli").stdout
    expect(grok).toContain("--cwd <workspace>")
    expect(grok).toContain("--permission-mode acceptEdits")
    expect(grok).toContain("--no-memory")
    expect(grok).toContain("--no-subagents")

    for (const route of ["cursor", "composer", "grok-cursor"]) {
      const command = emit(route).stdout
      expect(command).toContain("--sandbox enabled")
      expect(command).toContain("--workspace <workspace>")
      expect(command).toContain("--output-format stream-json")
    }
    expect(emit("cursor").stdout).not.toContain("--model")
    expect(emit("composer").stdout).toContain("--model composer-2.5-fast")
    expect(emit("grok-cursor").stdout).toContain("--model cursor-grok-4.5-high")
  })

  test.each(ROUTES)("%s receives one workspace and bounded packet", (route) => {
    const f = fixture()
    const bin = fakeBin(route, f.capture)
    const result = run(route, f, {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ...(route === "grok-cursor" ? { CE_WORK_CURSOR_INTERMEDIARY_SANCTIONED: "1" } : {}),
    })
    expect(result.code).toBe(0)
    expect(readFileSync(path.join(f.capture, "pwd"), "utf8")).toBe(realpathSync(f.workspace))
    expect(readFileSync(path.join(f.capture, "stdin"), "utf8")).toContain("Implement U3 only.")
    expect(readFileSync(path.join(f.workspace, "result.txt"), "utf8")).toBe("READY\n")
    expect(result.result.terminal_status).toBe("completed")
    expect(result.result.requested_route).toBe(route)
    expect(result.result.actual_route).toBe(route)
    expect(result.result.activity_posture).toBe("incremental")
    expect(result.result.raw_log).toBe(path.join(realpathSync(f.resultDir), "adapter.log"))
    if (route === "codex" || route === "grok-cli") {
      expect(result.result.model_actual).toBe("unverified")
      expect(result.result.model_receipt_status).toBe("unverified")
    } else {
      expect(result.result.model_actual).not.toBe("unverified")
      expect(result.result.model_receipt_status).toBe("verified")
    }
  })

  test("Cursor default cannot be forced and Composer rejects a different family", () => {
    const cursor = emit("cursor", {
      ...process.env,
      CE_WORK_MODEL_OVERRIDE_TARGET: "cursor",
      CE_WORK_MODEL_OVERRIDE: "cursor-grok-4.5-high",
    })
    expect(cursor.status).toBe(2)
    expect(cursor.stderr).toContain("not compatible")

    const composer = emit("composer", {
      ...process.env,
      CE_WORK_MODEL_OVERRIDE_TARGET: "composer",
      CE_WORK_MODEL_OVERRIDE: "gpt-5.6-sol",
    })
    expect(composer.status).toBe(2)
    expect(composer.stderr).toContain("not compatible")

    const compatible = emit("composer", {
      ...process.env,
      CE_WORK_MODEL_OVERRIDE_TARGET: "composer",
      CE_WORK_MODEL_OVERRIDE: "composer-next-fast",
    })
    expect(compatible.status).toBe(0)
    expect(compatible.stdout).toContain("--model composer-next-fast")
  })

  test("Grok through Cursor requires separate intermediary sanction", () => {
    const f = fixture()
    const bin = fakeBin("grok-cursor", f.capture)
    const blocked = run("grok-cursor", f, { ...process.env, PATH: `${bin}:${process.env.PATH}` })
    expect(blocked.code).toBe(2)
    expect(blocked.result.terminal_status).toBe("unavailable")
    expect(blocked.result.failure_reason).toContain("intermediary")
    expect(existsSync(path.join(f.capture, "argv"))).toBe(false)

    const allowed = run("grok-cursor", f, {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CE_WORK_CURSOR_INTERMEDIARY_SANCTIONED: "1",
    })
    expect(allowed.code).toBe(0)
  })

  test.each(["claude", "grok-cli"] as const)("%s is unavailable when enforceable confinement is required", (route) => {
    const f = fixture()
    const bin = fakeBin(route, f.capture)
    const result = run(route, f, {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CE_WORK_REQUIRE_ENFORCED_CONFINEMENT: "1",
    })
    expect(result.code).toBe(2)
    expect(result.result.terminal_status).toBe("unavailable")
    expect(result.result.failure_reason).toContain("cooperative")
    expect(existsSync(path.join(f.capture, "argv"))).toBe(false)
  })
})

describe("ce-work adapter results, identity, and secret handling", () => {
  test("a route failure returns evidence without changing recipient", () => {
    const f = fixture()
    const bin = fakeBin("grok-cli", f.capture)
    writeFileSync(path.join(bin, "grok"), `#!/bin/sh\nprintf '%s\\n' "$@" > '${f.capture}/argv'\nprintf 'quota exhausted\\n' >&2\nexit 7\n`)
    chmodSync(path.join(bin, "grok"), 0o755)
    const cursorMarker = path.join(f.capture, "cursor-invoked")
    writeFileSync(path.join(bin, "cursor-agent"), `#!/bin/sh\n: > '${cursorMarker}'\n`)
    chmodSync(path.join(bin, "cursor-agent"), 0o755)
    const result = run("grok-cli", f, { ...process.env, PATH: `${bin}:${process.env.PATH}` })
    expect(result.code).toBe(1)
    expect(result.result.terminal_status).toBe("failed")
    expect(result.result.failure_reason).toContain("exit 7")
    expect(readFileSync(path.join(f.resultDir, "adapter.log"), "utf8")).toContain("quota exhausted")
    expect(existsSync(cursorMarker)).toBe(false)
  })

  test("scope expansion is terminalized for host handling", () => {
    const f = fixture()
    const response = '{"terminal_status":"scope_expansion","summary":"shared contract needed","changed_files":[],"evidence":[],"scope_expansion":{"requested_paths":["shared.ts"],"reason":"required by unit"}}'
    const bin = fakeBin("claude", f.capture, response)
    const result = run("claude", f, { ...process.env, PATH: `${bin}:${process.env.PATH}` })
    expect(result.code).toBe(3)
    expect(result.result.terminal_status).toBe("scope_expansion")
    expect(result.result.scope_expansion.requested_paths).toEqual(["shared.ts"])
  })

  test.each([
    ["claude-fable-5", "verified"],
    ["claude-opus-4-8", "mismatch"],
    ["", "unverified"],
  ] as const)("Claude served-model receipt %s normalizes as %s", (served, receipt) => {
    const f = fixture()
    const bin = fakeBin("claude", f.capture)
    const body = `#!/bin/sh
cat > '${f.capture}/stdin'
printf 'READY\\n' > result.txt
${served ? `printf '%s\\n' '{"type":"system","subtype":"init","model":"${served}"}'` : "printf '%s\\n' '{\"type\":\"activity\"}'"}
printf '%s\\n' '{"terminal_status":"completed","summary":"done","changed_files":["result.txt"],"evidence":[],"scope_expansion":null}'
`
    writeFileSync(path.join(bin, "claude"), body)
    chmodSync(path.join(bin, "claude"), 0o755)
    const result = run("claude", f, { ...process.env, PATH: `${bin}:${process.env.PATH}` })
    expect(result.result.model_actual).toBe(served || "unverified")
    expect(result.result.model_receipt_status).toBe(receipt)
  })

  test("sentinel values are removed from environment, prompt, result, log, and argv", () => {
    const sentinel = "SENTINEL-credential-123"
    const f = fixture()
    writeFileSync(f.packet, `Implement U3. Token: ${sentinel}\n`)
    const redactions = path.join(f.root, "redactions")
    writeFileSync(redactions, `${sentinel}\n`)
    const response = `{"terminal_status":"completed","summary":"saw ${sentinel}","changed_files":["result.txt"],"evidence":[],"scope_expansion":null}`
    const bin = fakeBin("codex", f.capture, response)
    const result = run("codex", f, {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CE_WORK_REDACT_FILE: redactions,
      SENTINEL_ENV: sentinel,
    })
    expect(result.code).toBe(0)
    for (const file of ["argv", "stdin", "env"]) {
      expect(readFileSync(path.join(f.capture, file), "utf8")).not.toContain(sentinel)
    }
    for (const file of readdirSync(f.resultDir)) {
      expect(readFileSync(path.join(f.resultDir, file), "utf8")).not.toContain(sentinel)
      expect(statSync(path.join(f.resultDir, file)).mode & 0o777).toBe(0o600)
    }
    expect(statSync(f.resultDir).mode & 0o777).toBe(0o700)
    expect(JSON.stringify(result.result)).not.toContain(sentinel)
    expect(readFileSync(path.join(f.capture, "stdin"), "utf8")).toContain("[REDACTED]")
  })

  test("malformed terminal output is a schema failure with a redacted log", () => {
    const f = fixture()
    const bin = fakeBin("cursor", f.capture, "not-json")
    const result = run("cursor", f, { ...process.env, PATH: `${bin}:${process.env.PATH}` })
    expect(result.code).toBe(1)
    expect(result.result.terminal_status).toBe("failed")
    expect(result.result.failure_reason).toContain("schema")
    expect(existsSync(path.join(f.resultDir, "adapter.log"))).toBe(true)
  })

  test("the worker result schema pins terminal and scope-expansion shapes", () => {
    const schema = JSON.parse(readFileSync(SCHEMA, "utf8"))
    expect(schema.$schema).toContain("json-schema")
    expect(schema.required).toContain("terminal_status")
    expect(schema.properties.terminal_status.enum).toEqual(["completed", "blocked", "scope_expansion"])
    expect(schema.additionalProperties).toBe(false)
  })
})
