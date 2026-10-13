from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'site'))
import build
import prep_schedule


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.elements = []
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        self.elements.append((tag, dict(attributes)))


class PrepScheduleTests(unittest.TestCase):
    def test_controller(self):
        subprocess.run(['node', '--test', str(ROOT / 'site/tests/prep-schedule-ui.test.cjs')], check=True)

    def test_bilingual_forms_share_contract(self):
        sources = [prep_schedule.planner(chinese) for chinese in (True, False)]
        shapes = []
        for source in sources:
            elements = Markup(source).elements
            shapes.append([(tag, attributes) for tag, attributes in elements if tag in {'input', 'select', 'fieldset'}])
            self.assertIn('data-schedule-summary', source)
            self.assertIn('noscript', source)
            self.assertEqual(len([tag for tag, _ in elements if tag == 'form']), 2)
            root = next(attributes for _, attributes in elements if 'data-prep-schedule' in attributes)
            self.assertIn('hidden', root)
        for shape in shapes:
            for tag, attributes in shape:
                attributes.pop('placeholder', None)
        self.assertEqual(*shapes)

    def test_build_only_mounts_planner_on_workspace_after_store(self):
        with patch.dict(build.NAV), patch.dict(build.BY_SRC):
            navigation = build.load_nav()
            pages, sections = build.discover(navigation)
            template = (ROOT / 'site/template.html').read_text()
            for language in ('zh', 'en'):
                page = build.BY_SRC['interview/dashboard.md'][language]
                build.build_page(page, [], navigation['site']['repo'], {item.url for item in pages})
                rendered = build.assemble(page, sections, [], navigation, 'test', template)
                self.assertIn('data-schedule-checkin', rendered)
                self.assertNotIn('<div data-prep-schedule></div>', rendered)
                self.assertLess(rendered.index('static/prep-progress.js'), rendered.index('static/prep-schedule.js'))
                self.assertLess(rendered.index('static/prep-schedule.js'), rendered.index('static/prep-workspace.js'))


if __name__ == '__main__':
    unittest.main()
