from pathlib import Path
import re
import shutil
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "site"))
import build

MARKER = re.compile(r"<!-- widget:(algo-[a-z0-9-]+) -->")


class AlgoLabTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node.js required")
    def test_figures_end_on_the_notes_answers(self):
        subprocess.run([shutil.which("node"), "--test", str(ROOT / "site/tests/algo-lab.test.cjs")], check=True, capture_output=True)

    def test_every_registered_figure_is_implemented_and_embedded_in_both_languages(self):
        script = (ROOT / "site/static/algo-lab.js").read_text(encoding="utf-8")
        embedded = {}
        for note in sorted((ROOT / "interview/algorithms").glob("*.md")):
            for name in MARKER.findall(note.read_text(encoding="utf-8")):
                embedded.setdefault(name, set()).add(note.name)
        names = [name for name, _zh, _en in build.ALGO_LAB]
        self.assertEqual(len(names), len(set(names)))
        for name in names:
            self.assertIn(f"FIGURES['{name}']", script, name)
            notes = embedded.get(name, set())
            chinese = {note for note in notes if not note.endswith(".en.md")}
            self.assertTrue(chinese, f"{name} is not in any note")
            for note in chinese:
                self.assertIn(note[:-3] + ".en.md", notes, f"{name} is missing from the English {note}")
        self.assertEqual(set(embedded) - set(names), set(), "notes use unregistered figures")

    def test_the_lab_loads_only_on_pages_with_a_figure(self):
        source = (ROOT / "site/static/app.js").read_text(encoding="utf-8")
        self.assertIn("""if ($('[data-widget^="algo-"]'))""", source)
        self.assertIn('"algo-lab.js"', source)


if __name__ == "__main__":
    unittest.main()
