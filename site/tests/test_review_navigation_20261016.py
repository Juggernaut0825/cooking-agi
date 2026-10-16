import json
from pathlib import Path
import re
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "site"))
import build


class ReviewNavigationTests(unittest.TestCase):
    def test_removed_headings_keep_bookmark_targets(self):
        for suffix in ("", ".en"):
            with self.subTest(language=suffix):
                source = (ROOT / f"interview/code-comprehension{suffix}.md").read_text()
                body, _ = build.render_markdown(source)
                self.assertIn('id="google"', body)
                self.assertIn('id="rules"', body)
                source = (ROOT / f"interview/study-plan{suffix}.md").read_text()
                body, _ = build.render_markdown(source)
                identifiers = re.findall(r'\bid="([^"]+)"', body)
                self.assertEqual(len(identifiers), len(set(identifiers)))
                expected = {"mle-research-engineer", "inference-ml-systems", "research-scientist"}
                expected.add("general-coding-swe" if suffix else "coding-swe")
                expected.add("inference-ml-systems_1" if suffix else "ml")
                expected.add("systems-exercises")
                self.assertTrue(expected <= set(identifiers))

    def test_foundations_starts_with_reading_routes_not_release_notes(self):
        for suffix, first, additions in (
            ("", "## 从基础开始", "## 最近补充"),
            (".en", "## Start with the foundations", "## Recent additions"),
        ):
            with self.subTest(language=suffix):
                source = (ROOT / f"learn/README{suffix}.md").read_text()
                self.assertLess(source.index(first), source.index(additions))
                self.assertLess(source.index("<!-- widget:study-atlas -->"), source.index(additions))
                for series in ("scaling", "diffusion-lm", "quantization"):
                    self.assertRegex(source, rf"{series}/README{re.escape(suffix)}\.md")

    def test_chronicle_summary_keeps_the_technical_qualifier(self):
        nodes = {node["id"]: node for node in json.loads(
            (ROOT / "site/static/technology-tree-data.json").read_text())["nodes"]}
        requirements = {
            "ecosystem-differential-privacy-2006": ("概率分布", "distribution"),
            "chips-euv-volume-production-2019": ("部分", "some"),
            "laion-5b-2022": ("元数据", "metadata"),
            "energy-pue-metric-2007": ("开销", "overhead"),
            "software-c-language-1973": ("大部分", "most"),
        }
        for node_id, terms in requirements.items():
            for language, term in zip(("zh", "en"), terms):
                with self.subTest(node=node_id, language=language):
                    self.assertIn(term, nodes[node_id]["hook"][language])
        for language in ("zh", "en"):
            self.assertIn("NameNode", nodes["storage-hdfs-paper-2010"]["limit"][language])

    def test_reading_panel_has_an_opaque_surface(self):
        source = (ROOT / "site/static/chronicle.css").read_text()
        panel = re.search(r"\.ch-panel\s*\{([^}]+)\}", source).group(1)
        self.assertIn("background: var(--paper)", panel)


if __name__ == "__main__":
    unittest.main()
