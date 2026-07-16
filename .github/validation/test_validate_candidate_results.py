from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

MODULE_PATH = Path(__file__).with_name("validate_candidate_results.py")
SPEC = importlib.util.spec_from_file_location("validate_candidate_results", MODULE_PATH)
assert SPEC and SPEC.loader
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


def write_result(root: Path, *, failures: set[str] | None = None, log: str = "", exit_code: int = 0) -> None:
    failures = failures or set()
    suites = ET.Element("testsuites", tests="900", failures=str(len(failures)))
    required = sorted(validator.REQUIRED_FILES)
    for index in range(900):
        file_name = required[index] if index < len(required) else f"tests/generated-{index}.test.ts"
        if index < len(failures):
            failure_name = sorted(failures)[index]
            classname, name = failure_name.split(" > ", 1)
        else:
            classname, name = "generated", f"case {index}"
        case = ET.SubElement(suites, "testcase", classname=classname, name=name, file=file_name)
        if index < len(failures):
            ET.SubElement(case, "failure").text = "expected baseline"
    ET.ElementTree(suites).write(root / "full-suite.xml", encoding="utf-8", xml_declaration=True)
    (root / "full-suite.log").write_text(log, encoding="utf-8")
    (root / "full-suite.exit").write_text(f"{exit_code}\n", encoding="utf-8")


class ValidationPolicyTests(unittest.TestCase):
    def test_accepts_complete_clean_suite(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            write_result(root)
            self.assertEqual(validator.validate(root), "validated 900 tests with 0 known baseline failure(s)")

    def test_accepts_only_documented_baseline_failure(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            failure = {next(iter(validator.KNOWN_BASELINE))}
            write_result(root, failures=failure, exit_code=1)
            self.assertIn("1 known baseline", validator.validate(root))

    def test_rejects_unhandled_error_marker_even_with_allowlisted_junit(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            failure = {next(iter(validator.KNOWN_BASELINE))}
            write_result(root, failures=failure, log="Unhandled error between tests\n", exit_code=1)
            with self.assertRaisesRegex(ValueError, "internal/collection"):
                validator.validate(root)

    def test_rejects_bun_error_summary_even_with_allowlisted_junit(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            failure = {next(iter(validator.KNOWN_BASELINE))}
            write_result(root, failures=failure, log="26 errors\n", exit_code=1)
            with self.assertRaisesRegex(ValueError, "internal/collection"):
                validator.validate(root)

    def test_rejects_unexpected_failure(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            write_result(root, failures={"unexpected class > unexpected test"}, exit_code=1)
            with self.assertRaisesRegex(ValueError, "unexpected failures"):
                validator.validate(root)


if __name__ == "__main__":
    unittest.main()
