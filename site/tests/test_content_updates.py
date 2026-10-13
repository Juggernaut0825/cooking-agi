import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build
import prep_progress


class ContentUpdatesTests(unittest.TestCase):
    def test_state_and_reconciliation(self):
        subprocess.run(['node', '--test', str(build.ROOT / 'site/tests/prep-content-updates.test.cjs')], check=True)

    def test_learning_notes_have_explicit_revisions(self):
        with patch.dict(build.NAV), patch.dict(build.BY_SRC):
            navigation = build.load_nav()
            build.discover(navigation)
            catalog = prep_progress.catalog(build.BY_SRC)
            self.assertEqual(catalog['updatesVersion'], 1)
            for note in catalog['notes'].values():
                if prep_progress.content_topics(note['source']):
                    self.assertTrue(note['topics'])
                    self.assertGreaterEqual(note['update']['revision'], note['update']['introduced'])

    def test_missing_revision_and_untranslated_update_fail_build(self):
        source = '00-foundations/core/bert.md'
        identifier = prep_progress.identifier(source)
        pair = {'zh': type('Page', (), {'url': 'bert.html', 'title': 'BERT'})()}
        manifest = json.loads((prep_progress.SITE / 'content-updates.json').read_text())
        original = Path.read_text
        def read(path, *args, **kwargs):
            return json.dumps(manifest) if path.name == 'content-updates.json' else original(path, *args, **kwargs)
        with patch.object(Path, 'read_text', read):
            entry = manifest['notes'].pop(identifier)
            with self.assertRaisesRegex(ValueError, 'Register new learning content'):
                prep_progress.catalog({source: pair})
            manifest['edition'] = 2
            manifest['notes'][identifier] = {**entry, 'revision': 2}
            with self.assertRaisesRegex(ValueError, 'bilingual summary'):
                prep_progress.catalog({source: pair})
            manifest['notes'][identifier]['summary'] = {'zh': '新增数值例子。', 'en': 'Added a worked numerical example.'}
            self.assertEqual(prep_progress.catalog({source: pair})['notes'][identifier]['update']['revision'], 2)

    def test_topic_boundaries_do_not_follow_career_or_release_pages(self):
        for source in ['career/journey.md', 'community/updates.md', 'interview/dashboard.md', 'learn/README.md']:
            self.assertEqual(prep_progress.content_topics(source), [])
        self.assertIn('llm', prep_progress.content_topics('05-post-training/distillation.md'))
        self.assertEqual(prep_progress.content_topics('interview/algorithms/binary-search.md'), ['algorithms'])


if __name__ == '__main__':
    unittest.main()
