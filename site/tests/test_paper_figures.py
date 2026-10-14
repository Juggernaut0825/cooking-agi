"""Figures from papers: every embedded image must be from a permissively licensed paper,
carry its credit, and exist at the registered size; every marker must be registered."""
from pathlib import Path
import re
import struct
import sys
import tomllib
import unittest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "site"))
import build

REGISTRY = tomllib.loads((ROOT / "site/paper_figures.toml").read_text(encoding="utf-8"))["figure"]
COPYABLE = {"CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
            "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
            "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/"}
MARKER = re.compile(r"<!--\s*paper-figure:([a-z0-9_.-]+)\s*-->")
SKIP = {"_site", "node_modules", ".git", "templates"}


def webp_size(path: Path):
    data = path.read_bytes()[:40]
    assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", path
    chunk = data[12:16]
    if chunk == b"VP8 ":
        width, height = struct.unpack("<HH", data[26:30])
        return width & 0x3FFF, height & 0x3FFF
    if chunk == b"VP8L":
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk == b"VP8X":
        return int.from_bytes(data[24:27], "little") + 1, int.from_bytes(data[27:30], "little") + 1
    raise AssertionError(f"{path}: unknown WebP chunk {chunk!r}")


def embedded_markers():
    found = {}
    for note in sorted(ROOT.rglob("*.md")):
        if SKIP & set(note.relative_to(ROOT).parts):
            continue
        for name in MARKER.findall(note.read_text(encoding="utf-8")):
            found.setdefault(name, set()).add(str(note.relative_to(ROOT)))
    return found


class PaperFigureTests(unittest.TestCase):
    def test_entries_are_complete_and_unique(self):
        ids = [entry["id"] for entry in REGISTRY]
        self.assertEqual(len(ids), len(set(ids)))
        for entry in REGISTRY:
            for key in ("paper", "credit", "arxiv", "figure", "url", "license", "license_url", "zh", "en"):
                self.assertIn(key, entry, entry["id"])
            self.assertTrue(entry["url"].startswith(f"https://arxiv.org/html/{entry['arxiv']}"), entry["id"])
            self.assertIsNone(re.search(r"[　-〿一-鿿＀-￯]", entry["en"]), entry["id"])

    def test_only_permissive_figures_are_copied_and_they_match_their_files(self):
        folder = ROOT / "site/static/paper-figures"
        registered = set()
        for entry in REGISTRY:
            if "image" not in entry:
                continue
            self.assertIn(entry["license"], COPYABLE, f"{entry['id']}: {entry['license']} may not be copied; use a link card")
            self.assertEqual(entry["license_url"], COPYABLE[entry["license"]], entry["id"])
            self.assertIn(entry["changes"], {"resized", "converted"}, entry["id"])
            path = folder / entry["image"]
            self.assertTrue(path.is_file(), path)
            self.assertEqual(webp_size(path), (entry["width"], entry["height"]), entry["id"])
            self.assertLess(path.stat().st_size, 300_000, entry["id"])
            registered.add(entry["image"])
        self.assertEqual({p.name for p in folder.iterdir()}, registered, "unregistered files in paper-figures/")

    def test_every_marker_is_registered_and_used_in_both_languages(self):
        embedded = embedded_markers()
        ids = {entry["id"] for entry in REGISTRY}
        self.assertEqual(set(embedded) - ids, set(), "notes use unregistered paper figures")
        for name in ids:
            notes = embedded.get(name, set())
            chinese = {note for note in notes if not note.endswith(".en.md")}
            self.assertTrue(chinese, f"{name} is not used in any note")
            for note in chinese:
                self.assertIn(note[:-3] + ".en.md", notes, f"{name} is missing from the English {note}")

    def test_rendering_carries_credit_licence_and_language(self):
        class Page:
            lang = "en"
            def rel(self, target):
                return "../" + target
        page = Page()
        for entry in REGISTRY:
            out = build.paper_figure_html(entry["id"], page)
            self.assertIn(entry["url"].replace("&", "&amp;"), out)
            self.assertIn(entry["credit"], out)
            self.assertIsNone(re.search(r"[　-〿一-鿿＀-￯]", out), entry["id"])
            if "image" in entry:
                self.assertIn(entry["license"], out)
                self.assertIn('<figure class="paper-fig', out)
            else:
                self.assertIn('<aside class="paper-fig-link"', out)
        with self.assertRaises(SystemExit):
            build.paper_figure_html("no-such-figure", page)


if __name__ == "__main__":
    unittest.main()
