"""Numerical and documentation checks for foundation inputs and architectures."""

import ast
import itertools
import math
import os
from pathlib import Path
import re
import runpy
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True

import numpy as np

try:
    import torch
except ModuleNotFoundError as error:
    if error.name != "torch":
        raise
    torch = None


STAGE_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = Path(os.environ.get("AUDIT_REPO_ROOT", STAGE_ROOT))
CODE_ROOT = REPO_ROOT / "00-foundations/code"
DOC_NAMES = [
    name + suffix
    for name in ("tokenization", "embeddings-and-similarity", "vanilla-transformer", "decoder-only")
    for suffix in (".md", ".en.md")
]


def read_document(name):
    relative = Path("00-foundations/core") / name
    candidate = STAGE_ROOT / relative
    return (candidate if candidate.exists() else REPO_ROOT / relative).read_text()


class OptionalTorchImportTests(unittest.TestCase):
    def test_only_absent_torch_is_skipped(self):
        for filename in ("test_inputs_architecture_audit.py", "test_latent_paths.py",
                         "test_muon_dflash_examples.py"):
            source = Path(__file__).with_name(filename)
            tree = ast.parse(source.read_text())
            guard = next(node for node in tree.body if isinstance(node, ast.Try)
                         and any(isinstance(child, ast.Import)
                                 and any(alias.name == "torch" for alias in child.names)
                                 for child in node.body))
            code = compile(ast.Module(body=[guard], type_ignores=[]), str(source), "exec")
            with self.subTest(filename=filename, failure="absent torch"):
                namespace = {}
                with mock.patch("builtins.__import__",
                                side_effect=ModuleNotFoundError("absent", name="torch")):
                    exec(code, namespace)
                self.assertIsNone(namespace["torch"])
            for error in (ImportError("broken extension"),
                          ModuleNotFoundError("broken dependency", name="torch_dependency")):
                with self.subTest(filename=filename, failure=type(error).__name__):
                    with mock.patch("builtins.__import__", side_effect=error):
                        with self.assertRaises(type(error)):
                            exec(code, {})


class InputsAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.math_lab = runpy.run_path(str(CODE_ROOT / "multimodal_math.py"))
        cls.tokenizer_lab = runpy.run_path(str(CODE_ROOT / "tokenizer_from_scratch.py"))
        cls.attention_lab = runpy.run_path(str(CODE_ROOT / "sequence_numpy.py"))

    def test_dot_cosine_and_extreme_scales(self):
        dot = self.math_lab["dot"]
        cosine = self.math_lab["cosine"]
        self.assertEqual(dot([1, 0], [2, 2]), 2)
        self.assertAlmostEqual(cosine([1, 0], [2, 2]), 1 / math.sqrt(2))
        self.assertEqual(cosine([1, 0], [1, 0]), 1)
        for scale in (1e-200, 1.0, 1e200):
            self.assertAlmostEqual(cosine([scale, 0], [2 * scale, 2 * scale]), 1 / math.sqrt(2))
        with self.assertRaises(ValueError):
            cosine([0, 0], [1, 0])

    def test_softmax_invariance_and_temperature(self):
        log_softmax = self.math_lab["log_softmax"]
        scores = [0.8, 0.2, 0.1]
        original = np.exp(log_softmax(scores))
        shifted = np.exp(log_softmax([score + 100 for score in scores]))
        colder = np.exp(log_softmax([score / 0.1 for score in scores]))
        np.testing.assert_allclose(original, shifted, atol=1e-14)
        np.testing.assert_array_equal(original.argsort(), colder.argsort())
        self.assertGreater(colder.max(), original.max())
        self.assertLess(math.exp(log_softmax(scores + [0.8])[0]), original[0])
        loss = self.math_lab["contrastive_loss"]
        self.assertAlmostEqual(loss([[0, 0], [0, 0]]), math.log(2))

    def test_bpe_tie_and_lab_limits(self):
        tokenizer = self.tokenizer_lab["TinyBPE"]()
        tokenizer.train(["low", "lower"], num_merges=2)
        self.assertEqual(tokenizer.merge_rules, [("l", "o"), ("lo", "w")])
        self.assertEqual(tokenizer.decode_tokens(tokenizer.tokenize("low  lower")), "low lower")
        self.assertIn(tokenizer.token_to_id["<unk>"], tokenizer.encode("low☃"))

    def test_attention_rectangular_shapes(self):
        attention = self.attention_lab["scaled_dot_product_attention"]
        query = np.arange(6).reshape(3, 2) / 10
        key = np.arange(10).reshape(5, 2) / 10
        value = np.arange(20).reshape(5, 4) / 10
        output, weights = attention(query, key, value)
        self.assertEqual(weights.shape, (3, 5))
        self.assertEqual(output.shape, (3, 4))
        np.testing.assert_allclose(weights.sum(-1), 1)

    def test_causal_diagonal_and_single_head_cache_equivalence(self):
        attention = self.attention_lab["scaled_dot_product_attention"]
        generator = np.random.default_rng(17)
        query, key, value = [generator.normal(size=(5, 4)) for _ in range(3)]
        full, weights = attention(query, key, value, causal=True)
        np.testing.assert_array_equal(np.triu(weights, 1), np.zeros_like(weights))
        self.assertTrue(np.all(weights.diagonal() > 0))
        for position in range(len(query)):
            cached, _ = attention(query[position:position + 1], key[:position + 1], value[:position + 1])
            np.testing.assert_allclose(cached[0], full[position], atol=1e-14)
        changed = value.copy()
        changed[-1] += 1000
        changed_output, _ = attention(query, key, changed, causal=True)
        np.testing.assert_allclose(changed_output[:-1], full[:-1])

    def test_attention_scale_variance(self):
        width = 4
        vectors = list(itertools.product((-1.0, 1.0), repeat=width))
        scores = np.array([np.dot(query, key) for query in vectors for key in vectors])
        self.assertEqual(scores.var(), width)
        self.assertEqual((scores / math.sqrt(width)).var(), 1)

    def test_tied_queries_keys_are_psd_not_symmetric_softmax(self):
        query = np.array([[1.0, 0.0], [2.0, 1.0]])
        scores = query @ query.T
        np.testing.assert_array_equal(scores, scores.T)
        self.assertTrue(np.all(np.linalg.eigvalsh(scores) >= 0))
        weights = self.attention_lab["softmax"](scores)
        self.assertFalse(np.allclose(weights, weights.T))

    def test_rope_relative_rotation(self):
        def rotation(position):
            angle = position * 0.37
            return np.array([[math.cos(angle), -math.sin(angle)],
                             [math.sin(angle), math.cos(angle)]])

        query = np.array([0.2, -0.7])
        key = np.array([0.9, 0.3])
        rotated_score = (rotation(5) @ query) @ (rotation(2) @ key)
        self.assertAlmostEqual(rotated_score, query @ rotation(2 - 5) @ key)
        self.assertAlmostEqual(rotated_score, (rotation(20) @ query) @ (rotation(17) @ key))
        self.assertAlmostEqual(np.linalg.norm(rotation(5) @ query), np.linalg.norm(query))

    def test_multihead_projection_needs_concatenation(self):
        head_outputs = [np.ones((3, 2)) * head for head in range(4)]
        projection = np.ones((8, 8))
        self.assertEqual((np.concatenate(head_outputs, axis=-1) @ projection).shape, (3, 8))
        with self.assertRaises(ValueError):
            head_outputs[0] @ projection
        for name in ("decoder-only.md", "decoder-only.en.md"):
            self.assertIn(r"H=X_l+O_{\text{multi}}W_O", read_document(name))

    def test_documents_have_balanced_blocks_and_valid_examples(self):
        for name in DOC_NAMES:
            with self.subTest(document=name):
                document = read_document(name)
                self.assertEqual(sum(line.startswith("```") for line in document.splitlines()) % 2, 0)
                self.assertEqual(document.count("$$") % 2, 0)
                for tag in ("section", "details", "div"):
                    self.assertEqual(len(re.findall(r"<" + tag + r"\b", document)), document.count("</" + tag + ">"))
                for snippet in re.findall(r"```python\n(.*?)\n```", document, re.S):
                    ast.parse(snippet)

    def test_readout_snippet_bilingual_parity(self):
        snippets = [re.findall(r"```python\n(.*?)\n```", read_document(name), re.S)
                    for name in ("decoder-only.md", "decoder-only.en.md")]
        self.assertEqual(len(snippets[0]), 1)
        self.assertEqual(snippets[0], snippets[1])

    @unittest.skipIf(torch is None, "PyTorch is not installed; real tensor helper execution is unverified")
    def test_readout_snippet_with_real_torch(self):
        namespace = {}
        snippet = re.findall(r"```python\n(.*?)\n```", read_document("decoder-only.en.md"), re.S)[0]
        exec(compile(snippet, "decoder-only.en.md", "exec"), namespace)
        readout = namespace["last_valid_logits"]
        scores = torch.arange(30).reshape(2, 5, 3)
        for mask in (torch.zeros((2, 5)), torch.full((2, 5), 0.5)):
            with self.assertRaises(ValueError):
                readout(scores, mask)
        with self.assertRaises(ValueError):
            readout(scores, torch.ones((2, 4)))
        hole_mask = torch.tensor([[1, 0, 1, 0, 0], [0, 1, 0, 0, 1]])
        self.assertEqual(readout(scores, hole_mask).tolist(), [[6, 7, 8], [27, 28, 29]])


if __name__ == "__main__":
    unittest.main(verbosity=2)
