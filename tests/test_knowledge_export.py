"""只在 mkdtemp 创建的独立知识库中验证导出；不启动 Basic Memory。"""
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from export_knowledge import export
from finalize_markdown import finalize


class KnowledgeExportTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='pkw-rspress-test-'))
        self.vault = self.root / 'vault'
        self.vault.mkdir()
        (self.root / 'state').mkdir()  # Basic Memory 配置和数据库与正式库隔离。
        self.out = self.root / 'export'
        self.manifest = self.root / 'publish.json'
        (self.vault / '甲.md').write_text('''---
title: 甲
private_metadata: PRIVATE_METADATA_SENTINEL
---
# 甲

## 定义
公式 $x^2$。[[乙#基本区域|去乙页]]，[[未公开|待补资料]]。
![示意图](图.svg)
%%HIDDEN_COMMENT_SENTINEL%%

$$
x
=
y
$$

```markdown
[[未公开]] 与 $literal$ 均保持代码原样。
```

`$inline_literal$`
''', encoding='utf-8')
        (self.vault / '乙.md').write_text('# 乙\n\n## 基本区域\n回到 [[甲|前置定义]]。\n', encoding='utf-8')
        (self.vault / '未公开.md').write_text('UNPUBLISHED_BODY_SENTINEL\n', encoding='utf-8')
        (self.vault / '图.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
        self.spec = {
            'categories': [{'id': 'math', 'title': '数学领域', 'overview': 'alpha'}],
            'notes': [{'path': '甲.md', 'slug': 'alpha', 'category': 'math', 'group': '概览'},
                      {'path': '乙.md', 'slug': 'beta', 'category': 'math',
                       'group': '基础知识', 'chapter': '几何基础'}],
            'attachments': ['图.svg'],
        }

    def tearDown(self):
        shutil.rmtree(self.root)

    def run_export(self, spec=None):
        self.manifest.write_text(json.dumps(self.spec if spec is None else spec))
        return export(self.vault, self.manifest, self.out)

    def test_public_boundary_links_backlinks_and_math(self):
        report = self.run_export()
        rendered = (self.out / 'docs/knowledge/alpha/index.md').read_text()
        raw = (self.out / 'docs/public/knowledge/raw/alpha.md').read_text()
        index = json.loads((self.out / 'docs/public/knowledge/index.json').read_text())
        all_text = '\n'.join(p.read_text() for p in self.out.rglob('*') if p.is_file())
        for marker in ['PRIVATE_METADATA_SENTINEL', 'HIDDEN_COMMENT_SENTINEL', 'UNPUBLISHED_BODY_SENTINEL']:
            self.assertNotIn(marker, all_text)
        self.assertIn('/knowledge/beta/#%E5%9F%BA%E6%9C%AC%E5%8C%BA%E5%9F%9F', rendered)
        self.assertIn('引用此笔记', rendered)
        self.assertIn('待补资料', rendered)
        self.assertIn('$x^2$', rendered)
        self.assertIn('$$\nx\n=\ny\n$$', rendered)
        self.assertIn('[[未公开]] 与 $literal$', rendered)
        self.assertIn('`$inline_literal$`', rendered)
        self.assertIn('## 基本区域 {#基本区域}',
                      (self.out / 'docs/knowledge/beta/index.md').read_text())
        self.assertIn('$x^2$', raw)
        self.assertEqual(index['notes'][0]['backlinks'], ['beta'])
        self.assertEqual((report['notes'], report['attachments'], report['links']), (2, 1, 2))

    def test_native_navigation_and_overview_follow_manifest(self):
        self.run_export()
        config = json.loads((self.out / 'theme-config.json').read_text())
        overview = (self.out / 'docs/knowledge/math/index.mdx').read_text()
        self.assertIn('OverviewGroup', overview)
        self.assertIn('基础知识 · 几何基础', overview)
        self.assertIn('/knowledge/alpha/', overview)
        self.assertIn('几何基础', json.dumps(config, ensure_ascii=False))
        self.assertEqual(config['nav'][0]['items'][0]['link'], '/knowledge/math/')

    def test_manifest_removal_cleans_pages_assets_and_navigation(self):
        self.run_export()
        self.run_export({'notes': [{'path': '乙.md', 'slug': 'beta'}]})
        self.assertFalse((self.out / 'docs/knowledge/alpha').exists())
        self.assertFalse((self.out / 'docs/knowledge/math').exists())
        self.assertFalse((self.out / 'docs/public/knowledge/raw/alpha.md').exists())
        self.assertFalse((self.out / 'docs/public/knowledge/attachments').exists())
        index = json.loads((self.out / 'docs/public/knowledge/index.json').read_text())
        self.assertEqual([n['id'] for n in index['notes']], ['beta'])

    def test_unapproved_attachment_stops_export(self):
        self.spec['attachments'] = []
        with self.assertRaisesRegex(ValueError, '附件'):
            self.run_export()

    def test_note_embeds_and_block_links_stop_export(self):
        for link in ['![[乙]]', '[[乙#^block]]']:
            (self.vault / '甲.md').write_text('# 甲\n\n' + link, encoding='utf-8')
            with self.subTest(link=link), self.assertRaises(ValueError):
                self.run_export()

    def test_category_url_collision_and_unpublished_overview_are_rejected(self):
        self.spec['categories'][0]['id'] = 'alpha'
        with self.assertRaisesRegex(ValueError, '重复网址'):
            self.run_export()
        self.spec['categories'][0] = {'id': 'math', 'title': '数学', 'overview': 'unpublished'}
        with self.assertRaisesRegex(ValueError, '公开清单'):
            self.run_export()

    def test_output_cannot_overwrite_existing_content_or_vault(self):
        self.out.mkdir()
        (self.out / 'keep.txt').write_text('keep')
        with self.assertRaisesRegex(ValueError, '已有其他文件'):
            self.run_export()
        self.assertEqual((self.out / 'keep.txt').read_text(), 'keep')
        self.manifest.write_text(json.dumps(self.spec))
        with self.assertRaisesRegex(ValueError, '知识库内'):
            export(self.vault, self.manifest, self.vault / 'output')

    def test_ssg_markdown_and_full_text_preserve_source_formulas(self):
        self.run_export()
        built = self.root / 'built'
        shutil.copytree(self.out / 'docs/public', built)
        for slug in ['alpha', 'beta']:
            folder = built / 'knowledge' / slug
            folder.mkdir()
            (folder / 'index.md').write_text('DAMAGED_MATH_SENTINEL')
        (built / 'llms.txt').write_text(
            '# 测试站\n\n- [甲](/knowledge/alpha/index.md)\n- [乙](/knowledge/beta/index.md)\n')
        report = finalize(built)
        self.assertEqual(report, {'markdown_pages': 2, 'llms_pages': 2})
        self.assertEqual((built / 'knowledge/alpha/index.md').read_bytes(),
                         (built / 'knowledge/raw/alpha.md').read_bytes())
        full = (built / 'llms-full.txt').read_text()
        self.assertIn('$$\nx\n=\ny\n$$', full)
        self.assertIn('$x^2$', full)
        self.assertNotIn('DAMAGED_MATH_SENTINEL', full)
        self.assertNotIn('PRIVATE_METADATA_SENTINEL', full)

    def test_published_markdown_index_uses_same_origin_absolute_links(self):
        self.run_export()
        built = self.root / 'built'
        shutil.copytree(self.out / 'docs/public', built)
        for slug in ['alpha', 'beta']:
            (built / 'knowledge' / slug).mkdir()
        (built / 'llms.txt').write_text(
            '- [甲](https://shijin.space/knowledge/alpha/index.md)\n'
            '- [乙](https://shijin.space/knowledge/beta/index.md)\n'
            '- [外部资料](https://example.com/external.md)\n')
        report = finalize(built, 'https://shijin.space')
        self.assertEqual(report['llms_pages'], 2)
        full = (built / 'llms-full.txt').read_text()
        self.assertIn('$$\nx\n=\ny\n$$', full)
        self.assertIn('$x^2$', full)


if __name__ == '__main__':
    unittest.main()
