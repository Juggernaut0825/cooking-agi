from html.parser import HTMLParser
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


class Figures(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.figures = {}
        self.current = None
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == "figure":
            self.current = {"attributes": attributes, "steps": 0, "captions": 0, "text": []}
            self.figures[attributes.get("id")] = self.current
        if self.current is not None:
            self.current["steps"] += tag == "li"
            self.current["captions"] += tag == "figcaption"

    def handle_endtag(self, tag):
        if tag == "figure":
            self.current = None

    def handle_data(self, data):
        if self.current is not None:
            self.current["text"].append(data)


class SystemNoteFiguresTests(unittest.TestCase):
    def test_localized_responsive_steps(self):
        for suffix, language in (("", "zh-CN"), (".en", "en")):
            with self.subTest(language=language):
                source = (ROOT / f"06-systems/README{suffix}.md").read_text()
                figures = Figures(source).figures
                for identifier, count in (("travel-request-flow", 3), ("action-control-flow", 6)):
                    figure = figures[identifier]
                    self.assertEqual(figure["steps"], count)
                    self.assertEqual(figure["captions"], 1)
                    self.assertEqual(figure["attributes"]["lang"], language)
                    self.assertIn("worked-update", figure["attributes"]["class"].split())
                    self.assertTrue("".join(figure["text"]).strip())
                self.assertNotIn("```mermaid", source)

    def test_control_branches_remain_visible_in_both_languages(self):
        expected = {
            "": ("回第 1 步", "拒绝或确认超时", "版本条件或原子操作", "成功或失败"),
            ".en": ("return to step 1", "Rejection or an expired confirmation", "version conditions or atomic operations", "neither success nor failure"),
        }
        for suffix, phrases in expected.items():
            source = (ROOT / f"06-systems/README{suffix}.md").read_text()
            text = "".join(Figures(source).figures["action-control-flow"]["text"])
            for phrase in phrases:
                with self.subTest(language=suffix, phrase=phrase):
                    self.assertIn(phrase, text)


if __name__ == "__main__":
    unittest.main()
