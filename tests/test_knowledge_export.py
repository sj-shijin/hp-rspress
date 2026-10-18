"""只在 mkdtemp 创建的独立知识库中验证导出；不启动 Basic Memory。"""
import json
import re
import subprocess
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
        self.site = self.root / 'site'
        shutil.copytree(Path(__file__).resolve().parents[1] / 'site', self.site)
        self.out = self.root / 'export'
        self.manifest = self.root / 'publish.json'
        (self.vault / '甲.md').write_text('''---
title: 甲
private_metadata: PRIVATE_METADATA_SENTINEL
description: PRIVATE_METADATA_SENTINEL
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
            'categories': [{'id': 'math', 'title': '数学领域', 'overview': 'alpha',
                            'description': '数学领域的阅读入口。'}],
            'notes': [{'path': '甲.md', 'slug': 'alpha', 'category': 'math', 'group': '概览',
                       'description': '甲的定义与公式。'},
                      {'path': '乙.md', 'slug': 'beta', 'category': 'math',
                       'group': '基础知识', 'chapter': '几何基础',
                       'description': '乙的基本区域与前置联系。'}],
            'attachments': ['图.svg'],
        }

    def tearDown(self):
        shutil.rmtree(self.root)

    def run_export(self, spec=None):
        self.manifest.write_text(json.dumps(self.spec if spec is None else spec))
        return export(self.vault, self.manifest, self.out, site_source=self.site)

    def test_public_boundary_links_backlinks_and_math(self):
        report = self.run_export()
        rendered = (self.out / 'docs/knowledge/math/index.md').read_text()
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
        self.assertEqual(index['notes'][0]['description'], '甲的定义与公式。')
        self.assertIn('description: 甲的定义与公式。', rendered)
        self.assertEqual((report['notes'], report['attachments'], report['links']), (2, 1, 2))

    def test_native_navigation_and_overview_follow_manifest(self):
        self.run_export()
        config = json.loads((self.out / 'theme-config.json').read_text())
        overview = (self.out / 'docs/knowledge/math/index.md').read_text()
        self.assertIn('## 定义', overview)
        self.assertNotIn('OverviewGroup', overview)
        self.assertFalse((self.out / 'docs/knowledge/math/index.mdx').exists())
        self.assertIn('几何基础', json.dumps(config, ensure_ascii=False))
        self.assertEqual(config['nav'][0]['items'][0]['link'], '/knowledge/math/')
        self.assertEqual(config['sidebar']['/knowledge/'][0]['items'][0],
                         {'text': '概览与阅读路线', 'link': '/knowledge/math/'})
        self.assertNotIn('/knowledge/alpha/', json.dumps(config))

    def test_overview_keeps_identity_and_redirects_old_route(self):
        self.run_export()
        index = json.loads((self.out / 'docs/public/knowledge/index.json').read_text())
        overview = index['notes'][0]
        self.assertEqual(overview['id'], 'alpha')
        self.assertEqual(overview['url'], '/knowledge/math/')
        self.assertEqual(overview['aliases'], ['/knowledge/alpha/'])
        self.assertEqual(index['categories'][0]['overview'], 'alpha')
        other = (self.out / 'docs/knowledge/beta/index.md').read_text()
        self.assertIn('[前置定义](/knowledge/math/)', other)
        self.assertNotIn('](/knowledge/alpha/)', other)
        self.assertFalse((self.out / 'docs/knowledge/alpha/index.md').exists())
        self.assertTrue((self.out / 'docs/knowledge/alpha/index.mdx').is_file())

    def test_category_without_overview_retains_native_directory(self):
        del self.spec['categories'][0]['overview']
        self.run_export()
        overview = (self.out / 'docs/knowledge/math/index.mdx').read_text()
        self.assertIn('OverviewGroup', overview)
        self.assertIn('基础知识 · 几何基础', overview)
        self.assertTrue((self.out / 'docs/knowledge/alpha/index.md').is_file())
        self.assertFalse((self.out / 'docs/knowledge/alpha/index.mdx').exists())

    def test_manifest_removal_cleans_pages_assets_and_navigation(self):
        self.run_export()
        self.run_export({'notes': [{'path': '乙.md', 'slug': 'beta',
                                  'description': '乙的基本区域。'}]})
        self.assertFalse((self.out / 'docs/knowledge/alpha').exists())
        self.assertFalse((self.out / 'docs/knowledge/math').exists())
        self.assertFalse((self.out / 'docs/public/knowledge/raw/alpha.md').exists())
        self.assertFalse((self.out / 'docs/public/knowledge/attachments').exists())
        index = json.loads((self.out / 'docs/public/knowledge/index.json').read_text())
        self.assertEqual([n['id'] for n in index['notes']], ['beta'])

    def render_llms(self, origin=''):
        index = json.loads((self.out / 'docs/public/knowledge/index.json').read_text())
        entries = [{'title': '知识库', 'url': '/knowledge/', 'description': '知识库目录。'}]
        entries += index['categories'] + index['notes']
        unique = {}
        for item in entries:
            unique.setdefault(item['url'], item)
        for note in index['notes']:
            for alias in note.get('aliases', []):
                unique[alias] = {'title': '旧概览入口', 'url': alias, 'description': '兼容旧地址。'}
        # 模拟原生 Others 分组及旧地址，验证领域与概览只收录一次。
        pages = [{'title': item['title'], 'link': origin + item['url'] + 'index.md',
                  'description': item['description']} for item in reversed(list(unique.values()))]
        context = {'title': '临时测试站', 'description': '独立临时知识库。', 'base': '/',
                   'siteOrigin': origin, 'sections': [{'title': 'Others', 'pages': pages}]}
        renderer = (Path(__file__).resolve().parents[1] / 'scripts/render_llms.mjs').as_uri()
        script = ("import {readFileSync} from 'node:fs'; "
                  f"import {{renderLlmsTxt}} from {json.dumps(renderer)}; "
                  "const {context,index}=JSON.parse(readFileSync(0,'utf8')); "
                  "process.stdout.write(renderLlmsTxt(context,index));")
        return subprocess.run(['node', '--input-type=module', '-e', script],
                              input=json.dumps({'context': context, 'index': index}),
                              text=True, capture_output=True, check=True).stdout

    def test_llms_groups_summaries_and_order_follow_public_manifest(self):
        self.run_export()
        for origin in ['', 'https://shijin.space']:
            with self.subTest(origin=origin):
                text = self.render_llms(origin)
                self.assertNotIn('Others', text)
                self.assertNotIn('PRIVATE_METADATA_SENTINEL', text)
                self.assertIn('## 数学领域', text)
                self.assertNotIn('### 概览', text)
                self.assertNotIn('/knowledge/alpha/', text)
                self.assertIn('### 基础知识 · 几何基础', text)
                self.assertIn(f'关联数据（JSON 辅助资源，非文档页面）：{origin}/knowledge/index.json', text)
                self.assertNotIn('[关联索引](', text)
                self.assertIn(f'[数学领域]({origin}/knowledge/math/index.md): 甲的定义与公式。', text)
                self.assertLess(text.index('[数学领域]'), text.index('[乙]'))
                links = re.findall(r'\]\(([^)]+\.md)\)', text)
                self.assertEqual(len(links), 3)
                self.assertEqual(len(set(links)), 3)

    def test_llms_multiple_categories_and_uncategorized_notes(self):
        self.spec['categories'].append({'id': 'computing', 'title': '计算领域',
                                        'description': '计算领域的阅读入口。'})
        self.spec['notes'][1].update(category='computing', group='研究增量', chapter='')
        (self.vault / '丙.md').write_text('# 丙\n\n独立笔记。', encoding='utf-8')
        self.spec['notes'].append({'path': '丙.md', 'slug': 'gamma', 'description': '独立笔记。'})
        self.run_export()
        text = self.render_llms('https://shijin.space')
        self.assertLess(text.index('## 数学领域'), text.index('## 计算领域'))
        self.assertIn('### 研究增量', text)
        self.assertIn('## 其他笔记', text)
        self.assertEqual(text.count('[丙]'), 1)
        self.assertNotIn('## 其他页面', text)

    def test_site_content_is_copied_and_refreshes_without_editing_source(self):
        home = self.site / 'index.md'
        home.write_text(home.read_text() + '\n临时网站介绍。\n')
        original = home.read_bytes()
        (self.site / 'about.md').write_text('# 临时介绍\n\n独立网站正文。\n')
        self.run_export()
        self.assertIn('临时网站介绍。', (self.out / 'docs/index.md').read_text())
        # 公开清单只扩充知识库卡片，不改写独立的个人首页。
        self.assertEqual((self.out / 'docs/index.md').read_bytes(), original)
        knowledge = (self.out / 'docs/knowledge/index.md').read_text()
        self.assertIn('数学领域', knowledge)
        self.assertIn('/knowledge/math/', knowledge)
        self.assertEqual((self.out / 'docs/about.md').read_bytes(), (self.site / 'about.md').read_bytes())
        self.assertEqual(home.read_bytes(), original)
        home.write_text(home.read_text().replace('临时网站介绍。', '更新后的临时介绍。'))
        self.run_export()
        self.assertIn('更新后的临时介绍。', (self.out / 'docs/index.md').read_text())

    def test_site_cannot_override_knowledge_publication(self):
        target = self.site / 'knowledge/unapproved.md'
        target.write_text('临时未允许内容。')
        with self.assertRaisesRegex(ValueError, '公开清单'):
            self.run_export()
        target.unlink()
        (self.site / 'public/knowledge').mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, '公开清单'):
            self.run_export()

    def test_public_note_requires_explicit_summary(self):
        del self.spec['notes'][0]['description']
        with self.assertRaisesRegex(ValueError, 'description'):
            self.run_export()

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
        index = json.loads((built / 'knowledge/index.json').read_text())
        for note in index['notes']:
            for url in [note['url'], *note.get('aliases', [])]:
                folder = built / url.lstrip('/')
                folder.mkdir(parents=True)
                (folder / 'index.md').write_text('DAMAGED_MATH_SENTINEL')
        (built / 'llms.txt').write_text(
            '# 测试站\n\n- [数学领域](/knowledge/math/index.md)\n- [乙](/knowledge/beta/index.md)\n')
        report = finalize(built)
        self.assertEqual(report, {'markdown_pages': 2, 'llms_pages': 2})
        self.assertEqual((built / 'knowledge/alpha/index.md').read_bytes(),
                         (built / 'knowledge/raw/alpha.md').read_bytes())
        self.assertTrue((built / 'knowledge/alpha/index.md').read_text().startswith('> For AI agents:'))
        full = (built / 'llms-full.txt').read_text()
        self.assertIn('$$\nx\n=\ny\n$$', full)
        self.assertIn('$x^2$', full)
        self.assertNotIn('DAMAGED_MATH_SENTINEL', full)
        self.assertNotIn('PRIVATE_METADATA_SENTINEL', full)

    def test_published_markdown_index_uses_same_origin_absolute_links(self):
        self.run_export()
        built = self.root / 'built'
        shutil.copytree(self.out / 'docs/public', built)
        index = json.loads((built / 'knowledge/index.json').read_text())
        for note in index['notes']:
            for url in [note['url'], *note.get('aliases', [])]:
                (built / url.lstrip('/')).mkdir(parents=True)
        (built / 'llms.txt').write_text(
            '- [数学领域](https://shijin.space/knowledge/math/index.md)\n'
            '- [乙](https://shijin.space/knowledge/beta/index.md)\n'
            '- [外部资料](https://example.com/external.md)\n')
        report = finalize(built, 'https://shijin.space')
        self.assertEqual(report['llms_pages'], 2)
        full = (built / 'llms-full.txt').read_text()
        self.assertIn('$$\nx\n=\ny\n$$', full)
        self.assertIn('$x^2$', full)


if __name__ == '__main__':
    unittest.main()
