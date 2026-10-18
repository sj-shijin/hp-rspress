"""在独立临时产物中验证检查器能拦截已知回归。"""
from html import escape
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from check_build import check_build
from export_knowledge import export
from finalize_markdown import finalize, markdown_tools


class BuildArtifactTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='pkw-rspress-build-'))
        self.vault = self.root / 'vault'
        self.vault.mkdir()
        self.source = self.root / 'site'
        shutil.copytree(Path(__file__).resolve().parents[1] / 'site', self.source)
        (self.vault / '概览.md').write_text('# 概览\n\n临时概览。[[定义]]\n')
        (self.vault / '定义.md').write_text('# 定义\n\n公式 $x^2$。\n\n$$\nx=y\n$$\n')
        self.spec = {
            'categories': [{'id': 'math', 'title': '临时数学', 'overview': 'overview'}],
            'notes': [{'path': '概览.md', 'slug': 'overview', 'category': 'math', 'description': '临时阅读入口。'},
                      {'path': '定义.md', 'slug': 'definition', 'category': 'math', 'description': '临时公式定义。'}],
        }
        self.manifest = self.root / 'publish.json'
        self.manifest.write_text(json.dumps(self.spec))
        generated = self.root / 'generated'
        export(self.vault, self.manifest, generated, site_source=self.source)
        self.output = self.root / 'built'
        shutil.copytree(generated / 'docs/public', self.output)
        index = json.loads((self.output / 'knowledge/index.json').read_text())
        links, search = ['关联数据（JSON 辅助资源，非文档页面）：/knowledge/index.json',
                         '- [目录](/knowledge/index.md)'], []
        folder = self.output / 'knowledge'
        (folder / 'index.html').write_text('<h1>目录</h1>')
        (folder / 'index.md').write_text('# 目录\n')
        for note in index['notes']:
            folder = self.output / note['url'].lstrip('/')
            folder.mkdir(parents=True)
            def formula(tex, display=False):
                expression = ('<span class="katex"><math><semantics>'
                              f'<annotation encoding="application/x-tex">{escape(tex)}</annotation>'
                              '</semantics></math></span>')
                return f'<span class="katex-display">{expression}</span>' if display else expression
            content = ('<p>临时概览。<a href="/knowledge/definition/">定义</a></p>'
                       if note['id'] == 'overview' else
                       f'<p>公式 {formula("x^2")}。</p>{formula("x=y", True)}'
                       '<h2>引用此笔记</h2><ul><li><a href="/knowledge/math/">概览</a></li></ul>')
            title = '临时数学' if note['id'] == 'overview' else note['title']
            (folder / 'index.html').write_text(
                f'<meta name="description" content="{escape(note["description"])}">'
                f'<link rel="alternate" type="text/markdown" href="{note["url"]}index.md">'
                '<link rel="describedby" href="/llms.txt">'
                '<div class="rp-llms-hint">For AI agents:</div>'
                f'<div class="rp-doc rspress-doc"><h1>{escape(title)}</h1>{content}</div>')
            (folder / 'index.md').write_text('待校正')
            links.append(f'- [{note["title"]}]({note["url"]}index.md): {note["description"]}')
            search.append({'routePath': note['url']})
            for alias in note.get('aliases', []):
                legacy = self.output / alias.lstrip('/')
                legacy.mkdir(parents=True)
                (legacy / 'index.html').write_text(
                    '<meta name="robots" content="noindex">'
                    f'<link rel="canonical" href="{note["url"]}">')
        (self.output / 'static').mkdir()
        (self.output / 'static/search_index.zh.test.json').write_text(json.dumps(search))
        (self.output / 'llms.txt').write_text('\n'.join(links) + '\n')
        routes = ['/knowledge/', *[note['url'] for note in index['notes']]]
        (self.output / 'sitemap.xml').write_text(
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            ''.join(f'<url><loc>http://127.0.0.1:1320{route}</loc></url>' for route in routes) + '</urlset>')
        finalize(self.output)

    def tearDown(self):
        shutil.rmtree(self.root)

    def check(self, origin=''):
        return check_build(self.output, self.manifest, self.vault, origin)

    def test_local_build_contract(self):
        report = self.check()
        self.assertEqual((report['notes'], report['math_pages'], report['legacy_routes']), (2, 1, 1))
        self.assertEqual(report['math_formulas'], 2)
        self.assertEqual(report['sitemap_pages'], 3)

    def test_production_build_contract(self):
        origin = 'https://shijin.space'
        for path in self.output.rglob('*.html'):
            path.write_text(path.read_text().replace('href="/', f'href="{origin}/'))
        path = self.output / 'llms.txt'
        path.write_text(path.read_text().replace('](/', f']({origin}/')
                        .replace('：/knowledge/index.json', f'：{origin}/knowledge/index.json'))
        path = self.output / 'sitemap.xml'
        path.write_text(path.read_text().replace('http://127.0.0.1:1320', origin))
        finalize(self.output, origin)
        self.assertEqual(self.check(origin)['site_origin'], origin)

    def test_known_build_regressions_are_rejected(self):
        regressions = [
            ('knowledge/definition/index.md', '转义错误的公式', 'Markdown'),
            ('knowledge/definition/index.html',
             (self.output / 'knowledge/definition/index.html').read_text().replace(
                 'href="/llms.txt"', 'href="https://shijin.space/llms.txt"'), 'SITE_ORIGIN'),
            ('knowledge/definition/index.html',
             (self.output / 'knowledge/definition/index.html').read_text().replace('class="katex"', 'class="missing"'), '公式未渲染'),
            ('knowledge/definition/index.html',
             (self.output / 'knowledge/definition/index.html').read_text().replace('x^2', 'x^3'), '公式不一致'),
            ('knowledge/definition/index.html',
             (self.output / 'knowledge/definition/index.html').read_text().replace('公式 ', '网页独有的错误正文'), 'HTML 正文'),
            ('knowledge/math/index.html',
             (self.output / 'knowledge/math/index.html').read_text().replace('临时概览。', ''), 'Markdown 正文'),
            ('knowledge/index.md', '# 缺少提示\n', 'AI 导航提示'),
            ('llms.txt', (self.output / 'llms.txt').read_text() +
             '\n[错误的文档入口](/knowledge/index.json)\n', 'JSON 辅助资源'),
            ('sitemap.xml', (self.output / 'sitemap.xml').read_text().replace('</urlset>',
             '<url><loc>http://127.0.0.1:1320/knowledge/overview/</loc></url></urlset>'), 'sitemap 页面范围'),
            ('static/search_index.zh.test.json',
             json.dumps([{'routePath': '/knowledge/math/'}, {'routePath': '/knowledge/definition/'},
                         {'routePath': '/knowledge/overview/'}]), '搜索索引重复'),
            ('knowledge/overview/index.html', '<p>失效的旧入口</p>', '旧网址'),
            ('knowledge/unapproved/index.html', '<h1>未允许公开</h1>', '网页范围'),
            ('knowledge/unapproved.md', '未允许的下载文件', '文件范围'),
            ('llms-full.txt', '遗漏正文', 'llms-full'),
        ]
        for relative, content, error in regressions:
            with self.subTest(relative=relative, error=error):
                path = self.output / relative
                original = path.read_bytes() if path.exists() else None
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content)
                try:
                    with self.assertRaisesRegex(ValueError, error):
                        self.check()
                finally:
                    if original is None:
                        path.unlink()
                    else:
                        path.write_bytes(original)

    def test_markdown_links_keep_code_math_fragments_and_resource_types(self):
        source = ('# 临时测试\n\n[页面](/knowledge/definition/#基本定义)\n'
                  '![图](/knowledge/attachments/plot(1).svg)\n'
                  '[引用][ref]\n\n[ref]: /knowledge/math/ "概览"\n'
                  '<a href="/knowledge/definition/">HTML 链接</a>\n'
                  '[外部](https://example.com/paper.pdf)\n'
                  '`[代码](/keep)`\n\n```text\n[代码](/keep)\n$x$\n```\n'
                  '\n$x_1$\n\n$$\na_1 = b_2\n$$\n')
        result = markdown_tools('prepare', [{'route': '/knowledge/definition/', 'markdown': source}],
                                origin='https://shijin.space',
                                routes={'/knowledge/definition/': '/knowledge/definition/index.md',
                                        '/knowledge/math/': '/knowledge/math/index.md'})[0]
        self.assertIn('https://shijin.space/knowledge/definition/index.md#%E5%9F%BA%E6%9C%AC%E5%AE%9A%E4%B9%89', result)
        self.assertIn('![图](https://shijin.space/knowledge/attachments/plot(1).svg)', result)
        self.assertIn('[ref]: https://shijin.space/knowledge/math/index.md "概览"', result)
        self.assertIn('href="https://shijin.space/knowledge/definition/index.md"', result)
        self.assertIn('[外部](https://example.com/paper.pdf)', result)
        self.assertIn('`[代码](/keep)`', result)
        self.assertIn('```text\n[代码](/keep)\n$x$\n```', result)
        self.assertIn('$x_1$\n\n$$\na_1 = b_2\n$$', result)
        again = markdown_tools('prepare', [{'route': '/knowledge/definition/', 'markdown': result}],
                               origin='https://shijin.space', routes={})[0]
        self.assertEqual(result, again)

    def test_chinese_emphasis_and_formula_use_rspress_parsing_rules(self):
        markdown = '# 临时定义\n\n因此，**用 $y$ 缩短指定向量 $x$**的条件是。\n'
        html = ('<div class="rspress-doc"><h1>临时定义</h1><p>因此，<strong>用 '
                '<span class="katex"><annotation encoding="application/x-tex">y</annotation></span>'
                ' 缩短指定向量 '
                '<span class="katex"><annotation encoding="application/x-tex">x</annotation></span>'
                '</strong>的条件是。</p></div>')
        result = markdown_tools('compare', [{'html': html, 'markdown': markdown}])[0]
        self.assertTrue(result['formulasMatch'])
        self.assertEqual((result['missing'], result['missingHtml']), ([], []))


    def test_mermaid_source_remains_part_of_strict_content_checks(self):
        source = 'flowchart LR\n A[中文知识] --> B[研究增量]'
        markdown = '```mermaid\n' + source + '\n```'
        html = ('<div class="rspress-doc"><figure class="sj-mermaid">'
                '<svg class="pele"><text>中文知识</text></svg>'
                '<details><summary class="rp-not-doc">查看 Mermaid 源码</summary>'
                '<pre><code>' + escape(source) + '</code></pre></details></figure></div>')
        result = markdown_tools('compare', [{'html': html, 'markdown': markdown}])[0]
        self.assertTrue(result['diagramsMatch'])
        self.assertEqual((result['htmlDiagrams'], result['markdownDiagrams']), (1, 1))
        self.assertEqual((result['missing'], result['missingHtml']), ([], []))
        changed = markdown_tools('compare', [{'html': html, 'markdown': markdown.replace('研究增量', '被修改的内容')}])[0]
        self.assertFalse(changed['diagramsMatch'])
        with self.assertRaisesRegex(ValueError, 'Mermaid.*SVG'):
            markdown_tools('compare', [{'html': html.replace('<svg class="pele"><text>中文知识</text></svg>', ''),
                                        'markdown': markdown}])


if __name__ == '__main__':
    unittest.main()
