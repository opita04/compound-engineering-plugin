#!/usr/bin/env python3
"""Private, crash-recoverable workspace controller for ce-work external units.

The generic peer-job runner owns process supervision. This controller owns the
repository-specific transaction: one private run manifest, detached sibling
worktrees, complete-tree transport commits, canonical integration evidence,
exact restoration, retention, and explicit cleanup. It never launches a model
CLI and never commits a worker's output in the canonical checkout.

Every successful command prints a status word and one compact JSON document.
Trust failures print only ``UNREADABLE`` and an error on stderr.
"""

from __future__ import annotations

import argparse
import base64
import contextlib
import fcntl
import hashlib
import json
import os
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path


SCHEMA_VERSION = 1
DEFAULT_RUNS_ROOT = "/tmp/compound-engineering/ce-work"
MAX_JSON_BYTES = 2 * 1024 * 1024
SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)
O_DIRECTORY = getattr(os, "O_DIRECTORY", 0)
TERMINAL_PROCESS = {"done", "failed", "timeout", "died-without-result"}
INTEGRATABLE_STATES = {"integration-pending", "integrated", "verified"}


class Operational(Exception):
    def __init__(self, word: str, message: str, detail: dict | None = None):
        super().__init__(message)
        self.word = word
        self.detail = detail or {}


class TrustFailure(Operational):
    def __init__(self, message: str):
        super().__init__("UNREADABLE", message)


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def test_fault(point: str) -> None:
    """Deterministic crash-window injection for the repository test suite."""
    if os.environ.get("CE_WORK_TEST_FAULT") == point:
        raise Operational("INTERRUPTED", f"injected test interruption at {point}")


def runs_root() -> str:
    return os.path.abspath(os.environ.get("CE_WORK_RUNS_ROOT") or DEFAULT_RUNS_ROOT)


def safe_id(value: str, label: str) -> str:
    if not SAFE_ID.fullmatch(value) or not value.strip("."):
        raise Operational("REFUSED", f"unsafe {label}: {value!r}")
    return value


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _mode(st: os.stat_result) -> int:
    return stat.S_IMODE(st.st_mode)


def _euid() -> int | None:
    get = getattr(os, "geteuid", None)
    return get() if get else None


def validate_private_dir(path: str) -> None:
    try:
        fd = os.open(path, os.O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
    except OSError as exc:
        raise TrustFailure(f"cannot safely open directory {path}: {exc}") from exc
    try:
        st = os.fstat(fd)
        if not stat.S_ISDIR(st.st_mode):
            raise TrustFailure(f"not a real directory: {path}")
        if _euid() is not None and st.st_uid != _euid():
            raise TrustFailure(f"directory is not owned by current user: {path}")
        if _mode(st) != 0o700:
            raise TrustFailure(f"directory mode is {_mode(st):04o}, expected 0700: {path}")
    finally:
        os.close(fd)


def ensure_private_dir(path: str) -> None:
    try:
        os.mkdir(path, 0o700)
    except FileExistsError:
        pass
    validate_private_dir(path)


def ensure_root() -> str:
    root = runs_root()
    parent = os.path.dirname(root)
    # The configured root's ancestors are caller-controlled; the private root
    # itself and everything below it are the durable confidentiality boundary.
    os.makedirs(parent, mode=0o700, exist_ok=True)
    ensure_private_dir(root)
    ensure_private_dir(os.path.join(root, ".locks"))
    return root


def read_private(path: str, cap: int = MAX_JSON_BYTES) -> bytes:
    try:
        fd = os.open(path, os.O_RDONLY | O_NOFOLLOW)
    except OSError as exc:
        raise TrustFailure(f"cannot safely open state file {path}: {exc}") from exc
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode):
            raise TrustFailure(f"state is not a regular file: {path}")
        if _euid() is not None and st.st_uid != _euid():
            raise TrustFailure(f"state is not owned by current user: {path}")
        if _mode(st) != 0o600:
            raise TrustFailure(f"state mode is {_mode(st):04o}, expected 0600: {path}")
        if st.st_size > cap:
            raise TrustFailure(f"state exceeds {cap}-byte limit: {path}")
        out = bytearray()
        while len(out) <= cap:
            part = os.read(fd, min(65536, cap + 1 - len(out)))
            if not part:
                break
            out.extend(part)
        if len(out) > cap:
            raise TrustFailure(f"state grew beyond {cap}-byte limit: {path}")
        return bytes(out)
    finally:
        os.close(fd)


def stat_private_file(path: str, cap: int) -> os.stat_result:
    """Validate a private file by descriptor without consuming its content."""
    try:
        fd = os.open(path, os.O_RDONLY | O_NOFOLLOW)
    except OSError as exc:
        raise TrustFailure(f"cannot safely open state file {path}: {exc}") from exc
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode):
            raise TrustFailure(f"state is not a regular file: {path}")
        if _euid() is not None and st.st_uid != _euid():
            raise TrustFailure(f"state is not owned by current user: {path}")
        if _mode(st) != 0o600:
            raise TrustFailure(f"state mode is {_mode(st):04o}, expected 0600: {path}")
        if st.st_size > cap:
            raise TrustFailure(f"state exceeds {cap}-byte limit: {path}")
        return st
    finally:
        os.close(fd)


def read_private_json(path: str) -> dict:
    try:
        value = json.loads(read_private(path))
    except TrustFailure:
        raise
    except (ValueError, UnicodeDecodeError) as exc:
        raise TrustFailure(f"malformed JSON state: {path}") from exc
    if not isinstance(value, dict):
        raise TrustFailure(f"JSON state is not an object: {path}")
    return value


def create_private(path: str, data: bytes) -> None:
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600)
    except OSError as exc:
        raise Operational("BLOCKED", f"cannot exclusively create {path}: {exc}") from exc
    try:
        os.write(fd, data)
        os.fsync(fd)
    finally:
        os.close(fd)


def atomic_private_json(path: str, doc: dict) -> None:
    data = (json.dumps(doc, sort_keys=True, separators=(",", ":")) + "\n").encode()
    if len(data) > MAX_JSON_BYTES:
        raise Operational("BLOCKED", "manifest exceeds bounded state size")
    parent = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(prefix=".manifest-", dir=parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb", closefd=True) as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
        dfd = os.open(parent, os.O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
        try:
            os.fsync(dfd)
        finally:
            os.close(dfd)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def run_dir(run_id: str) -> str:
    return os.path.join(runs_root(), safe_id(run_id, "run id"))


def manifest_path(run_id: str) -> str:
    return os.path.join(run_dir(run_id), "manifest.json")


@contextlib.contextmanager
def locked_manifest(run_id: str, write: bool = False):
    run_id = safe_id(run_id, "run id")
    root = ensure_root()
    rd = os.path.join(root, run_id)
    validate_private_dir(rd)
    lock_path = os.path.join(rd, "manifest.lock")
    try:
        fd = os.open(lock_path, os.O_RDWR | O_NOFOLLOW)
    except OSError as exc:
        raise TrustFailure(f"cannot safely open manifest lock: {exc}") from exc
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or (_euid() is not None and st.st_uid != _euid()) or _mode(st) != 0o600:
            raise TrustFailure("manifest lock owner/type/mode validation failed")
        fcntl.flock(fd, fcntl.LOCK_EX)
        doc = read_private_json(os.path.join(rd, "manifest.json"))
        if doc.get("schema_version") != SCHEMA_VERSION or doc.get("run_id") != run_id:
            raise TrustFailure("manifest schema or run identity mismatch")
        before = json.dumps(doc, sort_keys=True, separators=(",", ":"))
        yield doc
        after = json.dumps(doc, sort_keys=True, separators=(",", ":"))
        if write and after != before:
            doc["revision"] = int(doc.get("revision", 0)) + 1
            doc["updated_at"] = now_iso()
            atomic_private_json(os.path.join(rd, "manifest.json"), doc)
    finally:
        with contextlib.suppress(OSError):
            fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def git(repo: str, *args: str, input_data: bytes | None = None, check: bool = True, env: dict | None = None) -> bytes:
    proc = subprocess.run(
        ["git", "-C", repo, *args], input=input_data, capture_output=True,
        env={**os.environ, **(env or {})}, check=False,
    )
    if check and proc.returncode != 0:
        message = proc.stderr.decode("utf-8", "replace").strip()
        raise Operational("BLOCKED", f"git {' '.join(args)} failed: {message}")
    return proc.stdout


def git_text(repo: str, *args: str, check: bool = True) -> str:
    return git(repo, *args, check=check).decode("utf-8", "surrogateescape").strip()


def repo_info(repo: str) -> dict:
    repo = os.path.realpath(repo)
    top = os.path.realpath(git_text(repo, "rev-parse", "--show-toplevel"))
    if top != repo:
        repo = top
    branch = git_text(repo, "symbolic-ref", "-q", "HEAD", check=False)
    if not branch:
        raise Operational("REFUSED", "canonical checkout must be on a branch")
    git_dir = os.path.realpath(git_text(repo, "rev-parse", "--path-format=absolute", "--absolute-git-dir"))
    common = os.path.realpath(git_text(repo, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    st = os.stat(common)
    roots = sorted(git_text(repo, "rev-list", "--max-parents=0", "HEAD").splitlines())
    identity = digest_bytes((common + f"\0{st.st_dev}\0{st.st_ino}\0" + "\n".join(roots)).encode())
    return {
        "toplevel": repo,
        "git_dir": git_dir,
        "common_dir": common,
        "common_dev": st.st_dev,
        "common_ino": st.st_ino,
        "identity_digest": identity,
        "branch_ref": branch,
        "head": git_text(repo, "rev-parse", "HEAD"),
        "head_tree": git_text(repo, "rev-parse", "HEAD^{tree}"),
    }


def validate_repo(doc: dict) -> dict:
    recorded = doc["repository"]
    current = repo_info(recorded["toplevel"])
    for key in ("toplevel", "git_dir", "common_dir", "common_dev", "common_ino", "identity_digest"):
        if current[key] != recorded[key]:
            raise Operational("BLOCKED", f"canonical repository identity changed ({key})")
    if current["branch_ref"] != doc["branch"]["ref"]:
        raise Operational("BLOCKED", "canonical branch changed")
    return current


def resolve_plan(repo: str, plan: str) -> tuple[str, str]:
    supplied = os.path.abspath(plan if os.path.isabs(plan) else os.path.join(repo, plan))
    try:
        st = os.lstat(supplied)
    except OSError as exc:
        raise Operational("REFUSED", f"selected plan is missing: {exc}") from exc
    if stat.S_ISLNK(st.st_mode) or not stat.S_ISREG(st.st_mode):
        raise Operational("REFUSED", "selected plan must be one regular non-symlink file")
    # OS temp roots may themselves be compatibility symlinks (macOS /var ->
    # /private/var). Reject a symlink at the selected file, then compare the
    # resolved file against the already-resolved canonical repository.
    absolute = os.path.realpath(supplied)
    if os.path.commonpath([repo, absolute]) != repo:
        raise Operational("REFUSED", "plan must be inside the canonical repository")
    return absolute, os.path.relpath(absolute, repo)


def parse_json_arg(raw: str, label: str) -> dict:
    try:
        value = json.loads(raw)
    except ValueError as exc:
        raise Operational("REFUSED", f"invalid {label} JSON") from exc
    if not isinstance(value, dict):
        raise Operational("REFUSED", f"{label} must be a JSON object")
    return value


def event(doc: dict, kind: str, unit_id: str | None = None, detail: dict | None = None) -> None:
    row = {"at": now_iso(), "kind": kind}
    if unit_id is not None:
        row["unit_id"] = unit_id
    if detail:
        row["detail"] = detail
    doc.setdefault("events", []).append(row)


def cmd_init(args) -> tuple[str, dict]:
    root = ensure_root()
    rid = safe_id(args.run_id, "run id")
    info = repo_info(args.repo)
    plan_abs, plan_rel = resolve_plan(info["toplevel"], args.plan)
    actual_digest = digest_bytes(Path(plan_abs).read_bytes())
    if actual_digest != args.plan_digest:
        raise Operational("REFUSED", "selected plan digest does not match content")
    rd = os.path.join(root, rid)
    try:
        os.mkdir(rd, 0o700)
    except FileExistsError:
        with locked_manifest(rid) as existing:
            if existing["repository"]["identity_digest"] != info["identity_digest"] or existing["plan"]["digest"] != actual_digest:
                raise Operational("BLOCKED", "run id already belongs to another repository or plan")
            return "READY", {"run_id": rid, "revision": existing["revision"], "resumed": True, "recovery_path": rd}
    validate_private_dir(rd)
    for child in ("units", "jobs", "packets"):
        ensure_private_dir(os.path.join(rd, child))
    create_private(os.path.join(rd, "manifest.lock"), b"")
    created = now_iso()
    doc = {
        "schema_version": SCHEMA_VERSION,
        "revision": 0,
        "run_id": rid,
        "created_at": created,
        "updated_at": created,
        "repository": {k: info[k] for k in ("toplevel", "git_dir", "common_dir", "common_dev", "common_ino", "identity_digest")},
        "branch": {"ref": info["branch_ref"], "initial_head": info["head"]},
        "plan": {"path": plan_rel, "digest": actual_digest, "checkpoint": None},
        "binding": parse_json_arg(args.binding_json, "binding"),
        "egress": parse_json_arg(args.egress_json, "egress"),
        "integration_lock": None,
        "units": {},
        "blockers": [],
        "events": [{"at": created, "kind": "run-created"}],
    }
    create_private(os.path.join(rd, "manifest.json"), (json.dumps(doc, sort_keys=True, separators=(",", ":")) + "\n").encode())
    return "READY", {"run_id": rid, "revision": 0, "resumed": False, "recovery_path": rd}


def status_paths(repo: str) -> set[str]:
    raw = git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all")
    parts = raw.split(b"\0")
    paths: set[str] = set()
    i = 0
    while i < len(parts):
        entry = parts[i]
        i += 1
        if not entry:
            continue
        if len(entry) < 4:
            raise Operational("BLOCKED", "unexpected porcelain status record")
        code = entry[:2]
        paths.add(entry[3:].decode("utf-8", "surrogateescape"))
        if b"R" in code or b"C" in code:
            if i >= len(parts) or not parts[i]:
                raise Operational("BLOCKED", "incomplete rename status record")
            paths.add(parts[i].decode("utf-8", "surrogateescape"))
            i += 1
    return paths


def cmd_checkpoint_plan(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        info = validate_repo(doc)
        repo = info["toplevel"]
        plan_rel = doc["plan"]["path"]
        plan_abs, _ = resolve_plan(repo, plan_rel)
        if digest_bytes(Path(plan_abs).read_bytes()) != doc["plan"]["digest"]:
            raise Operational("BLOCKED", "selected plan content no longer matches recorded digest")
        dirty = status_paths(repo)
        if not dirty:
            return "NOOP", {"checkpoint": doc["plan"].get("checkpoint"), "head": info["head"]}
        if dirty != {plan_rel}:
            raise Operational("BLOCKED", "canonical dirt is not exactly the selected plan", {"dirty_paths": sorted(dirty)})
        prior = info["head"]
    git(repo, "add", "--", plan_rel)
    staged = set(filter(None, git(repo, "diff", "--cached", "--name-only", "-z").decode("utf-8", "surrogateescape").split("\0")))
    if staged != {plan_rel}:
        git(repo, "reset", "--mixed", prior)
        raise Operational("BLOCKED", "staged paths are not exactly the selected plan")
    try:
        git(repo, "commit", "-m", "docs(ce-work): checkpoint selected implementation plan")
    except Operational:
        git(repo, "reset", "--mixed", prior, check=False)
        raise
    commit = git_text(repo, "rev-parse", "HEAD")
    if status_paths(repo):
        raise Operational("BLOCKED", "checkpoint committed but canonical checkout is not clean")
    cp = {"prior_head": prior, "commit": commit, "tree": git_text(repo, "rev-parse", "HEAD^{tree}"), "path": plan_rel, "digest": doc["plan"]["digest"], "at": now_iso()}
    with locked_manifest(args.run_id, write=True) as doc:
        validate_repo(doc)
        doc["plan"]["checkpoint"] = cp
        event(doc, "plan-checkpoint", detail={"commit": commit, "path": plan_rel})
    return "CHECKPOINTED", {"checkpoint": cp}


@contextlib.contextmanager
def admin_lock(common_dir: str):
    root = ensure_root()
    key = digest_bytes(os.path.realpath(common_dir).encode())
    path = os.path.join(root, ".locks", f"worktree-{key}.lock")
    try:
        create_private(path, b"")
    except Operational:
        pass
    data = read_private(path, 64)
    del data
    fd = os.open(path, os.O_RDWR | O_NOFOLLOW)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def worktree_rows(repo: str) -> list[dict]:
    raw = git_text(repo, "worktree", "list", "--porcelain")
    rows, row = [], {}
    for line in raw.splitlines() + [""]:
        if not line:
            if row:
                rows.append(row)
                row = {}
            continue
        key, _, value = line.partition(" ")
        row[key] = value if value else True
    return rows


def validate_workspace(doc: dict, unit: dict) -> dict:
    repo = doc["repository"]["toplevel"]
    workspace = unit["workspace"]["path"]
    owned = os.path.join(run_dir(doc["run_id"]), "units", unit["unit_id"])
    if os.path.commonpath([os.path.realpath(workspace), os.path.realpath(owned)]) != os.path.realpath(owned):
        raise Operational("BLOCKED", "workspace escaped its owned unit directory")
    validate_private_dir(workspace)
    matches = [r for r in worktree_rows(repo) if os.path.realpath(str(r.get("worktree", ""))) == os.path.realpath(workspace)]
    if len(matches) != 1:
        raise Operational("BLOCKED", "workspace is not registered exactly once")
    if "detached" not in matches[0]:
        raise Operational("BLOCKED", "unit workspace is not detached")
    common = os.path.realpath(git_text(workspace, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    if common != doc["repository"]["common_dir"]:
        raise Operational("BLOCKED", "unit workspace belongs to another repository")
    return matches[0]


def cmd_prepare(args) -> tuple[str, dict]:
    uid = safe_id(args.unit_id, "unit id")
    attempt_id = safe_id(args.attempt_id, "attempt id")
    with locked_manifest(args.run_id) as doc:
        info = validate_repo(doc)
        repo = info["toplevel"]
        base = git_text(repo, "rev-parse", f"{args.base}^{{commit}}")
        if info["head"] != base:
            raise Operational("BLOCKED", "canonical HEAD does not equal requested unit base")
        if status_paths(repo):
            raise Operational("BLOCKED", "canonical checkout is dirty; external workspace unavailable")
        existing = doc["units"].get(uid)
        workspace = os.path.join(run_dir(args.run_id), "units", uid, "workspace")
        if existing and existing["workspace"].get("registered"):
            validate_workspace(doc, existing)
            return "PREPARED", {"unit_id": uid, "workspace": workspace, "base": base, "resumed": True}
        if existing and (existing["workspace"]["path"] != workspace or existing["workspace"]["base"] != base):
            raise Operational("BLOCKED", "duplicate unit id has a different workspace contract")
    unit_root = os.path.dirname(workspace)
    ensure_private_dir(unit_root)
    ensure_private_dir(os.path.join(unit_root, "result"))
    if not existing:
        unit = {
            "unit_id": uid,
            "state": "queued",
            "dependencies": list(args.dependency),
            "wave": {"id": args.wave_id, "base": base, "position": args.wave_position, "allowed_heads": [base]},
            "packet_digest": args.packet_digest,
            "workspace": {"path": workspace, "base": base, "registered": False},
            "attempts": [{"attempt_id": attempt_id, "job_id": None, "process_state": "never-started", "activity": {"posture": args.activity_posture, "latest_at": None}}],
            "transport": {"base": None, "tree": None, "commit": None, "ref": None, "digest": None, "changed_paths": []},
            "integration": {"intent_revision": None, "pre_fold": None, "applied": None, "verification": None, "canonical_commit": None, "restore": None},
            "cleanup": None,
            "recovery_path": unit_root,
        }
        with locked_manifest(args.run_id, write=True) as doc:
            if uid in doc["units"]:
                raise Operational("BLOCKED", "unit was concurrently claimed")
            doc["units"][uid] = unit
            event(doc, "worktree-add-intent", uid, {"path": workspace, "base": base})
    with locked_manifest(args.run_id) as doc:
        common = doc["repository"]["common_dir"]
        repo = doc["repository"]["toplevel"]
    with admin_lock(common):
        if not os.path.exists(workspace):
            git(repo, "worktree", "add", "--detach", workspace, base)
            test_fault("after-worktree-add")
        with locked_manifest(args.run_id) as doc:
            unit = doc["units"][uid]
            validate_workspace(doc, unit)
            if git_text(workspace, "rev-parse", "HEAD") != base:
                raise Operational("BLOCKED", "registered workspace is not at the unit base")
    with locked_manifest(args.run_id, write=True) as doc:
        unit = doc["units"][uid]
        unit["workspace"]["registered"] = True
        event(doc, "worktree-prepared", uid, {"path": workspace, "base": base})
    return "PREPARED", {"unit_id": uid, "workspace": workspace, "result_dir": os.path.join(unit_root, "result"), "base": base, "resumed": False}


def runner_job_dir(run_id: str, job_id: str) -> str:
    return os.path.join(run_dir(run_id), "jobs", safe_id(job_id, "job id"))


def process_evidence(job_dir: str) -> dict:
    validate_private_dir(job_dir)
    status_path = os.path.join(job_dir, "status")
    if os.path.lexists(status_path):
        word = read_private(status_path, 256).decode("ascii", "strict").strip()
        if word not in TERMINAL_PROCESS:
            raise TrustFailure("runner terminal state is invalid")
    elif os.path.lexists(os.path.join(job_dir, "pid")):
        read_private_json(os.path.join(job_dir, "pid"))
        word = "running"
    else:
        word = "never-started"
    activity = {"latest_at": None, "log_bytes": 0}
    log = os.path.join(job_dir, "out.log")
    if os.path.lexists(log):
        st = stat_private_file(log, 10 * 1024 * 1024)
        activity = {"latest_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(st.st_mtime)), "log_bytes": st.st_size}
    return {"process_state": word, "activity": activity}


def matching_runner_jobs(run_id: str, unit: dict) -> list[str]:
    jobs = os.path.join(run_dir(run_id), "jobs")
    validate_private_dir(jobs)
    matches: list[str] = []
    for entry in os.scandir(jobs):
        if not entry.is_dir(follow_symlinks=False):
            continue
        safe_id(entry.name, "job id")
        validate_private_dir(entry.path)
        meta = read_private_json(os.path.join(entry.path, "meta.json"))
        if (
            meta.get("skill") == "ce-work"
            and meta.get("run_id") == run_id
            and meta.get("label") == unit["unit_id"]
            and meta.get("input_digest") == unit["packet_digest"]
        ):
            matches.append(entry.name)
    return sorted(matches)


def find_attempt(unit: dict, attempt_id: str | None = None) -> dict:
    attempts = unit.get("attempts", [])
    if attempt_id:
        matches = [a for a in attempts if a.get("attempt_id") == attempt_id]
    else:
        matches = attempts[-1:]
    if len(matches) != 1:
        raise Operational("AMBIGUOUS", "attempt could not be identified exactly")
    return matches[0]


def cmd_record_job(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        unit = doc["units"].get(args.unit_id)
        if not unit:
            raise Operational("REFUSED", "unknown unit")
        attempt = find_attempt(unit, args.attempt_id)
        if attempt.get("job_id"):
            if attempt["job_id"] != args.job_id:
                raise Operational("AMBIGUOUS", "attempt is already bound to another job")
            return "AUTHORING", {"unit_id": args.unit_id, "job_id": args.job_id, "resumed": True}
        job_dir = runner_job_dir(args.run_id, args.job_id)
        meta = read_private_json(os.path.join(job_dir, "meta.json"))
        expected_result = os.path.join(run_dir(args.run_id), "units", args.unit_id, "result")
        result_path = meta.get("result_path")
        if meta.get("skill") != "ce-work" or meta.get("run_id") != args.run_id or meta.get("label") != args.unit_id or meta.get("input_digest") != unit["packet_digest"]:
            raise Operational("BLOCKED", "runner job metadata does not match unit contract")
        if not isinstance(result_path, str) or os.path.commonpath([os.path.abspath(result_path), expected_result]) != expected_result:
            raise Operational("BLOCKED", "runner result path is outside the unit result directory")
    with locked_manifest(args.run_id, write=True) as doc:
        unit = doc["units"][args.unit_id]
        attempt = find_attempt(unit, args.attempt_id)
        if attempt.get("job_id") not in (None, args.job_id):
            raise Operational("AMBIGUOUS", "attempt was concurrently bound")
        attempt["job_id"] = args.job_id
        unit["state"] = "authoring"
        event(doc, "job-bound", args.unit_id, {"attempt_id": args.attempt_id, "job_id": args.job_id})
    return "AUTHORING", {"unit_id": args.unit_id, "job_id": args.job_id, "resumed": False}


def sync_job(run_id: str, unit_id: str) -> dict:
    with locked_manifest(run_id) as doc:
        unit = doc["units"].get(unit_id)
        if not unit:
            raise Operational("REFUSED", "unknown unit")
        attempt = find_attempt(unit)
        if not attempt.get("job_id"):
            return {"process_state": "never-started", "activity": attempt["activity"]}
        evidence = process_evidence(runner_job_dir(run_id, attempt["job_id"]))
    with locked_manifest(run_id, write=True) as doc:
        attempt = find_attempt(doc["units"][unit_id])
        attempt["process_state"] = evidence["process_state"]
        attempt["activity"].update(evidence["activity"])
        event(doc, "job-synced", unit_id, {"process_state": evidence["process_state"]})
    return {"process_state": evidence["process_state"], "activity": attempt["activity"]}


def cmd_sync_job(args) -> tuple[str, dict]:
    evidence = sync_job(args.run_id, args.unit_id)
    return "SYNCED", {"unit_id": args.unit_id, **evidence}


def transport_ref(run_id: str, unit_id: str) -> str:
    return f"refs/ce-work/{digest_bytes(run_id.encode())[:20]}/{digest_bytes(unit_id.encode())[:20]}"


def no_sequencer(workspace: str) -> None:
    git_dir = git_text(workspace, "rev-parse", "--path-format=absolute", "--absolute-git-dir")
    for name in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"):
        if os.path.exists(os.path.join(git_dir, name)):
            raise Operational("BLOCKED", f"worker workspace has unresolved Git operation: {name}")


def parse_diff_paths(raw: bytes) -> list[str]:
    parts = raw.split(b"\0")
    paths: list[str] = []
    expect_paths = 0
    for part in parts:
        if not part:
            continue
        text = part.decode("utf-8", "surrogateescape")
        if expect_paths:
            paths.append(text)
            expect_paths -= 1
        else:
            expect_paths = 2 if text.startswith(("R", "C")) else 1
    if expect_paths:
        raise Operational("BLOCKED", "incomplete NUL-delimited transport inventory")
    return paths


def terminalize(run_id: str, unit_id: str) -> dict:
    evidence = sync_job(run_id, unit_id)
    if evidence["process_state"] != "done":
        raise Operational("BLOCKED", f"worker is not authoritatively done ({evidence['process_state']})")
    with locked_manifest(run_id, write=True) as doc:
        unit = doc["units"].get(unit_id)
        if unit and unit["state"] == "authoring":
            unit["state"] = "authored"
            event(doc, "worker-output-authored", unit_id)
    with locked_manifest(run_id) as doc:
        unit = doc["units"].get(unit_id)
        if not unit:
            raise Operational("REFUSED", "unknown unit")
        if unit["state"] == "integration-pending" and unit["transport"].get("commit"):
            return unit["transport"]
        if unit["state"] != "authored":
            raise Operational("BLOCKED", f"unit cannot terminalize from {unit['state']}")
        validate_workspace(doc, unit)
        workspace = unit["workspace"]["path"]
        base = unit["workspace"]["base"]
        repo = doc["repository"]["toplevel"]
    no_sequencer(workspace)
    git(workspace, "add", "-A", "--", ".")
    index = git(workspace, "ls-files", "--stage", "-z")
    if any(row.startswith(b"160000 ") for row in index.split(b"\0") if row):
        raise Operational("BLOCKED", "submodule state cannot be transported implicitly")
    tree = git_text(workspace, "write-tree")
    ref = transport_ref(run_id, unit_id)
    existing = git_text(repo, "rev-parse", "-q", "--verify", ref, check=False)
    if existing:
        parents = git_text(repo, "rev-list", "--parents", "-n", "1", existing).split()
        existing_tree = git_text(repo, "rev-parse", f"{existing}^{{tree}}")
        if parents != [existing, base] or existing_tree != tree:
            raise Operational("BLOCKED", "preexisting transport ref does not match final tree/base")
        commit = existing
    else:
        env = {
            "GIT_AUTHOR_NAME": "ce-work transport",
            "GIT_AUTHOR_EMAIL": "ce-work@localhost",
            "GIT_COMMITTER_NAME": "ce-work transport",
            "GIT_COMMITTER_EMAIL": "ce-work@localhost",
        }
        commit = git(repo, "commit-tree", tree, "-p", base, input_data=f"ce-work transport {run_id}/{unit_id}\n".encode(), env=env).decode().strip()
        zero = "0" * 40
        git(repo, "update-ref", ref, commit, zero)
        test_fault("after-transport-ref")
    raw_diff = git(repo, "diff-tree", "-r", "-M", "--name-status", "-z", base, commit)
    paths = parse_diff_paths(raw_diff)
    tdigest = digest_bytes(base.encode() + b"\0" + tree.encode() + b"\0" + commit.encode() + b"\0" + raw_diff)
    transport = {
        "base": base, "tree": tree, "commit": commit, "ref": ref,
        "digest": tdigest, "changed_paths": paths,
        "inventory_b64": base64.b64encode(raw_diff).decode(),
    }
    # Make successful cleanup non-destructive: after F is pinned, normalize the
    # retained inspection worktree to the exact transported tree.
    git(workspace, "reset", "--hard", commit)
    with locked_manifest(run_id, write=True) as doc:
        unit = doc["units"][unit_id]
        if unit["state"] not in ("authored", "integration-pending"):
            raise Operational("BLOCKED", "unit state changed during terminalization")
        unit["state"] = "integration-pending"
        unit["transport"] = transport
        event(doc, "transport-pinned", unit_id, {"commit": commit, "ref": ref, "digest": tdigest})
    return transport


def cmd_terminalize(args) -> tuple[str, dict]:
    transport = terminalize(args.run_id, args.unit_id)
    return "INTEGRATION_PENDING", {"unit_id": args.unit_id, "transport": transport}


def integration_lock_path(doc: dict) -> str:
    ident = doc["repository"]["identity_digest"] + "\0" + doc["branch"]["ref"]
    return os.path.join(runs_root(), ".locks", f"integration-{digest_bytes(ident.encode())}.json")


def read_integration_lock(path: str) -> dict:
    return read_private_json(path)


def validate_lock(doc: dict, unit_id: str, token: str) -> tuple[str, dict]:
    path = integration_lock_path(doc)
    try:
        lock = read_integration_lock(path)
    except TrustFailure as exc:
        if not os.path.lexists(path):
            raise Operational("BLOCKED", "integration lock is missing") from exc
        raise
    expected = {"run_id": doc["run_id"], "unit_id": unit_id, "nonce": token, "repository": doc["repository"]["identity_digest"], "branch_ref": doc["branch"]["ref"]}
    if any(lock.get(k) != v for k, v in expected.items()):
        raise Operational("BLOCKED", "integration lock token or identity mismatch")
    return path, lock


def cmd_integration_acquire(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        validate_repo(doc)
        unit = doc["units"].get(args.unit_id)
        if not unit or unit["state"] not in INTEGRATABLE_STATES | {"preserved", "committed"}:
            raise Operational("REFUSED", "unit is not ready for integration")
        path = integration_lock_path(doc)
        existing = doc.get("integration_lock")
        if existing:
            validate_lock(doc, args.unit_id, existing["nonce"])
            return "ACQUIRED", {"lock_token": existing["nonce"], "resumed": True, "path": path}
        nonce = secrets.token_hex(24)
        payload = {"run_id": args.run_id, "unit_id": args.unit_id, "nonce": nonce, "repository": doc["repository"]["identity_digest"], "branch_ref": doc["branch"]["ref"], "created_at": now_iso()}
        try:
            create_private(path, (json.dumps(payload, sort_keys=True) + "\n").encode())
        except Operational:
            lock = read_integration_lock(path)
            if lock.get("run_id") == args.run_id and lock.get("unit_id") == args.unit_id:
                nonce = lock["nonce"]
            else:
                raise Operational("BLOCKED", "another run/unit owns canonical integration", {"owner_run": lock.get("run_id"), "owner_unit": lock.get("unit_id")})
    with locked_manifest(args.run_id, write=True) as doc:
        doc["integration_lock"] = {"unit_id": args.unit_id, "nonce": nonce, "path": path}
        event(doc, "integration-lock-acquired", args.unit_id)
    return "ACQUIRED", {"lock_token": nonce, "resumed": False, "path": path}


def semantic_snapshot(repo: str) -> dict:
    head = git_text(repo, "rev-parse", "HEAD")
    head_tree = git_text(repo, "rev-parse", "HEAD^{tree}")
    index_tree = git_text(repo, "write-tree")
    raw = git(repo, "status", "--porcelain=v2", "-z", "--untracked-files=all")
    return {
        "head": head,
        "branch_ref": git_text(repo, "symbolic-ref", "-q", "HEAD", check=False),
        "head_tree": head_tree,
        "index_tree": index_tree,
        "status_sha256": digest_bytes(raw),
        "status_empty": not bool(raw),
    }


def cmd_preflight(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        info = validate_repo(doc)
        unit = doc["units"].get(args.unit_id)
        if not unit or unit["state"] not in {"integration-pending", "preserved"}:
            raise Operational("REFUSED", "unit is not integration-pending")
        validate_lock(doc, args.unit_id, args.lock_token)
        allowed = set(unit["wave"].get("allowed_heads", []))
        if args.allowed_head:
            requested = {git_text(info["toplevel"], "rev-parse", f"{h}^{{commit}}") for h in args.allowed_head}
            if not requested.issubset(allowed):
                raise Operational("BLOCKED", "unrecorded same-wave HEAD allowance")
        if info["head"] not in allowed:
            raise Operational("BLOCKED", "canonical HEAD advanced outside the recorded wave")
        snap = semantic_snapshot(info["toplevel"])
        if not snap["status_empty"] or snap["index_tree"] != snap["head_tree"]:
            raise Operational("BLOCKED", "canonical checkout is not clean at preflight")
        intent_revision = doc["revision"] + 1
    with locked_manifest(args.run_id, write=True) as doc:
        unit = doc["units"][args.unit_id]
        unit["state"] = "integration-pending"
        unit["integration"]["intent_revision"] = intent_revision
        unit["integration"]["pre_fold"] = snap
        event(doc, "canonical-apply-intent", args.unit_id, {"transport": unit["transport"]["commit"], "pre_head": snap["head"]})
    return "PREFLIGHT_OK", {"unit_id": args.unit_id, "pre_fold": snap, "transport": unit["transport"]}


def cmd_mark_applied(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        validate_lock(doc, args.unit_id, args.lock_token)
        unit = doc["units"].get(args.unit_id)
        if not unit or unit["state"] not in {"integration-pending", "integrated"} or not unit["integration"].get("pre_fold"):
            raise Operational("REFUSED", "no recorded preflight intent")
        repo = validate_repo(doc)["toplevel"]
        snap = semantic_snapshot(repo)
        if snap["head"] != unit["integration"]["pre_fold"]["head"]:
            raise Operational("BLOCKED", "canonical HEAD moved before apply was recorded")
        transport_is_empty = (
            unit["transport"]["tree"]
            == git_text(repo, "rev-parse", f"{unit['transport']['base']}^{{tree}}")
        )
        if snap["status_empty"] and not transport_is_empty:
            raise Operational("BLOCKED", "no applied change is present")
    with locked_manifest(args.run_id, write=True) as doc:
        unit = doc["units"][args.unit_id]
        unit["state"] = "integrated"
        unit["integration"]["applied"] = {"at": now_iso(), "post_index_tree": snap["index_tree"], "status_sha256": snap["status_sha256"]}
        event(doc, "transport-applied", args.unit_id, {"post_index_tree": snap["index_tree"]})
    return "APPLIED", {"unit_id": args.unit_id, "post_index_tree": snap["index_tree"]}


def cmd_mark_verified(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id, write=True) as doc:
        validate_lock(doc, args.unit_id, args.lock_token)
        unit = doc["units"].get(args.unit_id)
        if not unit or unit["state"] not in {"integrated", "verified"}:
            raise Operational("REFUSED", "unit is not applied")
        evidence = {"at": now_iso(), "digest": args.evidence_digest, "summary": args.summary}
        unit["integration"]["verification"] = evidence
        unit["state"] = "verified"
        event(doc, "canonical-verification-passed", args.unit_id, {"digest": args.evidence_digest})
    return "VERIFIED", {"unit_id": args.unit_id, "verification": evidence}


def reconcile_commit(doc: dict, unit: dict) -> dict | None:
    repo = doc["repository"]["toplevel"]
    head = git_text(repo, "rev-parse", "HEAD")
    parents = git_text(repo, "rev-list", "--parents", "-n", "1", head).split()
    expected_parent = unit["integration"]["pre_fold"]["head"]
    expected_tree = unit["integration"]["applied"]["post_index_tree"]
    actual_tree = git_text(repo, "rev-parse", "HEAD^{tree}")
    if parents == [head, expected_parent] and actual_tree == expected_tree and not status_paths(repo):
        return {"commit": head, "parent": expected_parent, "tree": actual_tree, "at": now_iso()}
    return None


def cmd_mark_committed(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        validate_lock(doc, args.unit_id, args.lock_token)
        unit = doc["units"].get(args.unit_id)
        if not unit or unit["state"] not in {"verified", "committed"}:
            raise Operational("REFUSED", "unit has not passed canonical verification")
        commit = reconcile_commit(doc, unit)
        if not commit:
            raise Operational("BLOCKED", "canonical commit parent/tree/cleanliness do not match recorded integration")
    with locked_manifest(args.run_id, write=True) as doc:
        unit = doc["units"][args.unit_id]
        unit["integration"]["canonical_commit"] = commit
        unit["state"] = "committed"
        event(doc, "canonical-commit-confirmed", args.unit_id, {"commit": commit["commit"]})
    return "COMMITTED", {"unit_id": args.unit_id, "canonical_commit": commit}


def path_in_tree(repo: str, treeish: str, rel: str) -> bool:
    out = git(repo, "ls-tree", "-z", "--full-tree", treeish, "--", rel)
    return bool(out)


def remove_introduced_paths(repo: str, unit: dict) -> None:
    pre = unit["integration"]["pre_fold"]["head"]
    base = unit["transport"]["base"]
    commit = unit["transport"]["commit"]
    raw = git(repo, "diff-tree", "-r", "-M", "--name-status", "-z", base, commit)
    for rel in parse_diff_paths(raw):
        if path_in_tree(repo, pre, rel):
            continue
        target = os.path.abspath(os.path.join(repo, rel))
        if os.path.commonpath([repo, target]) != repo:
            raise Operational("BLOCKED", "transport path escaped canonical repository")
        if os.path.islink(target) or os.path.isfile(target):
            os.unlink(target)
        elif os.path.isdir(target):
            shutil.rmtree(target)
        parent = os.path.dirname(target)
        while parent != repo and os.path.commonpath([repo, parent]) == repo:
            try:
                os.rmdir(parent)
            except OSError:
                break
            parent = os.path.dirname(parent)


def restore(run_id: str, unit_id: str, lock_token: str) -> bool:
    with locked_manifest(run_id, write=True) as doc:
        validate_lock(doc, unit_id, lock_token)
        unit = doc["units"].get(unit_id)
        if not unit or not unit["integration"].get("pre_fold"):
            raise Operational("REFUSED", "unit has no pre-fold snapshot")
        unit["state"] = "restoring"
        event(doc, "restore-intent", unit_id)
        repo = doc["repository"]["toplevel"]
        pre = dict(unit["integration"]["pre_fold"])
    git(repo, "cherry-pick", "--abort", check=False)
    git(repo, "reset", "--hard", pre["head"])
    test_fault("restore-after-reset")
    with locked_manifest(run_id) as doc:
        unit = doc["units"][unit_id]
        remove_introduced_paths(repo, unit)
    test_fault("restore-after-path-removal")
    actual = semantic_snapshot(repo)
    exact = actual == pre
    with locked_manifest(run_id, write=True) as doc:
        unit = doc["units"][unit_id]
        unit["integration"]["restore"] = {"at": now_iso(), "exact": exact, "snapshot": actual}
        if exact:
            unit["state"] = "preserved"
            event(doc, "canonical-restored", unit_id)
        else:
            blocker = {"at": now_iso(), "unit_id": unit_id, "reason": "exact pre-fold restoration could not be proven"}
            doc["blockers"].append(blocker)
            event(doc, "restore-blocked", unit_id)
    return exact


def cmd_restore(args) -> tuple[str, dict]:
    exact = restore(args.run_id, args.unit_id, args.lock_token)
    if not exact:
        raise Operational("BLOCKED", "exact pre-fold restoration could not be proven")
    return "PRESERVED", {"unit_id": args.unit_id, "recovery_path": os.path.join(run_dir(args.run_id), "units", args.unit_id)}


def cmd_status(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        validate_repo(doc)
        if args.unit_id:
            unit = doc["units"].get(args.unit_id)
            if not unit:
                raise Operational("REFUSED", "unknown unit")
            body = {"run_id": args.run_id, "revision": doc["revision"], "unit": unit, "integration_lock": doc.get("integration_lock"), "blockers": doc.get("blockers", [])}
        else:
            body = {"run_id": args.run_id, "revision": doc["revision"], "units": doc["units"], "integration_lock": doc.get("integration_lock"), "blockers": doc.get("blockers", []), "recovery_path": run_dir(args.run_id)}
    return "STATUS", body


def cmd_resume(args) -> tuple[str, dict]:
    actions: list[dict] = []
    with locked_manifest(args.run_id) as doc:
        validate_repo(doc)
        unit_ids = list(doc["units"])
    for uid in unit_ids:
        with locked_manifest(args.run_id) as doc:
            unit = doc["units"][uid]
            state = unit["state"]
            attempt = find_attempt(unit)
            lock = doc.get("integration_lock")
        if state == "queued" and not attempt.get("job_id"):
            matches = matching_runner_jobs(args.run_id, unit)
            if len(matches) > 1:
                raise Operational("AMBIGUOUS", f"multiple runner jobs match queued unit {uid}")
            if len(matches) == 1:
                with locked_manifest(args.run_id, write=True) as current:
                    current_unit = current["units"][uid]
                    current_attempt = find_attempt(current_unit)
                    if current_attempt.get("job_id") not in (None, matches[0]):
                        raise Operational("AMBIGUOUS", "attempt was concurrently bound")
                    current_attempt["job_id"] = matches[0]
                    current_unit["state"] = "authoring"
                    event(current, "job-adopted", uid, {"job_id": matches[0]})
                actions.append({"unit_id": uid, "action": "job-adopted", "job_id": matches[0]})
                evidence = sync_job(args.run_id, uid)
                actions.append({"unit_id": uid, "action": "monitored", "process_state": evidence["process_state"]})
                if evidence["process_state"] == "done":
                    transport = terminalize(args.run_id, uid)
                    actions.append({"unit_id": uid, "action": "terminalized", "transport": transport["commit"]})
        elif state == "authoring" and attempt.get("job_id"):
            evidence = sync_job(args.run_id, uid)
            actions.append({"unit_id": uid, "action": "monitored", "process_state": evidence["process_state"]})
            if evidence["process_state"] == "done":
                transport = terminalize(args.run_id, uid)
                actions.append({"unit_id": uid, "action": "terminalized", "transport": transport["commit"]})
        elif state == "authored":
            transport = terminalize(args.run_id, uid)
            actions.append({"unit_id": uid, "action": "terminalized", "transport": transport["commit"]})
        elif state == "restoring" and lock and lock.get("unit_id") == uid:
            exact = restore(args.run_id, uid, lock["nonce"])
            actions.append({"unit_id": uid, "action": "restored" if exact else "blocked"})
        elif state == "integration-pending" and unit["integration"].get("pre_fold") and lock and lock.get("unit_id") == uid:
            repo = doc["repository"]["toplevel"]
            snap = semantic_snapshot(repo)
            if snap != unit["integration"]["pre_fold"]:
                exact = restore(args.run_id, uid, lock["nonce"])
                actions.append({"unit_id": uid, "action": "restored-ambiguous-apply" if exact else "blocked"})
        elif state == "verified" and lock and lock.get("unit_id") == uid:
            with locked_manifest(args.run_id) as current:
                commit = reconcile_commit(current, current["units"][uid])
            if commit:
                with locked_manifest(args.run_id, write=True) as current:
                    current["units"][uid]["integration"]["canonical_commit"] = commit
                    current["units"][uid]["state"] = "committed"
                    event(current, "canonical-commit-reconciled", uid, {"commit": commit["commit"]})
                actions.append({"unit_id": uid, "action": "commit-reconciled", "commit": commit["commit"]})
    return "RESUMED", {"run_id": args.run_id, "actions": actions, "redispatched": False, "applied": False}


def cmd_reap(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        unit = doc["units"].get(args.unit_id)
        if not unit:
            raise Operational("REFUSED", "unknown unit")
        attempt = find_attempt(unit)
        if not attempt.get("job_id"):
            return "REAPED", {"unit_id": args.unit_id, "process_state": "never-started"}
        job_dir = runner_job_dir(args.run_id, attempt["job_id"])
    runner = os.path.join(os.path.dirname(__file__), "peer-job-runner.py")
    proc = subprocess.run([sys.executable, runner, "reap", job_dir], capture_output=True, check=False)
    if proc.returncode not in (0,):
        raise Operational("BLOCKED", f"runner reap failed: {proc.stderr.decode('utf-8', 'replace').strip()}")
    evidence = sync_job(args.run_id, args.unit_id)
    return "REAPED", {"unit_id": args.unit_id, **evidence, "recovery_path": os.path.join(run_dir(args.run_id), "units", args.unit_id)}


def cmd_cleanup(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        validate_repo(doc)
        unit = doc["units"].get(args.unit_id)
        if not unit:
            raise Operational("REFUSED", "unknown unit")
        if unit["state"] == "cleaned":
            return "CLEANED", {"unit_id": args.unit_id, "resumed": True}
        attempt = find_attempt(unit)
        if attempt.get("process_state") == "running":
            raise Operational("REFUSED", "cannot cleanup a live worker")
        commit = unit["transport"].get("commit")
        if args.abandon:
            if not commit or args.expect_transport != commit:
                raise Operational("REFUSED", "abandon cleanup requires exact transport SHA")
        elif unit["state"] != "committed":
            raise Operational("REFUSED", "uncommitted output is retained unless explicitly abandoned")
        workspace = unit["workspace"]["path"]
        ref = unit["transport"].get("ref")
        repo = doc["repository"]["toplevel"]
        common = doc["repository"]["common_dir"]
    with locked_manifest(args.run_id, write=True) as doc:
        event(doc, "cleanup-intent", args.unit_id, {"workspace": workspace, "ref": ref})
    with admin_lock(common):
        present = [r for r in worktree_rows(repo) if os.path.realpath(str(r.get("worktree", ""))) == os.path.realpath(workspace)]
        if present:
            git(repo, "worktree", "remove", "--force", workspace)
            test_fault("cleanup-after-worktree-remove")
        if any(os.path.realpath(str(r.get("worktree", ""))) == os.path.realpath(workspace) for r in worktree_rows(repo)):
            raise Operational("BLOCKED", "worktree remained registered after cleanup")
    if ref and commit:
        current = git_text(repo, "rev-parse", "-q", "--verify", ref, check=False)
        if current and current != commit:
            raise Operational("BLOCKED", "transport ref changed; refusing cleanup")
        if current:
            git(repo, "update-ref", "-d", ref, commit)
    with locked_manifest(args.run_id, write=True) as doc:
        unit = doc["units"][args.unit_id]
        unit["cleanup"] = {"at": now_iso(), "workspace_removed": True, "ref_removed": True, "abandoned": bool(args.abandon)}
        unit["state"] = "cleaned"
        event(doc, "unit-cleaned", args.unit_id)
    return "CLEANED", {"unit_id": args.unit_id, "resumed": False}


def cmd_integration_release(args) -> tuple[str, dict]:
    with locked_manifest(args.run_id) as doc:
        unit = doc["units"].get(args.unit_id)
        if not unit or unit["state"] not in {"committed", "preserved", "cleaned"}:
            raise Operational("REFUSED", "integration lock releases only after commit or exact preservation")
        path, _ = validate_lock(doc, args.unit_id, args.lock_token)
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass
    with locked_manifest(args.run_id, write=True) as doc:
        held = doc.get("integration_lock")
        if held and (held.get("unit_id") != args.unit_id or held.get("nonce") != args.lock_token):
            raise Operational("BLOCKED", "manifest integration claim changed")
        doc["integration_lock"] = None
        event(doc, "integration-lock-released", args.unit_id)
    return "RELEASED", {"unit_id": args.unit_id}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="unit-workspace.py")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("init")
    p.add_argument("--run-id", required=True)
    p.add_argument("--repo", required=True)
    p.add_argument("--plan", required=True)
    p.add_argument("--plan-digest", required=True)
    p.add_argument("--binding-json", default="{}")
    p.add_argument("--egress-json", default="{}")

    p = sub.add_parser("checkpoint-plan")
    p.add_argument("--run-id", required=True)

    p = sub.add_parser("prepare")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)
    p.add_argument("--base", required=True)
    p.add_argument("--packet-digest", required=True)
    p.add_argument("--attempt-id", default="attempt-1")
    p.add_argument("--activity-posture", choices=("incremental", "hard-only"), default="hard-only")
    p.add_argument("--dependency", action="append", default=[])
    p.add_argument("--wave-id")
    p.add_argument("--wave-position", type=int, default=0)

    p = sub.add_parser("record-job")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)
    p.add_argument("--attempt-id", required=True)
    p.add_argument("--job-id", required=True)

    for name in ("sync-job", "terminalize", "reap"):
        p = sub.add_parser(name)
        p.add_argument("--run-id", required=True)
        p.add_argument("--unit-id", required=True)

    p = sub.add_parser("integration-acquire")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)

    p = sub.add_parser("preflight")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)
    p.add_argument("--lock-token", required=True)
    p.add_argument("--allowed-head", action="append", default=[])

    p = sub.add_parser("mark-applied")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)
    p.add_argument("--lock-token", required=True)

    p = sub.add_parser("mark-verified")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)
    p.add_argument("--lock-token", required=True)
    p.add_argument("--evidence-digest", required=True)
    p.add_argument("--summary", default="authoritative verification passed")

    p = sub.add_parser("mark-committed")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)
    p.add_argument("--lock-token", required=True)

    p = sub.add_parser("restore")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)
    p.add_argument("--lock-token", required=True)

    p = sub.add_parser("status")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id")

    p = sub.add_parser("resume")
    p.add_argument("--run-id", required=True)

    p = sub.add_parser("cleanup")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)
    p.add_argument("--abandon", action="store_true")
    p.add_argument("--expect-transport")

    p = sub.add_parser("integration-release")
    p.add_argument("--run-id", required=True)
    p.add_argument("--unit-id", required=True)
    p.add_argument("--lock-token", required=True)
    return parser


COMMANDS = {
    "init": cmd_init,
    "checkpoint-plan": cmd_checkpoint_plan,
    "prepare": cmd_prepare,
    "record-job": cmd_record_job,
    "sync-job": cmd_sync_job,
    "terminalize": cmd_terminalize,
    "integration-acquire": cmd_integration_acquire,
    "preflight": cmd_preflight,
    "mark-applied": cmd_mark_applied,
    "mark-verified": cmd_mark_verified,
    "mark-committed": cmd_mark_committed,
    "restore": cmd_restore,
    "status": cmd_status,
    "resume": cmd_resume,
    "reap": cmd_reap,
    "cleanup": cmd_cleanup,
    "integration-release": cmd_integration_release,
}


def main(argv: list[str]) -> int:
    os.umask(0o077)
    args = build_parser().parse_args(argv)
    try:
        word, body = COMMANDS[args.command](args)
        print(word)
        print(json.dumps(body, sort_keys=True, separators=(",", ":")))
        return 0
    except TrustFailure as exc:
        print("UNREADABLE")
        sys.stderr.write(f"unit-workspace: {exc}\n")
        return 4
    except Operational as exc:
        print(exc.word)
        if exc.detail:
            print(json.dumps(exc.detail, sort_keys=True, separators=(",", ":")))
        sys.stderr.write(f"unit-workspace: {exc}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
