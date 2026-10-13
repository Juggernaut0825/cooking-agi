from pathlib import Path
import shutil
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "site"))
import build


class ReaderHubTests(unittest.TestCase):
    def test_counting_summary_and_store_validation(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node.js unavailable")
        subprocess.run([node, "--test", str(ROOT / "site/tests/reader-hub.test.cjs")], check=True, capture_output=True)

    def test_settings_and_storage_failure_messages(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node.js unavailable")
        subprocess.run([node, "--test", str(ROOT / "site/tests/reader-hub-dom.test.cjs")], check=True, capture_output=True)

    def test_script_stays_local(self):
        script = (ROOT / "site/static/reader-hub.js").read_text()
        for forbidden in ("innerHTML", "sessionStorage", "XMLHttpRequest", "eval("):
            self.assertNotIn(forbidden, script)
        self.assertNotIn("localStorage", script)  # all writes go through the shared progress controller
        self.assertEqual(script.count("fetch("), 1)  # only the public note catalog
        self.assertIn("static/prep-progress-catalog.json", script)

    def test_every_page_loads_the_hub_after_the_progress_controller(self):
        source = (ROOT / "site/build.py").read_text()
        controller = source.index("static/prep-progress.js?v=")
        self.assertLess(controller, source.index("static/reader-hub.js?v="))
        self.assertLess(controller, source.index("static/reader-hub.css?v="))


if __name__ == "__main__":
    unittest.main()
