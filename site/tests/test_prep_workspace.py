from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'site'))
import build
import paritycheck
import prep_progress
import prep_workspace


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.elements = []
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        self.elements.append((tag, dict(attributes)))


class PrepWorkspaceTests(unittest.TestCase):
    def test_workspace_controller(self):
        subprocess.run(['node', '--test', str(ROOT / 'site/tests/prep-workspace.test.cjs')], check=True)

    def test_calendar_controller(self):
        subprocess.run(['node', '--test', str(ROOT / 'site/tests/prep-calendar.test.cjs')], check=True)

    def test_route_drafts(self):
        subprocess.run(['node', '--test', str(ROOT / 'site/tests/prep-route-planner.test.cjs')], check=True)

    def test_routes_have_bilingual_public_sources_and_reviewable_exercises(self):
        with patch.dict(build.NAV), patch.dict(build.BY_SRC):
            build.discover(build.load_nav())
            routes = prep_workspace.load_routes(build.BY_SRC)
            self.assertEqual(len(routes), 8)
            self.assertEqual({(route['topic'], route['level']) for route in routes},
                             {(topic, level) for topic in ('ml', 'post', 'systems', 'algorithms') for level in ('start', 'refresh')})
            self.assertEqual(sum(len(route['steps']) for route in routes), 24)
            with self.assertRaisesRegex(ValueError, 'Missing bilingual route source'):
                prep_workspace.load_routes({})

    def test_language_pair_and_app_shell(self):
        sources = [(ROOT / f'interview/dashboard{suffix}.md').read_text() for suffix in ('', '.en')]
        self.assertEqual(paritycheck.shape(sources[0]), paritycheck.shape(sources[1]))
        with patch.dict(build.NAV), patch.dict(build.BY_SRC):
            navigation = build.load_nav()
            pages, sections = build.discover(navigation)
            template = (ROOT / 'site/template.html').read_text()
            for language in ('zh', 'en'):
                page = build.BY_SRC['interview/dashboard.md'][language]
                build.build_page(page, [], navigation['site']['repo'], {item.url for item in pages})
                rendered = build.assemble(page, sections, [], navigation, 'test', template)
                elements = Markup(rendered).elements
                self.assertEqual(sum(tag == 'h1' for tag, _ in elements), 1)
                self.assertEqual(sum(tag == 'main' for tag, _ in elements), 1)
                identifiers = [attrs['id'] for _, attrs in elements if 'id' in attrs]
                self.assertEqual(len(identifiers), len(set(identifiers)))
                self.assertTrue({'overview', 'schedule', 'routes', 'progress', 'note-search'}.issubset(identifiers))
                panels = [attributes for _, attributes in elements if 'data-workspace-panel' in attributes]
                self.assertEqual(len(panels), 5)
                self.assertTrue(all('hidden' not in attributes for attributes in panels))
                self.assertEqual(sum('data-route-plan' in attributes for _, attributes in elements), 24)
                self.assertEqual(sum('data-route-batch' in attributes for _, attributes in elements), 8)
                self.assertEqual(sum('data-route-preview' in attributes for _, attributes in elements), 1)
                self.assertIn('static/prep-route-planner.js', rendered)
                self.assertNotIn('<div data-prep-routes></div>', rendered)
                self.assertNotIn('class="study-route"', rendered)
                self.assertIn('static/prep-calendar.js', rendered)
                self.assertNotIn('side', identifiers)
                self.assertNotIn('class="article-header"', rendered)
                self.assertNotIn('static/sky.js', rendered)
                self.assertNotIn('{{', rendered)
                self.assertNotIn('.md"', page.body)
                self.assertIn('page-prep-workspace', rendered)
                self.assertIn('data-language-switch', rendered)
                self.assertIn('data-search-open', rendered)
                brand = next(attrs for _, attrs in elements if attrs.get('class') == 'topbar-brand')
                self.assertTrue(brand.get('aria-label'))
                self.assertEqual(prep_progress.note_controls(page, ROOT), '')
                for source in ('interview/README.md', 'interview/study-plan.md'):
                    other = build.BY_SRC[source][language]
                    build.build_page(other, [], navigation['site']['repo'], {item.url for item in pages})
                    output = build.assemble(other, sections, [], navigation, 'test', template)
                    self.assertNotIn('static/prep-workspace.js', output)
                    self.assertNotIn('static/prep-schedule.js', output)
                    self.assertNotIn('data-schedule-form', output)

    def test_article_links_and_legacy_landing_anchors(self):
        with patch.dict(build.NAV), patch.dict(build.BY_SRC):
            build.discover(build.load_nav())
            for language, suffix in [('zh', ''), ('en', '.en')]:
                page = build.BY_SRC['interview/study-plan.md'][language]
                controls = prep_progress.note_controls(page, ROOT)
                identifier = prep_progress.identifier('interview/study-plan.md')
                self.assertIn(f'dashboard{suffix}.html#progress', controls)
                self.assertIn(f'dashboard{suffix}.html?note={identifier}#schedule', controls)
                landing = (ROOT / f'interview/README{suffix}.md').read_text()
                self.assertIn('id="schedule"', landing)
                self.assertIn('id="progress"', landing)
                self.assertIn(f'href="dashboard{suffix}.md"', landing)
                self.assertNotIn('data-prep-dashboard', landing)
                self.assertNotIn('data-prep-schedule', landing)


if __name__ == '__main__':
    unittest.main()
