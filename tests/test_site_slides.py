"""独立临时目录验证多比例入口与显式发布范围，不连接正式知识库。"""
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from site_slides import SlideRegistry, slides_markdown
from markdown_tools import markdown_tools


class SlideRegistryTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='site-slides-test-'))
        self.addCleanup(shutil.rmtree, self.root)
        self.source = 'slides/example/index.md'
        self.deck = self.root / self.source
        self.deck.parent.mkdir(parents=True)

    def write_deck(self, settings):
        self.deck.write_text('---\nmarp: true\ntitle: 临时演示\n' + settings + '\n---\n\n# 演示\n')

    def test_two_ratios_share_source_and_preserve_existing_default_url(self):
        self.write_deck('size: 16:9\nsizes: [16:9, 4:3]')
        hidden = self.root / 'slides/unpublished/index.md'
        hidden.parent.mkdir(parents=True)
        hidden.write_text('---\nmarp: true\ntitle: 未公开\n---\n')
        registry = SlideRegistry(self.root)
        slides = registry.resolve([self.source, self.source])
        self.assertEqual(len(slides), 1)
        self.assertEqual(list(registry.entries), [self.source])
        self.assertEqual(slides[0]['src'], '/slides/example/index.html')
        self.assertEqual(slides[0]['sources'], {
            '16:9': '/slides/example/index.html',
            '4:3': '/slides/example/index-4-3.html',
        })
        markdown = slides_markdown(slides)
        for ratio, url in slides[0]['sources'].items():
            self.assertIn(f'· {ratio}]({url})', markdown)
        self.assertNotIn('未公开', markdown)
        for origin in ['', 'https://shijin.space']:
            prepared = markdown_tools('prepare', [{'route': '/knowledge/example/', 'markdown': markdown}],
                                      origin=origin, routes={})[0]
            for url in slides[0]['sources'].values():
                self.assertIn(f']({origin}{url})', prepared)

    def test_single_ratio_remains_compatible_and_default_can_be_four_three(self):
        self.write_deck('size: 4:3')
        slide = SlideRegistry(self.root).resolve([self.source])[0]
        self.assertEqual(slide['size'], '4:3')
        self.assertNotIn('sources', slide)
        self.assertIn('[临时演示](/slides/example/index.html)', slides_markdown([slide]))
        self.write_deck('size: 4:3\nsizes: [16:9, 4:3]')
        slide = SlideRegistry(self.root).resolve([self.source])[0]
        self.assertEqual(list(slide['sources']), ['4:3', '16:9'])
        self.assertEqual(slide['sources']['4:3'], slide['src'])
        self.assertEqual(slide['sources']['16:9'], '/slides/example/index-16-9.html')

    def test_unsupported_ratio_is_rejected_before_publishing(self):
        self.write_deck('size: 16:9\nsizes: [16:9, 1:1]')
        with self.assertRaisesRegex(ValueError, 'sizes'):
            SlideRegistry(self.root).resolve([self.source])


if __name__ == '__main__':
    unittest.main()
