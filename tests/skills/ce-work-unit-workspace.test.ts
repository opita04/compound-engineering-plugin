import { afterEach, describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"

const SCRIPT = path.join(__dirname, "../../skills/ce-work/scripts/unit-workspace.py")
const roots: string[] = []

function tmp(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix))
  roots.push(root)
  return root
}

function sh(cwd: string, argv: string[], check = true) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: "utf8" })
  if (check && r.status !== 0) throw new Error(`${argv.join(" ")}\n${r.stderr}`)
  return r
}

function git(cwd: string, ...args: string[]): string {
  return sh(cwd, ["git", ...args]).stdout.trim()
}

function makeRepo(): { repo: string; plan: string; digest: string; base: string } {
  const repo = path.join(tmp("ce-work-repo-"), "repo")
  mkdirSync(repo)
  git(repo, "init", "-b", "main")
  git(repo, "config", "user.name", "CE Work Test")
  git(repo, "config", "user.email", "ce-work@example.test")
  mkdirSync(path.join(repo, "docs", "plans"), { recursive: true })
  writeFileSync(path.join(repo, "keep.txt"), "keep\n")
  writeFileSync(path.join(repo, "delete.txt"), "delete\n")
  writeFileSync(path.join(repo, "mode.sh"), "#!/bin/sh\necho old\n")
  chmodSync(path.join(repo, "mode.sh"), 0o644)
  const plan = path.join(repo, "docs", "plans", "plan.md")
  writeFileSync(plan, "# Plan\n")
  git(repo, "add", ".")
  git(repo, "commit", "-m", "seed")
  const digest = createHash("sha256").update(readFileSync(plan)).digest("hex")
  return { repo, plan, digest, base: git(repo, "rev-parse", "HEAD") }
}

function ctl(runsRoot: string, ...args: string[]) {
  return ctlWithEnv(runsRoot, {}, ...args)
}

function ctlWithEnv(runsRoot: string, extraEnv: Record<string, string>, ...args: string[]) {
  const r = spawnSync("python3", [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      CE_WORK_RUNS_ROOT: runsRoot,
      CE_PEER_JOBS_ROOT: path.dirname(runsRoot),
      ...extraEnv,
    },
  })
  const lines = r.stdout.trim().split("\n")
  let body: any = null
  if (lines.length > 1) body = JSON.parse(lines.slice(1).join("\n"))
  return { code: r.status ?? -1, word: lines[0] || "", body, stderr: r.stderr }
}

function init(runsRoot: string, runId: string, fixture: ReturnType<typeof makeRepo>) {
  return ctl(
    runsRoot,
    "init",
    "--run-id", runId,
    "--repo", fixture.repo,
    "--plan", fixture.plan,
    "--plan-digest", fixture.digest,
    "--binding-json", '{"mode":"prefer","target":"codex","model":null,"source":"test"}',
    "--egress-json", '{"sanction_source":"test","route":"codex","intermediaries":[],"exposed_material":["U2"],"restrictions":[]}',
  )
}

function fakeDoneJob(runsRoot: string, runId: string, unitId: string, packetDigest: string, id = "job-1") {
  const dir = path.join(runsRoot, runId, "jobs", id)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  chmodSync(path.join(runsRoot, runId, "jobs"), 0o700)
  chmodSync(dir, 0o700)
  const meta = {
    job_id: id,
    skill: "ce-work",
    run_id: runId,
    label: unitId,
    input_digest: packetDigest,
    result_path: path.join(runsRoot, runId, "units", unitId, "result", "implementation-result.json"),
  }
  for (const [name, value] of [
    ["meta.json", JSON.stringify(meta) + "\n"],
    ["status", "done\n"],
    ["reason", "worker exited 0\n"],
    ["out.log", "activity\n"],
  ]) {
    writeFileSync(path.join(dir, name), value as string, { mode: 0o600 })
    chmodSync(path.join(dir, name), 0o600)
  }
  return id
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("ce-work unit workspace controller", () => {
  test("creates private durable state and rejects unsafe identity or mode", () => {
    const f = makeRepo()
    const runs = path.join(tmp("ce-work-runs-"), "ce-work")
    const good = init(runs, "run-1", f)
    expect(good.code).toBe(0)
    expect(good.word).toBe("READY")
    expect(statSync(path.join(runs, "run-1")).mode & 0o777).toBe(0o700)
    expect(statSync(path.join(runs, "run-1", "manifest.json")).mode & 0o777).toBe(0o600)

    expect(init(runs, "../escape", f).word).toBe("REFUSED")
    chmodSync(path.join(runs, "run-1", "manifest.json"), 0o644)
    const unsafe = ctl(runs, "status", "--run-id", "run-1")
    expect(unsafe.word).toBe("UNREADABLE")
    expect(unsafe.body).toBeNull()

    const second = init(runs, "run-symlink", f)
    expect(second.word).toBe("READY")
    const manifest = path.join(runs, "run-symlink", "manifest.json")
    rmSync(manifest)
    symlinkSync(f.plan, manifest)
    expect(ctl(runs, "resume", "--run-id", "run-symlink").word).toBe("UNREADABLE")

    const outside = path.join(tmp("ce-work-outside-"), "plan.md")
    writeFileSync(outside, "# Plan\n")
    const digest = createHash("sha256").update(readFileSync(outside)).digest("hex")
    expect(ctl(runs, "init", "--run-id", "outside", "--repo", f.repo, "--plan", outside, "--plan-digest", digest).word).toBe("REFUSED")
  })

  test("creates a detached sibling from a linked checkout and terminalizes the complete tree", () => {
    const f = makeRepo()
    const linked = path.join(tmp("ce-work-linked-"), "linked")
    git(f.repo, "worktree", "add", "-b", "feature", linked, f.base)
    f.repo = linked
    f.plan = path.join(linked, "docs", "plans", "plan.md")
    const runs = path.join(tmp("ce-work-runs-"), "ce-work")
    expect(init(runs, "run-tree", f).word).toBe("READY")
    expect(ctl(runs, "prepare", "--run-id", "run-tree", "--unit-id", "U2", "--base", f.base, "--packet-digest", "packet").word).toBe("PREPARED")
    const workspace = path.join(runs, "run-tree", "units", "U2", "workspace")
    expect(git(workspace, "rev-parse", "--git-common-dir")).toBe(git(linked, "rev-parse", "--git-common-dir"))
    expect(sh(workspace, ["git", "symbolic-ref", "-q", "HEAD"], false).status).not.toBe(0)

    writeFileSync(path.join(workspace, "keep.txt"), "committed\n")
    git(workspace, "add", "keep.txt")
    git(workspace, "-c", "user.name=Worker", "-c", "user.email=worker@example.test", "commit", "-m", "worker commit")
    writeFileSync(path.join(workspace, "keep.txt"), "residual\n")
    writeFileSync(path.join(workspace, "binary.bin"), Buffer.from([0, 255, 1, 2]))
    git(workspace, "mv", "delete.txt", "renamed.txt")
    chmodSync(path.join(workspace, "mode.sh"), 0o755)
    const job = fakeDoneJob(runs, "run-tree", "U2", "packet")
    expect(ctl(runs, "record-job", "--run-id", "run-tree", "--unit-id", "U2", "--attempt-id", "attempt-1", "--job-id", job).word).toBe("AUTHORING")
    expect(ctl(runs, "sync-job", "--run-id", "run-tree", "--unit-id", "U2").body.process_state).toBe("done")
    const terminal = ctl(runs, "terminalize", "--run-id", "run-tree", "--unit-id", "U2")
    expect(terminal.word).toBe("INTEGRATION_PENDING")
    const transport = terminal.body.transport
    expect(git(linked, "rev-list", "--parents", "-n", "1", transport.commit).split(" ")).toEqual([transport.commit, f.base])
    expect(git(linked, "rev-parse", `${transport.commit}^{tree}`)).toBe(transport.tree)
    expect(git(workspace, "rev-parse", "HEAD")).toBe(transport.commit)
    expect(git(workspace, "status", "--porcelain")).toBe("")
    expect(git(linked, "show", `${transport.commit}:keep.txt`)).toBe("residual")
    expect(git(linked, "show", `${transport.commit}:renamed.txt`)).toBe("delete")
    expect(git(linked, "ls-tree", transport.commit, "mode.sh").split(" ")[0]).toBe("100755")
    git(linked, "gc", "--prune=now")
    expect(git(linked, "rev-parse", transport.ref)).toBe(transport.commit)
    expect(ctl(runs, "cleanup", "--run-id", "run-tree", "--unit-id", "U2", "--abandon", "--expect-transport", transport.commit).word).toBe("CLEANED")
    expect(worktreePaths(linked)).not.toContain(path.resolve(workspace))
    expect(sh(linked, ["git", "rev-parse", "-q", "--verify", transport.ref], false).status).not.toBe(0)

    expect(init(runs, "run-empty", f).word).toBe("READY")
    ctl(runs, "prepare", "--run-id", "run-empty", "--unit-id", "empty", "--base", f.base, "--packet-digest", "empty-packet")
    const emptyJob = fakeDoneJob(runs, "run-empty", "empty", "empty-packet")
    ctl(runs, "record-job", "--run-id", "run-empty", "--unit-id", "empty", "--attempt-id", "attempt-1", "--job-id", emptyJob)
    const empty = ctl(runs, "terminalize", "--run-id", "run-empty", "--unit-id", "empty").body.transport
    expect(empty.tree).toBe(git(linked, "rev-parse", `${f.base}^{tree}`))
    expect(git(linked, "rev-list", "--parents", "-n", "1", empty.commit).split(" ")).toEqual([empty.commit, f.base])
    expect(ctl(runs, "cleanup", "--run-id", "run-empty", "--unit-id", "empty", "--abandon", "--expect-transport", empty.commit).word).toBe("CLEANED")
  }, 20000)

  test("fold-in is host-owned, lock-serialized, restorable, and cleanup is explicit", () => {
    const f = makeRepo()
    const runs = path.join(tmp("ce-work-runs-"), "ce-work")
    init(runs, "run-fold", f)
    ctl(runs, "prepare", "--run-id", "run-fold", "--unit-id", "U", "--base", f.base, "--packet-digest", "packet")
    const workspace = path.join(runs, "run-fold", "units", "U", "workspace")
    writeFileSync(path.join(workspace, "new.txt"), "new\n")
    const job = fakeDoneJob(runs, "run-fold", "U", "packet")
    ctl(runs, "record-job", "--run-id", "run-fold", "--unit-id", "U", "--attempt-id", "attempt-1", "--job-id", job)
    const t = ctl(runs, "terminalize", "--run-id", "run-fold", "--unit-id", "U").body.transport
    const lock = ctl(runs, "integration-acquire", "--run-id", "run-fold", "--unit-id", "U")
    expect(lock.word).toBe("ACQUIRED")
    const token = lock.body.lock_token
    expect(ctl(runs, "preflight", "--run-id", "run-fold", "--unit-id", "U", "--lock-token", token).word).toBe("PREFLIGHT_OK")
    git(f.repo, "cherry-pick", "--no-commit", t.commit)
    expect(existsSync(path.join(f.repo, "new.txt"))).toBe(true)
    expect(ctl(runs, "restore", "--run-id", "run-fold", "--unit-id", "U", "--lock-token", token).word).toBe("PRESERVED")
    expect(git(f.repo, "status", "--porcelain")).toBe("")
    expect(existsSync(path.join(f.repo, "new.txt"))).toBe(false)
    expect(ctl(runs, "integration-release", "--run-id", "run-fold", "--unit-id", "U", "--lock-token", token).word).toBe("RELEASED")
    expect(ctl(runs, "cleanup", "--run-id", "run-fold", "--unit-id", "U", "--abandon", "--expect-transport", t.commit).word).toBe("CLEANED")
    expect(sh(f.repo, ["git", "rev-parse", "-q", "--verify", t.ref], false).status).not.toBe(0)
  }, 20000)

  test("records the only dirty selected plan as a narrow checkpoint", () => {
    const f = makeRepo()
    const runs = path.join(tmp("ce-work-runs-"), "ce-work")
    writeFileSync(f.plan, "# Plan\n\nchanged\n")
    const digest = createHash("sha256").update(readFileSync(f.plan)).digest("hex")
    f.digest = digest
    expect(init(runs, "run-plan", f).word).toBe("READY")
    const cp = ctl(runs, "checkpoint-plan", "--run-id", "run-plan")
    expect(cp.word).toBe("CHECKPOINTED")
    expect(git(f.repo, "status", "--porcelain")).toBe("")
    expect(git(f.repo, "diff-tree", "--no-commit-id", "--name-only", "-r", cp.body.checkpoint.commit)).toBe("docs/plans/plan.md")

    writeFileSync(f.plan, "again\n")
    writeFileSync(path.join(f.repo, "other.txt"), "other\n")
    const blocked = ctl(runs, "checkpoint-plan", "--run-id", "run-plan")
    expect(blocked.word).toBe("BLOCKED")
    expect(git(f.repo, "rev-parse", "HEAD")).toBe(cp.body.checkpoint.commit)
  })

  test("recovers worktree and transport crash windows without duplicate dispatch", () => {
    const f = makeRepo()
    const runs = path.join(tmp("ce-work-runs-"), "ce-work")
    init(runs, "run-crash", f)
    const interrupted = ctlWithEnv(
      runs,
      { CE_WORK_TEST_FAULT: "after-worktree-add" },
      "prepare", "--run-id", "run-crash", "--unit-id", "U", "--base", f.base, "--packet-digest", "packet",
    )
    expect(interrupted.word).toBe("INTERRUPTED")
    const adopted = ctl(runs, "prepare", "--run-id", "run-crash", "--unit-id", "U", "--base", f.base, "--packet-digest", "packet")
    expect(adopted.word).toBe("PREPARED")
    const workspace = adopted.body.workspace
    writeFileSync(path.join(workspace, "crash.txt"), "survives\n")
    fakeDoneJob(runs, "run-crash", "U", "packet")
    const refInterrupted = ctlWithEnv(
      runs,
      { CE_WORK_TEST_FAULT: "after-transport-ref" },
      "resume", "--run-id", "run-crash",
    )
    expect(refInterrupted.word).toBe("INTERRUPTED")
    const done = ctl(runs, "resume", "--run-id", "run-crash")
    expect(done.word).toBe("RESUMED")
    expect(done.body.redispatched).toBe(false)
    expect(done.body.actions.filter((a: any) => a.action === "terminalized")).toHaveLength(1)
    const status = ctl(runs, "status", "--run-id", "run-crash", "--unit-id", "U")
    const commit = status.body.unit.transport.commit
    expect(git(f.repo, "rev-list", "--parents", "-n", "1", commit).split(" ")).toEqual([commit, f.base])
    const again = ctl(runs, "resume", "--run-id", "run-crash")
    expect(again.body.actions).toEqual([])
    expect(ctlWithEnv(runs, { CE_WORK_TEST_FAULT: "cleanup-after-worktree-remove" }, "cleanup", "--run-id", "run-crash", "--unit-id", "U", "--abandon", "--expect-transport", commit).word).toBe("INTERRUPTED")
    expect(ctl(runs, "cleanup", "--run-id", "run-crash", "--unit-id", "U", "--abandon", "--expect-transport", commit).word).toBe("CLEANED")
  }, 20000)

  test("refuses ambiguous job adoption and preserves output on canonical divergence", () => {
    const f = makeRepo()
    const runs = path.join(tmp("ce-work-runs-"), "ce-work")
    init(runs, "run-ambiguous", f)
    ctl(runs, "prepare", "--run-id", "run-ambiguous", "--unit-id", "U", "--base", f.base, "--packet-digest", "packet")
    fakeDoneJob(runs, "run-ambiguous", "U", "packet", "job-a")
    fakeDoneJob(runs, "run-ambiguous", "U", "packet", "job-b")
    expect(ctl(runs, "resume", "--run-id", "run-ambiguous").word).toBe("AMBIGUOUS")
    expect(ctl(runs, "status", "--run-id", "run-ambiguous", "--unit-id", "U").body.unit.state).toBe("queued")
    git(f.repo, "worktree", "remove", "--force", path.join(runs, "run-ambiguous", "units", "U", "workspace"))

    init(runs, "run-diverge", f)
    ctl(runs, "prepare", "--run-id", "run-diverge", "--unit-id", "U", "--base", f.base, "--packet-digest", "packet")
    const workspace = path.join(runs, "run-diverge", "units", "U", "workspace")
    writeFileSync(path.join(workspace, "delegated.txt"), "delegate\n")
    const job = fakeDoneJob(runs, "run-diverge", "U", "packet")
    ctl(runs, "record-job", "--run-id", "run-diverge", "--unit-id", "U", "--attempt-id", "attempt-1", "--job-id", job)
    const transport = ctl(runs, "terminalize", "--run-id", "run-diverge", "--unit-id", "U").body.transport
    writeFileSync(path.join(f.repo, "host.txt"), "host moved\n")
    git(f.repo, "add", "host.txt")
    git(f.repo, "commit", "-m", "host movement")
    const token = ctl(runs, "integration-acquire", "--run-id", "run-diverge", "--unit-id", "U").body.lock_token
    expect(ctl(runs, "preflight", "--run-id", "run-diverge", "--unit-id", "U", "--lock-token", token).word).toBe("BLOCKED")
    expect(existsSync(workspace)).toBe(true)
    expect(git(f.repo, "rev-parse", transport.ref)).toBe(transport.commit)
    // The preserved result can still be explicitly abandoned after inspection.
    expect(ctl(runs, "cleanup", "--run-id", "run-diverge", "--unit-id", "U", "--abandon", "--expect-transport", transport.commit).word).toBe("CLEANED")
    expect(ctl(runs, "integration-release", "--run-id", "run-diverge", "--unit-id", "U", "--lock-token", token).word).toBe("RELEASED")
  }, 20000)

  test("reconciles commit-before-manifest exactly once and serializes competing hosts", () => {
    const f = makeRepo()
    const runs = path.join(tmp("ce-work-runs-"), "ce-work")
    const makeTransport = (runId: string, name: string) => {
      init(runs, runId, f)
      ctl(runs, "prepare", "--run-id", runId, "--unit-id", "U", "--base", f.base, "--packet-digest", "packet")
      const workspace = path.join(runs, runId, "units", "U", "workspace")
      writeFileSync(path.join(workspace, name), `${runId}\n`)
      const job = fakeDoneJob(runs, runId, "U", "packet")
      ctl(runs, "record-job", "--run-id", runId, "--unit-id", "U", "--attempt-id", "attempt-1", "--job-id", job)
      return ctl(runs, "terminalize", "--run-id", runId, "--unit-id", "U").body.transport
    }
    const first = makeTransport("run-a", "a.txt")
    const second = makeTransport("run-b", "b.txt")
    const acquired = ctl(runs, "integration-acquire", "--run-id", "run-a", "--unit-id", "U")
    const token = acquired.body.lock_token
    const denied = ctl(runs, "integration-acquire", "--run-id", "run-b", "--unit-id", "U")
    expect(denied.word).toBe("BLOCKED")
    expect(ctl(runs, "integration-release", "--run-id", "run-a", "--unit-id", "U", "--lock-token", "wrong").word).toBe("REFUSED")

    ctl(runs, "preflight", "--run-id", "run-a", "--unit-id", "U", "--lock-token", token)
    git(f.repo, "cherry-pick", "--no-commit", first.commit)
    ctl(runs, "mark-applied", "--run-id", "run-a", "--unit-id", "U", "--lock-token", token)
    ctl(runs, "mark-verified", "--run-id", "run-a", "--unit-id", "U", "--lock-token", token, "--evidence-digest", "tests-green")
    git(f.repo, "commit", "-m", "feat(test): integrate U")
    const resumed = ctl(runs, "resume", "--run-id", "run-a")
    expect(resumed.body.actions.map((a: any) => a.action)).toContain("commit-reconciled")
    expect(ctl(runs, "resume", "--run-id", "run-a").body.actions).toEqual([])
    expect(ctl(runs, "integration-release", "--run-id", "run-a", "--unit-id", "U", "--lock-token", token).word).toBe("RELEASED")
    expect(ctl(runs, "cleanup", "--run-id", "run-a", "--unit-id", "U").word).toBe("CLEANED")
    expect(ctl(runs, "cleanup", "--run-id", "run-b", "--unit-id", "U", "--abandon", "--expect-transport", second.commit).word).toBe("CLEANED")
  }, 25000)

  test("restores applied-before-manifest and interrupted restore, but blocks on unknown dirt", () => {
    const f = makeRepo()
    const runs = path.join(tmp("ce-work-runs-"), "ce-work")
    init(runs, "run-restore", f)
    ctl(runs, "prepare", "--run-id", "run-restore", "--unit-id", "U", "--base", f.base, "--packet-digest", "packet")
    const workspace = path.join(runs, "run-restore", "units", "U", "workspace")
    writeFileSync(path.join(workspace, "new.txt"), "new\n")
    const job = fakeDoneJob(runs, "run-restore", "U", "packet")
    ctl(runs, "record-job", "--run-id", "run-restore", "--unit-id", "U", "--attempt-id", "attempt-1", "--job-id", job)
    const transport = ctl(runs, "terminalize", "--run-id", "run-restore", "--unit-id", "U").body.transport
    const token = ctl(runs, "integration-acquire", "--run-id", "run-restore", "--unit-id", "U").body.lock_token
    ctl(runs, "preflight", "--run-id", "run-restore", "--unit-id", "U", "--lock-token", token)
    git(f.repo, "cherry-pick", "--no-commit", transport.commit)
    const recovered = ctl(runs, "resume", "--run-id", "run-restore")
    expect(recovered.body.actions.map((a: any) => a.action)).toContain("restored-ambiguous-apply")
    expect(git(f.repo, "status", "--porcelain")).toBe("")

    expect(ctl(runs, "preflight", "--run-id", "run-restore", "--unit-id", "U", "--lock-token", token).word).toBe("PREFLIGHT_OK")
    git(f.repo, "cherry-pick", "--no-commit", transport.commit)
    const interrupted = ctlWithEnv(runs, { CE_WORK_TEST_FAULT: "restore-after-reset" }, "restore", "--run-id", "run-restore", "--unit-id", "U", "--lock-token", token)
    expect(interrupted.word).toBe("INTERRUPTED")
    expect(ctl(runs, "resume", "--run-id", "run-restore").body.actions.map((a: any) => a.action)).toContain("restored")

    ctl(runs, "preflight", "--run-id", "run-restore", "--unit-id", "U", "--lock-token", token)
    git(f.repo, "cherry-pick", "--no-commit", transport.commit)
    writeFileSync(path.join(f.repo, "unknown.txt"), "do not delete\n")
    const blocked = ctl(runs, "restore", "--run-id", "run-restore", "--unit-id", "U", "--lock-token", token)
    expect(blocked.word).toBe("BLOCKED")
    expect(existsSync(path.join(f.repo, "unknown.txt"))).toBe(true)
    rmSync(path.join(f.repo, "unknown.txt"))
    expect(ctl(runs, "resume", "--run-id", "run-restore").body.actions.map((a: any) => a.action)).toContain("restored")
    expect(ctl(runs, "integration-release", "--run-id", "run-restore", "--unit-id", "U", "--lock-token", token).word).toBe("RELEASED")
    expect(ctl(runs, "cleanup", "--run-id", "run-restore", "--unit-id", "U", "--abandon", "--expect-transport", transport.commit).word).toBe("CLEANED")
  }, 25000)
})

function worktreePaths(repo: string): string[] {
  const out = git(repo, "worktree", "list", "--porcelain")
  return out.split("\n").filter((line) => line.startsWith("worktree ")).map((line) => path.resolve(line.slice(9)))
}
