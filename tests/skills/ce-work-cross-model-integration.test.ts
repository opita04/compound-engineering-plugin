import { afterEach, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const CONTROLLER = path.join(process.cwd(), "skills/ce-work/scripts/unit-workspace.py")
const RUNNER = path.join(process.cwd(), "skills/ce-work/scripts/peer-job-runner.py")
const roots: string[] = []

function temp(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix))
  roots.push(dir)
  return dir
}

function run(cwd: string, argv: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(argv[0], argv.slice(1), { cwd, env, encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error(`${argv.join(" ")}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`)
  }
  return result.stdout.trim()
}

function git(repo: string, ...args: string[]): string {
  return run(repo, ["git", ...args])
}

function control(runs: string, ...args: string[]) {
  const stdout = run(process.cwd(), ["python3", CONTROLLER, ...args], {
    ...process.env,
    CE_WORK_RUNS_ROOT: runs,
    CE_PEER_JOBS_ROOT: path.dirname(runs),
  })
  const [word, ...body] = stdout.split("\n")
  return { word, body: JSON.parse(body.join("\n")) }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("ce-work serial cross-model transaction", () => {
  test("detached fake author terminalizes a complete delta that the host verifies and commits", () => {
    const root = temp("ce-work-integration-")
    const repo = path.join(root, "repo")
    const peerRoot = path.join(root, "jobs")
    const runs = path.join(peerRoot, "ce-work")
    mkdirSync(repo)
    git(repo, "init", "-b", "main")
    git(repo, "config", "user.name", "CE Work Host")
    git(repo, "config", "user.email", "host@example.test")
    mkdirSync(path.join(repo, "docs", "plans"), { recursive: true })
    writeFileSync(path.join(repo, "docs", "plans", "plan.md"), "# Plan\n")
    writeFileSync(path.join(repo, "existing.txt"), "before\n")
    writeFileSync(path.join(repo, "delete.txt"), "delete\n")
    git(repo, "add", ".")
    git(repo, "commit", "-m", "seed")
    const base = git(repo, "rev-parse", "HEAD")
    const plan = path.join(repo, "docs", "plans", "plan.md")
    const planDigest = createHash("sha256").update(readFileSync(plan)).digest("hex")

    expect(control(
      runs,
      "init",
      "--run-id", "serial-run",
      "--repo", repo,
      "--plan", plan,
      "--plan-digest", planDigest,
      "--binding-json", '{"mode":"prefer","target":"codex","model":null,"source":"test"}',
      "--egress-json", '{"sanction_source":"test","route":"codex","intermediaries":[],"exposed_material":["U4a"],"restrictions":[]}',
    ).word).toBe("READY")

    const packetDigest = createHash("sha256").update("U4a packet").digest("hex")
    const prepared = control(
      runs,
      "prepare",
      "--run-id", "serial-run",
      "--unit-id", "U4a",
      "--base", base,
      "--packet-digest", packetDigest,
      "--attempt-id", "attempt-1",
      "--activity-posture", "incremental",
    )
    expect(prepared.word).toBe("PREPARED")
    const workspace = prepared.body.workspace as string
    const resultDir = prepared.body.result_dir as string
    const resultPath = path.join(resultDir, "implementation-result.json")

    const fake = path.join(root, "fake-adapter.sh")
    writeFileSync(fake, `#!/bin/sh
set -eu
workspace="$1"
result="$2"
cd "$workspace"
printf 'committed\n' > existing.txt
git add existing.txt
git -c user.name=Worker -c user.email=worker@example.test commit -m 'worker intermediate' >/dev/null
printf 'residual\n' > existing.txt
python3 -c 'open("binary.bin", "wb").write(bytes([0,255,1]))'
git mv delete.txt renamed.txt
printf '%s\n' '{"terminal_status":"completed","summary":"done","changed_files":["existing.txt","binary.bin","renamed.txt"],"evidence":["fake"],"scope_expansion":null}' > "$result"
`)
    chmodSync(fake, 0o755)

    const jobId = run(repo, [
      "python3", RUNNER, "start",
      "--skill", "ce-work",
      "--run-id", "serial-run",
      "--label", "U4a",
      "--input-digest", packetDigest,
      "--result-path", resultPath,
      "--no-sweep",
      "--", fake, workspace, resultPath,
    ], {
      ...process.env,
      CE_PEER_JOBS_ROOT: peerRoot,
      CE_PEER_POLL_SECS: "0.1",
      CE_PEER_IDLE_SECS: "10",
      CE_PEER_HARD_SECS: "30",
    })
    expect(jobId).not.toBe("")
    expect(control(
      runs,
      "record-job",
      "--run-id", "serial-run",
      "--unit-id", "U4a",
      "--attempt-id", "attempt-1",
      "--job-id", jobId,
    ).word).toBe("AUTHORING")

    const terminalState = run(repo, [
      "python3", RUNNER, "wait", "--max-secs", "30", jobId,
    ], { ...process.env, CE_PEER_JOBS_ROOT: peerRoot })
    expect(terminalState).toBe("done")
    expect(control(runs, "sync-job", "--run-id", "serial-run", "--unit-id", "U4a").body.process_state).toBe("done")

    const terminal = control(runs, "terminalize", "--run-id", "serial-run", "--unit-id", "U4a")
    expect(terminal.word).toBe("INTEGRATION_PENDING")
    const transport = terminal.body.transport
    expect(git(repo, "rev-list", "--parents", "-n", "1", transport.commit).split(" ")).toEqual([transport.commit, base])
    expect(git(repo, "show", `${transport.commit}:existing.txt`)).toBe("residual")
    expect(git(repo, "show", `${transport.commit}:renamed.txt`)).toBe("delete")

    const acquired = control(runs, "integration-acquire", "--run-id", "serial-run", "--unit-id", "U4a")
    expect(acquired.word).toBe("ACQUIRED")
    const token = acquired.body.lock_token as string
    expect(control(
      runs,
      "preflight",
      "--run-id", "serial-run",
      "--unit-id", "U4a",
      "--lock-token", token,
    ).word).toBe("PREFLIGHT_OK")
    git(repo, "cherry-pick", "--no-commit", transport.commit)
    const applied = control(runs, "mark-applied", "--run-id", "serial-run", "--unit-id", "U4a", "--lock-token", token)
    expect(applied.word).toBe("APPLIED")
    expect(readFileSync(path.join(repo, "existing.txt"), "utf8")).toBe("residual\n")
    expect(readFileSync(path.join(repo, "binary.bin"))).toEqual(Buffer.from([0, 255, 1]))

    const verificationDigest = createHash("sha256").update("fake canonical verification passed").digest("hex")
    expect(control(
      runs,
      "mark-verified",
      "--run-id", "serial-run",
      "--unit-id", "U4a",
      "--lock-token", token,
      "--evidence-digest", verificationDigest,
    ).word).toBe("VERIFIED")
    git(repo, "commit", "-m", "feat(test): integrate external unit")
    const canonical = git(repo, "rev-parse", "HEAD")
    expect(control(runs, "mark-committed", "--run-id", "serial-run", "--unit-id", "U4a", "--lock-token", token).word).toBe("COMMITTED")
    expect(git(repo, "diff", "--binary", base, canonical)).toBe(git(repo, "diff", "--binary", base, transport.commit))

    expect(control(runs, "cleanup", "--run-id", "serial-run", "--unit-id", "U4a").word).toBe("CLEANED")
    expect(control(runs, "integration-release", "--run-id", "serial-run", "--unit-id", "U4a", "--lock-token", token).word).toBe("RELEASED")
    expect(git(repo, "status", "--porcelain")).toBe("")
    expect(spawnSync("git", ["-C", repo, "show-ref", "--verify", transport.ref]).status).not.toBe(0)
  }, 30_000)
})
