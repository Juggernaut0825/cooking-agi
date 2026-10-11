from html.parser import HTMLParser
import math
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / '00-foundations/model-families'


def programs(stem, suffix):
    return re.findall(r'```python\n(.*?)```', (FOLDER / (stem + suffix)).read_text(), re.S)


class Figure(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.language = None
        self.cards = 0
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        if tag == 'figure':
            self.language = dict(attributes).get('lang')
        elif tag == 'li':
            self.cards += 1


class GemmaFamilyExamples(unittest.TestCase):
    def test_bilingual_code_matches_and_executes(self):
        for stem in ('gemma', 'llama', 'how-to-read'):
            with self.subTest(stem=stem):
                self.assertEqual(programs(stem, '.md'), programs(stem, '.en.md'))
                for suffix in ('.md', '.en.md'):
                    for program in programs(stem, suffix):
                        exec(compile(program, stem + suffix, 'exec'), {})

    def test_mixed_cache_against_explicit_position_storage(self):
        namespace = {}
        exec(programs('gemma', '.md')[0], namespace)
        calculate = namespace['mixed_cache_mib']
        for tokens in (0, 1, 2, 4, 5, 7, 32, 1023, 1024, 1025):
            for window in (1, 3, 5, 1024):
                for local_layers, global_layers in ((0, 6), (5, 1), (6, 0), (1, 1)):
                    with self.subTest(tokens=tokens, window=window, layers=(local_layers, global_layers)):
                        history = list(range(tokens))
                        local_positions = history[-window:]
                        cached = [list(local_positions) for _ in range(local_layers)]
                        cached.extend([list(history) for _ in range(global_layers)])
                        expected = sum(len(layer) for layer in cached) * 4096 / (1024 ** 2)
                        self.assertEqual(calculate(tokens, local_layers, global_layers, window), expected)

    def test_short_and_long_context_cache_growth(self):
        namespace = {}
        exec(programs('gemma', '.md')[0], namespace)
        calculate = namespace['mixed_cache_mib']
        self.assertEqual(calculate(512), calculate(512, 0, 6))
        self.assertEqual(calculate(131072), 532)
        self.assertEqual(calculate(2048) - calculate(1024), 4)
        self.assertEqual(calculate(512) - calculate(0), 12)

    def test_local_receptive_field_is_a_path_not_full_history(self):
        reached = [{position} for position in range(8)]
        snapshots = []
        for _ in range(2):
            reached = [set().union(*reached[max(0, position - 2):position + 1])
                       for position in range(8)]
            snapshots.append(reached[-1])
        self.assertEqual(snapshots[0], {5, 6, 7})
        self.assertEqual(snapshots[1], {3, 4, 5, 6, 7})
        self.assertNotIn(0, snapshots[1])
        self.assertEqual(set().union(*reached), set(range(8)))

    def test_cache_figures_are_localized_and_have_three_cards(self):
        for suffix, language in (('.md', 'zh-CN'), ('.en.md', 'en')):
            source = (FOLDER / ('gemma' + suffix)).read_text()
            markup = re.search(r'<figure[^>]+id="gemma-cache-trace".*?</figure>', source, re.S).group()
            figure = Figure(markup)
            self.assertEqual(figure.language, language)
            self.assertEqual(figure.cards, 3)
            for value in ('768 MiB', '148 MiB', '532 MiB'):
                self.assertIn(value, markup)

    def test_original_chinese_section_ids_are_explicit(self):
        source = (FOLDER / 'gemma.md').read_text()
        for identifier in range(1, 8):
            self.assertEqual(source.count('{#_' + str(identifier) + '}'), 1)

    def test_family_diagram_cards_are_localized(self):
        figures = {
            'llama': {'llama-block-flow': 3, 'llama-training-loop': 3},
            'qwen': {'qwen-compute-choices': 3},
            'deepseek': {'deepseek-architecture': 3, 'deepseek-training-routes': 2},
            'deepseek-v4': {'v4-history-paths': 2},
        }
        for stem, expected in figures.items():
            for suffix, language in (('.md', 'zh-CN'), ('.en.md', 'en')):
                source = (FOLDER / (stem + suffix)).read_text()
                for identifier, count in expected.items():
                    with self.subTest(page=stem + suffix, figure=identifier):
                        matches = re.findall(r'<figure[^>]+id="' + identifier + r'".*?</figure>', source, re.S)
                        self.assertEqual(len(matches), 1)
                        figure = Figure(matches[0])
                        self.assertEqual(figure.language, language)
                        self.assertEqual(figure.cards, count)

    def test_cache_derivation_renders_as_paragraphs(self):
        import markdown

        for suffix in ('.md', '.en.md'):
            source = (FOLDER / ('gemma' + suffix)).read_text()
            rendered = markdown.markdown(source, extensions=['md_in_html', 'fenced_code'])
            self.assertRegex(rendered, r'</summary>\s*<p>')
            self.assertNotRegex(rendered, r'</summary>\s*[^<\s]')

    def test_llama_dpo_counterexample(self):
        initial_delta = math.log(0.1 / 0.1) - math.log(0.1 / 0.1)
        updated_delta = math.log(0.08 / 0.1) - math.log(0.02 / 0.1)
        initial_loss = math.log1p(math.exp(-initial_delta))
        updated_loss = math.log1p(math.exp(-updated_delta))
        self.assertAlmostEqual(initial_loss, 0.6931, places=4)
        self.assertAlmostEqual(updated_loss, 0.2231, places=4)
        self.assertLess(updated_loss, initial_loss)
        self.assertLess(0.08, 0.1)


if __name__ == '__main__':
    unittest.main()
