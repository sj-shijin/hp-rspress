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
from finalize_markdown import finalize


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
        links, search = ['- [目录](/knowledge/index.md)'], []
        folder = self.output / 'knowledge'
        (folder / 'index.html').write_text('<h1>目录</h1>')
        (folder / 'index.md').write_text('# 目录\n')
        for note in index['notes']:
            folder = self.output / note['url'].lstrip('/')
            folder.mkdir(parents=True)
            (folder / 'index.html').write_text(
                f'<meta name="description" content="{escape(note["description"])}">'
                f'<link rel="alternate" type="text/markdown" href="{note["url"]}index.md">'
                '<link rel="describedby" href="/llms.txt">'
                f'<h1>{escape(note["title"])}</h1><span class="katex">x</span>')
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
        finalize(self.output)

    def tearDown(self):
        shutil.rmtree(self.root)

    def check(self, origin=''):
        return check_build(self.output, self.manifest, self.vault, origin)

    def test_local_build_contract(self):
        report = self.check()
        self.assertEqual((report['notes'], report['math_pages'], report['legacy_routes']), (2, 1, 1))

    def test_production_build_contract(self):
        origin = 'https://shijin.space'
        for path in self.output.rglob('*.html'):
            path.write_text(path.read_text().replace('href="/', f'href="{origin}/'))
        path = self.output / 'llms.txt'
        path.write_text(path.read_text().replace('](/', f']({origin}/'))
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


if __name__ == '__main__':
    unittest.main()
