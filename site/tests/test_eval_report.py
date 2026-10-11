from contextlib import redirect_stderr, redirect_stdout
import copy
import hashlib
from html.parser import HTMLParser
import importlib.util
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "practice/web-lab/code/eval_report.py"
FIXTURES = SOURCE.parent / "eval-fixtures"
SPEC = importlib.util.spec_from_file_location("eval_report_lab", SOURCE)
LAB = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LAB)


class Elements(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.tags = []
        self.attributes = []
        self.feed(markup)

    def handle_starttag(self, tag, attributes):
        self.tags.append(tag)
        self.attributes.append(dict(attributes))


class EvalReportTests(unittest.TestCase):
    def setUp(self):
        self.suite = json.loads((FIXTURES / "suite.json").read_text())
        self.baseline = json.loads((FIXTURES / "baseline.json").read_text())
        self.candidate = json.loads((FIXTURES / "candidate.json").read_text())
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)

    def compare(self):
        return LAB.compare(self.suite, self.baseline, self.candidate)

    def test_fixture_counts_slices_and_required_case(self):
        report = self.compare()
        self.assertEqual(report["overall"], {"count": 6, "baseline_passed": 4, "candidate_passed": 5})
        self.assertEqual(report["changes"], {"improved": 2, "regressed": 1, "unchanged": 3})
        self.assertEqual(report["slices"]["evidence"], {"count": 4, "baseline_passed": 2, "candidate_passed": 4})
        self.assertEqual(report["slices"]["no-evidence"], {"count": 2, "baseline_passed": 2, "candidate_passed": 1})
        self.assertEqual(report["gate"], {"passed": False, "critical_failures": ["q5"], "overall_drop": False})

    def test_pairing_is_by_id_not_position(self):
        expected = self.compare()
        self.baseline["results"].reverse()
        self.candidate["results"] = self.candidate["results"][2:] + self.candidate["results"][:2]
        self.assertEqual(self.compare(), expected)

    def test_missing_extra_and_duplicate_ids_fail_in_both_runs(self):
        for side in ("baseline", "candidate"):
            for operation in ("missing", "extra", "duplicate"):
                with self.subTest(side=side, operation=operation):
                    document = copy.deepcopy(getattr(self, side))
                    if operation == "missing":
                        document["results"].pop()
                    else:
                        extra = copy.deepcopy(document["results"][0])
                        if operation == "extra":
                            extra["id"] = "not-in-suite"
                        document["results"].append(extra)
                    arguments = {"suite": self.suite, "baseline": self.baseline, "candidate": self.candidate, side: document}
                    with self.assertRaises(ValueError):
                        LAB.compare(**arguments)

    def test_duplicate_suite_case_is_not_silently_overwritten(self):
        self.suite["cases"].append(copy.deepcopy(self.suite["cases"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate case ID"):
            self.compare()

    def test_booleans_are_not_coerced(self):
        for invalid in (0, 1, "false", "true", None, [], {}):
            with self.subTest(invalid=invalid):
                self.candidate["results"][0]["passed"] = invalid
                with self.assertRaisesRegex(ValueError, "expected JSON true or false"):
                    self.compare()
        self.candidate["results"][0]["passed"] = True
        self.suite["cases"][0]["critical"] = 1
        with self.assertRaisesRegex(ValueError, "expected JSON true or false"):
            self.compare()

    def test_schema_and_suite_version_fail_closed(self):
        for field, value in (("suite", "wrong-version"), ("run", ""), ("results", [])):
            document = {**self.candidate, field: value}
            with self.subTest(field=field), self.assertRaises(ValueError):
                LAB.compare(self.suite, self.baseline, document)
        with self.assertRaises(ValueError):
            LAB.compare(self.suite, self.baseline, {**self.candidate, "critical": False})
        with self.assertRaises(ValueError):
            LAB.compare([], self.baseline, self.candidate)

    def test_critical_case_still_failing_is_blocked(self):
        self.baseline["results"][4]["passed"] = False
        report = self.compare()
        self.assertEqual(report["cases"][4]["change"], "unchanged")
        self.assertFalse(report["gate"]["passed"])

    def test_overall_drop_blocks_even_without_critical_failures(self):
        for result in self.baseline["results"]:
            result["passed"] = True
        self.candidate["results"][4]["passed"] = True
        self.candidate["results"][0]["passed"] = False
        self.assertEqual(self.compare()["gate"], {"passed": False, "critical_failures": [], "overall_drop": True})

    def test_noncritical_regression_can_pass_when_compensated(self):
        self.candidate["results"][4]["passed"] = True
        self.candidate["results"][2]["passed"] = False
        report = self.compare()
        self.assertEqual(report["changes"]["regressed"], 1)
        self.assertTrue(report["gate"]["passed"])

    def test_same_label_does_not_mean_same_output(self):
        self.candidate["results"][2]["output"] = "The limit is four books per reader."
        self.assertEqual(self.compare()["cases"][2]["change"], "unchanged")

    def test_read_document_rejects_ambiguous_or_invalid_json(self):
        for raw in (b'{"suite":"a","suite":"b"}', b'{"score":NaN}', b'{"score":Infinity}',
                    b'{"score":-Infinity}', b'\xff', b'{', b'[' * 3000):
            filename = self.directory / "input.json"
            filename.write_bytes(raw)
            with self.subTest(raw=raw[:30]), self.assertRaises(ValueError):
                LAB.read_document(filename)

    def test_size_and_case_limits(self):
        filename = self.directory / "large.json"
        filename.write_bytes(b" " * (LAB.MAX_BYTES + 1))
        with self.assertRaisesRegex(ValueError, "2 MiB"):
            LAB.read_document(filename)
        self.suite["cases"] = [self.suite["cases"][0]] * (LAB.MAX_CASES + 1)
        with self.assertRaisesRegex(ValueError, "1..1000"):
            self.compare()

    def test_invalid_unicode_and_controls_are_rejected_but_chinese_is_allowed(self):
        for output in ("\ud800", "\udfff", "hidden\x00text", "a" * 2001):
            self.candidate["results"][0]["output"] = output
            with self.subTest(output=ascii(output[:8])), self.assertRaises(ValueError):
                self.compare()
        self.candidate["results"][0]["output"] = "早上九点开门。📚"
        self.assertEqual(self.compare()["cases"][0]["candidate"]["output"], "早上九点开门。📚")

    def test_html_escapes_input_and_keeps_failed_case_open(self):
        payload = '<script>alert("unsafe")</script><img src=x onerror=alert(1)>'
        self.suite["cases"][4]["prompt"] = payload
        self.suite["cases"][4]["expected"] = payload
        self.suite["cases"][4]["slice"] = payload
        self.candidate["run"] = payload
        self.candidate["results"][4]["output"] = payload
        report = self.compare()
        report["input_sha256"] = {"suite": "a" * 64}
        for language in ("zh", "en"):
            markup = LAB.render(report, language)
            parsed = Elements(markup)
            self.assertNotIn(payload, markup)
            self.assertIn("&lt;script&gt;", markup)
            self.assertNotIn("script", parsed.tags)
            self.assertNotIn("img", parsed.tags)
            self.assertTrue(any("open" in attributes for attributes in parsed.attributes))
            self.assertEqual(parsed.tags.count("details"), 6)
            self.assertIn(f'lang="{language}"', markup)
            self.assertIn(LAB.LABELS[language]["blocked"], markup)
            self.assertIn("+16.7 pp", markup)
            self.assertFalse(any("src" in attributes or "href" in attributes for attributes in parsed.attributes))

    def command(self, candidate="candidate.json", out_name="report", **overrides):
        values = {"suite": FIXTURES / "suite.json", "baseline": FIXTURES / "baseline.json",
                  "candidate": FIXTURES / candidate, "out-dir": self.directory / out_name, "lang": "zh"}
        values.update(overrides)
        return [sys.executable, "-B", str(SOURCE), *(item for name, value in values.items() for item in (f"--{name}", str(value)))]

    def test_real_cli_has_distinct_pass_blocked_and_error_codes(self):
        for candidate, code in (("candidate.json", 1), ("candidate-fixed.json", 0)):
            with self.subTest(candidate=candidate):
                process = subprocess.run(self.command(candidate=candidate, out_name=candidate), capture_output=True, text=True)
                self.assertEqual(process.returncode, code, process.stderr)
                directory = self.directory / candidate
                report = json.loads((directory / "report.json").read_text())
                self.assertEqual(report["gate"]["passed"], code == 0)
                self.assertIn("本地评估练习", (directory / "report.html").read_text())
                self.assertEqual(report["input_sha256"]["candidate"], hashlib.sha256((FIXTURES / candidate).read_bytes()).hexdigest())
        bad = self.directory / "bad.json"
        bad.write_text("{}")
        process = subprocess.run(self.command(candidate=bad), capture_output=True, text=True)
        self.assertEqual(process.returncode, 2)
        self.assertFalse((self.directory / "report").exists())

    def test_existing_output_directory_is_not_overwritten(self):
        directory = self.directory / "report"
        directory.mkdir()
        (directory / "report.html").write_text("keep this report")
        process = subprocess.run(self.command(), capture_output=True, text=True)
        self.assertEqual(process.returncode, 2)
        self.assertEqual((directory / "report.html").read_text(), "keep this report")
        self.assertFalse((directory / "report.json").exists())

    def test_write_error_is_not_a_success(self):
        arguments = self.command()[3:]
        output, errors = io.StringIO(), io.StringIO()
        with patch.object(Path, "write_text", side_effect=OSError("disk unavailable")), redirect_stdout(output), redirect_stderr(errors):
            self.assertEqual(LAB.main(arguments), 2)
        self.assertEqual(output.getvalue(), "")
        self.assertIn("report not ready", errors.getvalue())

    def test_documentation_has_matching_workflows_without_installing_one(self):
        documents = [(ROOT / f"practice/web-lab/eval-report{suffix}.md").read_text() for suffix in ("", ".en")]
        snippets = [re.search(r"```yaml\n(.*?)\n```", document, re.S).group(1) for document in documents]
        self.assertEqual(snippets[0], snippets[1])
        self.assertIn("if: ${{ !cancelled() }}", snippets[0])
        self.assertIn("if-no-files-found: error", snippets[0])
        self.assertNotIn("continue-on-error", snippets[0])
        self.assertNotIn("|| true", snippets[0])
        self.assertNotIn("pull_request_target", snippets[0])
        self.assertFalse((ROOT / ".github/workflows/eval-lab.yml").exists())


if __name__ == "__main__":
    unittest.main()
