import contextlib
import io
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


class InfraIntroductionTests(unittest.TestCase):
    def test_attention_example_is_identical_and_executable_in_both_languages(self):
        examples = []
        for suffix in ("", ".en"):
            source = (ROOT / f"12-infra/README{suffix}.md").read_text()
            examples.append(re.findall(r"```python\n(.*?)```", source, re.S)[0])
        self.assertEqual(examples[0], examples[1])
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            exec(compile(examples[0], "<infra-introduction>", "exec"), {})
        self.assertEqual(output.getvalue().splitlines(), ["2000: 3.3%", "20000: 32.8%"])

    def test_causal_pair_count_includes_both_attention_products(self):
        for prompt_tokens in (1, 2, 5):
            layers, hidden_size = 2, 8
            explicit = sum(4 * layers * hidden_size * (position + 1)
                           for position in range(prompt_tokens))
            triangular = 4 * layers * hidden_size * prompt_tokens * (prompt_tokens + 1) // 2
            self.assertEqual(explicit, triangular)


if __name__ == "__main__":
    unittest.main()
