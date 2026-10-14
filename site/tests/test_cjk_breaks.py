from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build


class CjkLineBreakTests(unittest.TestCase):
    def test_breaks_between_chinese_characters_are_joined(self):
        body, _ = build.render_markdown("能力是否\n退化，要看\n“基线”是否\n固定。\n")
        self.assertIn("<p>能力是否退化，要看“基线”是否固定。</p>", body)

    def test_list_continuation_lines_are_joined(self):
        body, _ = build.render_markdown("- 第一项写得\n  很长\n- 第二项\n")
        self.assertIn("<li>第一项写得很长</li>", body)

    def test_breaks_next_to_latin_text_stay_spaces(self):
        body, _ = build.render_markdown("这里用\nTransformer 举例，\nKV cache\n也一样。\n\nplain\nEnglish text\n")
        self.assertIn("这里用\nTransformer 举例，\nKV cache\n也一样。", body)
        self.assertIn("plain\nEnglish text", body)

    def test_code_math_and_diagrams_are_untouched(self):
        source = "```python\n# 第一行\n# 第二行\n```\n\n行内 `代码\n换行` 不变\n\n$$\\text{上}\n\\text{下}$$\n"
        body, _ = build.render_markdown(source)
        self.assertIn("# 第一行</span>\n<span", body)
        self.assertIn("代码\n换行", body)
        self.assertIn("\\text{上}\n\\text{下}", body)
        self.assertEqual(build.join_cjk_breaks('<pre class="mermaid">\nA["甲"]\n乙\n</pre>'),
                         '<pre class="mermaid">\nA["甲"]\n乙\n</pre>')


if __name__ == "__main__":
    unittest.main()
