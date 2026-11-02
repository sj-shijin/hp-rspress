import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from urllib.parse import quote
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from finalize_sitemap import finalize_sitemap

NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'


class SitemapTests(unittest.TestCase):
    def setUp(self):
        self.output = Path(tempfile.mkdtemp())
        (self.output / 'knowledge').mkdir()

    def tearDown(self):
        shutil.rmtree(self.output)

    def sitemap(self, origin, routes, aliases):
        index = {'notes': [{'aliases': aliases}, {'id': 'ordinary-note'}]}
        (self.output / 'knowledge/index.json').write_text(json.dumps(index), encoding='utf-8')
        root = ET.Element(f'{{{NS}}}urlset')
        for route in routes:
            page = ET.SubElement(root, f'{{{NS}}}url')
            ET.SubElement(page, f'{{{NS}}}loc').text = origin + quote(route, safe='/')
            ET.SubElement(page, f'{{{NS}}}lastmod').text = '2026-11-02T11:45:12Z'
            ET.SubElement(page, f'{{{NS}}}priority').text = '0.7'
        ET.ElementTree(root).write(self.output / 'sitemap.xml', encoding='utf-8', xml_declaration=True)

    def test_excludes_only_declared_aliases_and_404_for_both_origins(self):
        aliases = ['/knowledge/old/', '/knowledge/旧入口/']
        kept = ['/', '/knowledge/math/', '/knowledge/old/child/']
        legacy = self.output / 'knowledge/old'
        legacy.mkdir()
        for name in ['index.html', 'index.md']:
            (legacy / name).write_text('兼容入口', encoding='utf-8')
        for origin in ['http://127.0.0.1:1320', 'https://shijin.space']:
            with self.subTest(origin=origin):
                self.sitemap(origin, kept + aliases + ['/404.html'], aliases)
                index = (self.output / 'knowledge/index.json').read_bytes()
                report = finalize_sitemap(self.output)
                self.assertEqual(report, {'sitemap_pages': 3, 'excluded_pages': 3})
                pages = ET.parse(self.output / 'sitemap.xml').getroot().findall(f'{{{NS}}}url')
                self.assertEqual([page.findtext(f'{{{NS}}}loc') for page in pages],
                                 [origin + route for route in kept])
                self.assertTrue(all(page.findtext(f'{{{NS}}}priority') == '0.7' and
                                    page.findtext(f'{{{NS}}}lastmod') == '2026-11-02T11:45:12Z'
                                    for page in pages))
                self.assertEqual((self.output / 'knowledge/index.json').read_bytes(), index)
                for name in ['index.html', 'index.md']:
                    self.assertEqual((legacy / name).read_text(encoding='utf-8'), '兼容入口')

    def test_no_aliases_preserve_entries_and_repeated_run_is_stable(self):
        self.sitemap('https://shijin.space', ['/', '/knowledge/math/'], [])
        expected = {'sitemap_pages': 2, 'excluded_pages': 0}
        self.assertEqual(finalize_sitemap(self.output), expected)
        first = (self.output / 'sitemap.xml').read_bytes()
        self.assertEqual(finalize_sitemap(self.output), expected)
        self.assertEqual((self.output / 'sitemap.xml').read_bytes(), first)
