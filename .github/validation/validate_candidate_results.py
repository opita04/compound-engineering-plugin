#!/usr/bin/env python3
"""Trusted policy gate for Compound Engineering candidate test output."""

from __future__ import annotations

from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

MIN_TESTS = 900
REQUIRED_FILES = {
    "tests/ce-babysit-pr-snapshot.test.ts",
    "tests/review-skill-contract.test.ts",
    "tests/skills/unified-plan-artifact-contract.test.ts",
}
KNOWN_BASELINE = {
    "ce-babysit-pr pr-snapshot engine > an invocation session start carries into a new managed-stack layer state dir",
    "ce-babysit-pr pr-snapshot engine > re-arming watch preserves the invocation budget instead of resetting it",
}
INTERNAL_MARKERS = (
    "Unhandled error between tests",
    "Test suite aborted",
    'error: script "test" exited',
)


def validate(output: Path) -> str:
    report = output / "full-suite.xml"
    log_text = (output / "full-suite.log").read_text(encoding="utf-8", errors="replace")
    returncode = int((output / "full-suite.exit").read_text(encoding="utf-8").strip())
    if returncode not in {0, 1}:
        raise ValueError(f"full suite exited {returncode}; expected 0 or 1")

    found_markers = [marker for marker in INTERNAL_MARKERS if marker in log_text]
    error_summaries = re.findall(r"(?mi)^\s*([1-9][0-9]*)\s+errors?\s*$", log_text)
    if found_markers or error_summaries:
        raise ValueError(
            f"Bun reported internal/collection errors: markers={found_markers}, "
            f"summaries={error_summaries}"
        )

    root = ET.parse(report).getroot()
    if root.tag != "testsuites":
        raise ValueError(f"unexpected JUnit root: {root.tag}")
    declared = int(root.attrib["tests"])
    declared_failures = int(root.attrib.get("failures", "0"))
    cases = root.findall(".//testcase")
    if declared != len(cases) or declared < MIN_TESTS:
        raise ValueError(
            f"incomplete collection: declared={declared}, cases={len(cases)}, minimum={MIN_TESTS}"
        )

    collected_files = {case.attrib.get("file", "") for case in cases}
    missing = REQUIRED_FILES - collected_files
    if missing:
        raise ValueError(f"missing sentinel test files: {sorted(missing)}")

    errors = [case for case in cases if case.find("error") is not None]
    if errors:
        raise ValueError(f"JUnit contains {len(errors)} internal/collection errors")
    failed = [case for case in cases if case.find("failure") is not None]
    if declared_failures != len(failed):
        raise ValueError(
            f"failure count mismatch: aggregate={declared_failures}, cases={len(failed)}"
        )

    failures = {
        f"{case.attrib.get('classname', '').strip()} > {case.attrib.get('name', '').strip()}"
        for case in failed
    }
    unexpected = failures - KNOWN_BASELINE
    if unexpected:
        raise ValueError(f"unexpected failures: {sorted(unexpected)}")
    if returncode == 0 and failures:
        raise ValueError("suite exited 0 while JUnit reports failures")
    if returncode == 1 and not failures:
        raise ValueError("suite exited 1 without an allowlisted failure")
    return f"validated {declared} tests with {len(failures)} known baseline failure(s)"


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {Path(sys.argv[0]).name} OUTPUT_DIR", file=sys.stderr)
        return 2
    try:
        print(validate(Path(sys.argv[1]).resolve()))
    except (OSError, ValueError, ET.ParseError) as exc:
        print(f"candidate result rejected: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
