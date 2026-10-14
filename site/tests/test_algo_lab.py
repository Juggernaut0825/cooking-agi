from pathlib import Path
import re
import shutil
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "site"))
import build

MARKER = re.compile(r"<!-- widget:((?:algo|step)-[a-z0-9-]+) -->")
SKIP = {"_site", "node_modules", ".git", "templates"}


def embedded_figures():
    found = {}
    for note in sorted(ROOT.rglob("*.md")):
        if SKIP & set(note.relative_to(ROOT).parts):
            continue
        for name in MARKER.findall(note.read_text(encoding="utf-8")):
            found.setdefault(name, set()).add(str(note.relative_to(ROOT)))
    return found


class AlgoLabTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node.js required")
    def test_figures_end_on_the_notes_answers(self):
        for test in ["algo-lab.test.cjs", "figure-lab.test.cjs"]:
            subprocess.run([shutil.which("node"), "--test", str(ROOT / "site/tests" / test)], check=True, capture_output=True)

    def test_every_registered_figure_is_implemented_and_embedded_in_both_languages(self):
        scripts = {prefix: (ROOT / f"site/static/{file}").read_text(encoding="utf-8")
                   for prefix, file in [("algo-", "algo-lab.js"), ("step-", "figure-lab.js")]}
        embedded = embedded_figures()
        names = [name for name, _zh, _en in build.ALGO_LAB] + [name for name, _zh, _en, _kind in build.FIGURE_LAB]
        self.assertTrue(all(kind in {"step", "still"} for _n, _z, _e, kind in build.FIGURE_LAB))
        self.assertEqual(len(names), len(set(names)))
        for name in names:
            self.assertTrue(f"FIGURES['{name}']" in scripts[name[:5]], f"{name} has no drawing")
            notes = embedded.get(name, set())
            chinese = {note for note in notes if not note.endswith(".en.md")}
            self.assertTrue(chinese, f"{name} is not in any note")
            for note in chinese:
                self.assertIn(note[:-3] + ".en.md", notes, f"{name} is missing from the English {note}")
        self.assertEqual(set(embedded) - set(names), set(), "notes use unregistered figures")

    def test_the_lab_loads_only_on_pages_with_a_figure(self):
        source = (ROOT / "site/static/app.js").read_text(encoding="utf-8")
        self.assertIn("""if ($('[data-widget^="algo-"], [data-widget^="step-"]'))""", source)
        self.assertIn('"algo-lab.js"', source)


if __name__ == "__main__":
    unittest.main()
