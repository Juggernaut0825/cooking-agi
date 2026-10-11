import contextlib
import importlib.util
import io
import math
from pathlib import Path
import re
import sys
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]


class RecurrentArticleTests(unittest.TestCase):
    def test_lstm_gate_arithmetic(self):
        retained = 0.9 * 0.8
        written = 0.2 * -0.5
        cell = retained + written
        self.assertAlmostEqual(cell, 0.62)
        self.assertAlmostEqual(0.5 * math.tanh(cell), 0.276, places=3)

    def test_attention_is_a_weighted_mixture(self):
        states = ((1.0, 0.0), (0.0, 1.0), (1.0, 1.0))
        for weights, expected in (((0.1, 0.7, 0.2), (0.3, 0.9)),
                                  ((0.6, 0.1, 0.3), (0.9, 0.4))):
            with self.subTest(weights=weights):
                actual = [sum(weight * state[axis] for weight, state in zip(weights, states))
                          for axis in range(2)]
                for observed, target in zip(actual, expected):
                    self.assertAlmostEqual(observed, target)

    def test_worked_figures_use_the_page_language(self):
        for stem, identifier in (('core/recurrent-models', 'gate-trace'),
                                 ('deep-dives/recurrent-dynamics', 'truncated-trace')):
            for suffix, language in (('.md', 'zh-CN'), ('.en.md', 'en')):
                with self.subTest(stem=stem, language=language):
                    source = (ROOT / f'00-foundations/{stem}{suffix}').read_text()
                    figure = re.search(r'<figure[^>]+id="' + identifier + r'"[^>]*>', source)
                    self.assertIsNotNone(figure)
                    self.assertIn(f'lang="{language}"', figure.group())

    def test_bilingual_truncation_code_matches(self):
        snippets = []
        for suffix in ('.md', '.en.md'):
            source = (ROOT / f'00-foundations/deep-dives/recurrent-dynamics{suffix}').read_text()
            snippets.append(next(block for block in re.findall(r'```python\n(.*?)```', source, re.S)
                                 if 'def recurrence_gradient' in block))
        self.assertEqual(*snippets)

    def test_seq2seq_flow_remains_readable_and_localized(self):
        for suffix, label in (('.md', '输入 token'), ('.en.md', 'source tokens')):
            with self.subTest(language=suffix):
                source = (ROOT / f'00-foundations/core/seq2seq{suffix}').read_text()
                diagram = re.search(r'```mermaid\n(.*?)```', source, re.S).group(1)
                self.assertIn('flowchart TB', diagram)
                self.assertIn(label, diagram)


@unittest.skipUnless(importlib.util.find_spec('torch'), 'PyTorch is needed for recurrent examples')
class RecurrentNumericalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        cls.torch = torch
        specification = importlib.util.spec_from_file_location(
            'audited_sequence_torch', ROOT / '00-foundations/code/sequence_torch.py')
        cls.sequence = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(cls.sequence)

    def test_published_truncation_example(self):
        for suffix in ('.md', '.en.md'):
            with self.subTest(language=suffix):
                source = (ROOT / f'00-foundations/deep-dives/recurrent-dynamics{suffix}').read_text()
                program = next(block for block in re.findall(r'```python\n(.*?)```', source, re.S)
                               if 'def recurrence_gradient' in block)
                namespace = {}
                exec(compile(program, str(ROOT / '00-foundations/deep-dives/recurrent-dynamics'), 'exec'),
                     namespace)
                self.assertEqual(namespace['recurrence_gradient'](False), (0.125, 0.0078125, 0.09375))
                self.assertEqual(namespace['recurrence_gradient'](True), (0.125, 0.0078125, 0.03125))

    def test_recurrent_jacobians_multiply_in_time_order(self):
        torch = self.torch
        weight = torch.tensor([[0.4, -0.7], [0.2, 0.5]], dtype=torch.float64)
        initial = torch.tensor([0.3, -0.2], dtype=torch.float64)
        first_input = torch.tensor([0.1, 0.4], dtype=torch.float64)
        second_input = torch.tensor([-0.5, 0.2], dtype=torch.float64)
        first = torch.tanh(weight @ initial + first_input)
        second = torch.tanh(weight @ first + second_input)
        first_jacobian = torch.diag(1 - first.square()) @ weight
        second_jacobian = torch.diag(1 - second.square()) @ weight
        actual = torch.autograd.functional.jacobian(
            lambda state: torch.tanh(weight @ torch.tanh(weight @ state + first_input) + second_input),
            initial)
        torch.testing.assert_close(actual, second_jacobian @ first_jacobian)
        self.assertFalse(torch.allclose(actual, first_jacobian @ second_jacobian))

    def test_shared_weight_gradient_sums_direct_uses(self):
        torch = self.torch
        weight = torch.tensor([[0.4, -0.7], [0.2, 0.5]], dtype=torch.float64, requires_grad=True)
        hidden = torch.tensor([0.3, -0.2], dtype=torch.float64)
        history = []
        for current_input in ([0.1, 0.4], [-0.5, 0.2], [0.2, 0.1]):
            activation = weight @ hidden + torch.tensor(current_input, dtype=torch.float64)
            activation.retain_grad()
            history.append((hidden, activation))
            hidden = activation.tanh()
        hidden.square().sum().backward()
        expected = sum(torch.outer(activation.grad, previous.detach())
                       for previous, activation in history)
        torch.testing.assert_close(weight.grad, expected)

    def test_manual_rnn_matches_pytorch_cell(self):
        torch = self.torch
        torch.manual_seed(19)
        manual = self.sequence.RNNCell(3, 4).double()
        reference = torch.nn.RNNCell(3, 4).double()
        with torch.no_grad():
            reference.weight_ih.copy_(manual.input_projection.weight)
            reference.weight_hh.copy_(manual.hidden_projection.weight)
            reference.bias_ih.zero_()
            reference.bias_hh.copy_(manual.hidden_projection.bias)
        current_input = torch.randn(2, 3, dtype=torch.float64)
        hidden = torch.randn(2, 4, dtype=torch.float64)
        torch.testing.assert_close(manual(current_input, hidden), reference(current_input, hidden))

    def test_manual_lstm_matches_pytorch_gate_order(self):
        torch = self.torch
        torch.manual_seed(23)
        manual = self.sequence.LSTMCell(3, 4).double()
        reference = torch.nn.LSTMCell(3, 4).double()
        reorder = torch.tensor([4, 5, 6, 7, 0, 1, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15])
        with torch.no_grad():
            reference.weight_ih.copy_(manual.gates.weight[reorder, :3])
            reference.weight_hh.copy_(manual.gates.weight[reorder, 3:])
            reference.bias_ih.copy_(manual.gates.bias[reorder])
            reference.bias_hh.zero_()
        current_input = torch.randn(2, 3, dtype=torch.float64)
        state = (torch.randn(2, 4, dtype=torch.float64), torch.randn(2, 4, dtype=torch.float64))
        actual = manual(current_input, state)
        expected = reference(current_input, state)
        for observed, target in zip(actual, expected):
            torch.testing.assert_close(observed, target)

    def test_delay_alignment(self):
        torch = self.torch
        tokens = torch.tensor([[3, 8, 2, 5, 1]])
        targets = tokens[:, :-2]
        self.assertEqual(targets.tolist(), [[3, 8, 2]])
        for kind in ('rnn', 'lstm'):
            with self.subTest(kind=kind):
                model = self.sequence.DelayCopyModel(kind, vocab_size=10, width=8)
                logits = model(tokens)[:, 2:]
                self.assertEqual(logits.shape[:2], targets.shape)
                loss = torch.nn.functional.cross_entropy(logits.reshape(-1, 10), targets.reshape(-1))
                loss.backward()
                self.assertTrue(torch.isfinite(loss))
                self.assertTrue(all(parameter.grad is not None and torch.isfinite(parameter.grad).all()
                                    for parameter in model.parameters()))

    def test_generation_encodes_once_and_runs_for_source_length(self):
        torch = self.torch
        source = torch.tensor([[3, 8, 2, 5]])
        for kind in ('rnn', 'lstm'):
            with self.subTest(kind=kind):
                model = self.sequence.Seq2SeqModel(kind, vocab_size=10, width=8)
                with mock.patch.object(model.encoder.cell, 'forward', wraps=model.encoder.cell.forward) as encode:
                    with mock.patch.object(model.decoder.cell, 'forward', wraps=model.decoder.cell.forward) as decode:
                        generated = model.generate(source, bos_id=1)
                self.assertEqual(generated.shape, source.shape)
                self.assertEqual(encode.call_count, 4)
                self.assertEqual(decode.call_count, 4)

    def test_delay_training_rejects_invalid_ranges(self):
        for delay, length in ((0, 4), (-1, 4), (4, 4), (5, 4)):
            with self.subTest(delay=delay, length=length):
                with self.assertRaisesRegex(ValueError, '0 < delay < sequence_length'):
                    self.sequence.train_delay('rnn', 1, delay, length)

    def test_cli_rejects_invalid_experiments(self):
        for arguments in (['--steps', '0'], ['--steps', '-1'],
                          ['--task', 'delay', '--delay', '0'],
                          ['--task', 'delay', '--delay', '8', '--length', '8']):
            with self.subTest(arguments=arguments):
                with mock.patch.object(sys, 'argv', ['sequence_torch.py', *arguments]):
                    with contextlib.redirect_stderr(io.StringIO()):
                        with self.assertRaises(SystemExit) as error:
                            self.sequence.main()
                self.assertEqual(error.exception.code, 2)

    def test_documented_long_delay_runs_one_finite_training_step(self):
        for kind in ('rnn', 'lstm'):
            with self.subTest(kind=kind):
                output = io.StringIO()
                arguments = ['sequence_torch.py', '--task', 'delay', '--model', kind,
                             '--steps', '1', '--delay', '64', '--length', '96']
                with mock.patch.object(sys, 'argv', arguments), contextlib.redirect_stdout(output):
                    self.sequence.main()
                self.assertRegex(output.getvalue(), r'loss=\d+\.\d+ train_accuracy=\d+\.\d+')

    def test_reverse_metric_is_not_labelled_as_heldout(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.sequence.train_reverse('lstm', 1)
        self.assertIn('same_batch_greedy_accuracy=', output.getvalue())


if __name__ == '__main__':
    unittest.main()
