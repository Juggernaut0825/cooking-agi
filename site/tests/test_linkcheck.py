from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import linkcheck


class LinkCheckTests(unittest.TestCase):
    def check(self, files):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, content in files.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
            return linkcheck.check_site(root, "https://example.org/notes")

    def test_relative_encoded_and_same_origin_links(self):
        pages, references, problems = self.check({
            "index.html": '<a href="sub/?lang=en#section">Sub</a><a href="https://example.org/notes/sub/index.html#section">Absolute</a>',
            "sub/index.html": '<h2 id="section">Section</h2><a href="../%E4%B8%AD%E6%96%87.html#%E4%BE%8B%E5%AD%90">Example</a>',
            "中文.html": '<h2 id="例子">Example</h2>',
        })
        self.assertEqual((pages, references, problems), (3, 3, []))

    def test_missing_file_and_fragment(self):
        _, _, problems = self.check({
            "index.html": '<a href="absent.html">Missing</a><a href="#absent">Fragment</a>',
        })
        self.assertEqual(len(problems), 2)
        self.assertTrue(any("missing file" in problem for problem in problems))
        self.assertTrue(any("missing anchor #absent" in problem for problem in problems))

    def test_redirect_preserves_fragment_and_checks_destination(self):
        _, _, problems = self.check({
            "index.html": '<a href="old.html#good">Good</a><a href="old.html#bad">Bad</a>',
            "old.html": '<meta http-equiv="refresh" content="0; url=new.html">',
            "new.html": '<h2 id="good">Good</h2>',
        })
        self.assertEqual(len(problems), 1)
        self.assertIn("missing anchor #bad", problems[0])

    def test_redirect_cycles_fail(self):
        _, _, problems = self.check({
            "one.html": '<meta http-equiv="refresh" content="0; url=two.html">',
            "two.html": '<meta http-equiv="refresh" content="0; url=one.html">',
        })
        self.assertEqual(len(problems), 2)
        self.assertTrue(all("redirect cycle" in problem for problem in problems))

    def test_assets_queries_and_text_fragments(self):
        _, references, problems = self.check({
            "index.html": '<img src="image.svg?v=2"><video poster="poster.png"></video><a href="#:~:text=hello">Text</a><a href="#legacy:~:text=hello">Named text</a><a name="legacy"></a>',
            "image.svg": "<svg></svg>",
            "poster.png": "test asset",
        })
        self.assertEqual(references, 4)
        self.assertEqual(problems, [])

    def test_external_links_are_not_fetched_or_treated_as_local(self):
        _, references, problems = self.check({
            "index.html": '<a href="https://external.org/paper">Paper</a><a href="mailto:user@example.org">Mail</a><a href="/other-project/">Other project</a><img src="data:image/png;base64,AAAA">',
        })
        self.assertEqual((references, problems), (0, []))

    def test_encoded_path_cannot_escape_build_directory(self):
        _, _, problems = self.check({
            "index.html": '<a href="%2e%2e/private.html">Outside</a>',
        })
        self.assertEqual(len(problems), 1)
        self.assertIn("escapes the build directory", problems[0])


if __name__ == "__main__":
    unittest.main()
