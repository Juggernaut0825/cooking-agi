from pathlib import Path
import shutil
import subprocess
import unittest


SITE = Path(__file__).resolve().parents[1]


class FragmentNavigationTests(unittest.TestCase):
    def test_armed_before_page_content_and_waits_for_both_renderers(self):
        template = (SITE / 'template.html').read_text()
        self.assertLess(template.index('static/fragment-navigation.js'), template.index('<body'))
        app = (SITE / 'static/app.js').read_text()
        self.assertIn('window.NoteFragments.settle(Promise.all([mathLayout, diagramLayout]))', app)

    @unittest.skipUnless(shutil.which('node'), 'Node is required for navigation behavior tests')
    def test_fragment_navigation_behavior(self):
        result = subprocess.run([shutil.which('node'), '--test', str(SITE / 'tests/fragment-navigation.test.cjs')],
                                text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
