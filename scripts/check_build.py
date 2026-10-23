#!/usr/bin/env python3
"""检查实际网站产物的公开范围、摘要、链接和索引。"""
import argparse
from collections import Counter
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

from export_knowledge import SECTIONS, inside, outside_code, read_note
from markdown_tools import markdown_tools
from site_projects import read_site_projects


def require(condition, message):
    if not condition:
        raise ValueError(message)


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.tags = []
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def has(self, tag, **attrs):
        return any(name == tag and all(actual.get(k) == v for k, v in attrs.items())
                   for name, actual in self.tags)


def has_math(markdown):
    formulas = []
    def collect(text):
        formulas.extend(re.findall(r'(?<!\\)\$\$[\s\S]*?\$\$|(?<!\\)\$[^\n$]+\$', text))
        return text
    outside_code(markdown, collect)
    return bool(formulas)


def check_build(output: Path, manifest: Path, vault: Path, site_origin: str = '', *,
                site_source: Path | None = None) -> dict:
    output = output.resolve()
    origin = site_origin.rstrip('/')
    spec = json.loads(manifest.read_text(encoding='utf-8'))
    index = json.loads((output / 'knowledge/index.json').read_text(encoding='utf-8'))
    site_projects = read_site_projects(site_source or Path(__file__).resolve().parents[1] / 'site')
    require(index.get('siteProjects', []) == site_projects, '网站项目索引与 site/projects.json 不一致')
    site_pages = [page for project in site_projects for page in project['pages']]
    expected = {item['slug']: item for item in spec['notes']}
    notes = {note['id']: note for note in index['notes']}
    require(len(notes) == len(index['notes']) and notes.keys() == expected.keys(),
            '关联索引中的笔记与公开清单不一致')
    categories = {c['id']: c for c in spec.get('categories', [])}
    active_categories = {n.get('category') for n in expected.values()} - {None, ''}
    def section(item):
        return categories.get(item.get('category'), {}).get('section', 'knowledge')
    sections = {'knowledge'} | {section(item) for item in expected.values()}
    if site_projects:
        sections.add('projects')
    category_urls = {identifier: f"/{category.get('section', 'knowledge')}/{identifier}/"
                     for identifier, category in categories.items()}
    expected_html = {f'{key}/index.html' for key in sections} | {
        category_urls[identifier].lstrip('/') + 'index.html' for identifier in active_categories}
    for item in site_pages:
        url = item['url']
        expected_html.add(url.lstrip('/') + 'index.html')
        page = Page(output / url.lstrip('/') / 'index.html')
        require(page.has('h1'), f'网站项目正文未生成：{url}')
        require(page.has('meta', name='description', content=item['description']),
                f'网站项目网页摘要不一致：{url}')
        require(page.has('link', rel='alternate', type='text/markdown', href=origin + url + 'index.md')
                and page.has('link', rel='describedby', href=origin + '/llms.txt'),
                f'网站项目 Markdown 入口或 SITE_ORIGIN 不一致：{url}')
    require({c['id'] for c in index['categories']} == active_categories, '类别范围与公开清单不一致')
    for category in index['categories']:
        require(category['url'] == category_urls[category['id']]
                and category.get('section', 'knowledge') == categories[category['id']].get('section', 'knowledge'),
                '类别网址或导航分类与公开清单不一致')
    aliases, math_pages = set(), 0

    for identifier, note in notes.items():
        item = expected[identifier]
        description = read_note(vault, item).description
        category = categories.get(item.get('category'), {})
        landing = category.get('overview') == identifier
        url = f"/{section(item)}/{item['category'] if landing else identifier}/"
        old_urls = [f'/{section(item)}/{identifier}/'] if landing else []
        require(note['url'] == url and note.get('aliases', []) == old_urls,
                f'笔记网址与清单不一致：{identifier}')
        require(note['description'] == description, f'笔记摘要不一致：{identifier}')
        require(set(note['links']) <= notes.keys(), f'关联指向未公开笔记：{identifier}')
        incoming = {n['id'] for n in notes.values() if identifier in n['links'] and n['id'] != identifier}
        require(set(note['backlinks']) == incoming, f'反向链接不一致：{identifier}')
        canonical = output / url.lstrip('/') / 'index.md'
        markdown_url = f'/{section(item)}/raw/{identifier}.md'
        require(note['markdown'] == markdown_url and note.get('section', 'knowledge') == section(item),
                f'笔记下载路径或导航分类与清单不一致：{identifier}')
        raw = output / markdown_url.lstrip('/')
        require(canonical.read_bytes() == raw.read_bytes(), f'Markdown 公式或正文不一致：{identifier}')
        page = Page(output / url.lstrip('/') / 'index.html')
        ids = [attrs['id'] for _, attrs in page.tags if attrs.get('id', '').startswith('ref-')]
        require(len(ids) == len(set(ids)), f'参考文献锚点重复：{identifier}')
        for tag, attrs in page.tags:
            href = attrs.get('href', '')
            if tag == 'a' and href.startswith('#ref-'):
                require(unquote(href[1:]) in ids, f'参考文献链接失效：{identifier}：{href}')
        require(page.has('h1'), f'正文未生成：{identifier}')
        require(page.has('meta', name='description', content=description),
                f'网页摘要不一致：{identifier}')
        require(page.has('link', rel='alternate', type='text/markdown', href=origin + url + 'index.md'),
                f'网页 Markdown 链接或 SITE_ORIGIN 不一致：{identifier}')
        require(page.has('link', rel='describedby', href=origin + '/llms.txt'),
                f'网页 AI 索引链接或 SITE_ORIGIN 不一致：{identifier}')
        classes = {token for _, attrs in page.tags for token in attrs.get('class', '').split()}
        require('katex-error' not in classes, f'公式渲染失败：{identifier}')
        require('rp-llms-hint' in classes, f'网页缺少 AI 导航提示：{identifier}')
        if has_math(raw.read_text(encoding='utf-8')):
            require('katex' in classes, f'公式未渲染：{identifier}')
            math_pages += 1
        expected_html.add(url.lstrip('/') + 'index.html')
        for alias in old_urls:
            aliases.add(alias)
            expected_html.add(alias.lstrip('/') + 'index.html')
            old = Page(output / alias.lstrip('/') / 'index.html')
            require(old.has('meta', name='robots', content='noindex')
                    and old.has('link', rel='canonical', href=origin + url),
                    f'旧网址兼容页未正确生成：{alias}')
            require((output / alias.lstrip('/') / 'index.md').read_bytes() == raw.read_bytes(),
                    f'旧 Markdown 网址失效：{alias}')

    actual_html = {p.relative_to(output).as_posix()
                   for key in SECTIONS for p in (output / key).rglob('*.html')}
    require(actual_html == expected_html, '知识库网页范围与公开清单不一致')
    expected_raw = {f"{section(item)}/raw/{identifier}.md" for identifier, item in expected.items()}
    actual_raw = {p.relative_to(output).as_posix()
                  for key in SECTIONS for p in (output / key / 'raw').rglob('*') if p.is_file()}
    require(actual_raw == expected_raw, '原始 Markdown 公开范围不一致')
    allowed_assets = set()
    for relative in spec.get('attachments', []):
        asset = inside(vault, relative)
        allowed_assets.add(hashlib.sha256(asset.read_bytes()).hexdigest()[:16] + asset.suffix.lower())
    assets = {p.relative_to(output / 'knowledge/attachments').as_posix()
              for p in (output / 'knowledge/attachments').rglob('*') if p.is_file()}
    require(assets <= allowed_assets, '构建产物包含未允许的知识库附件')
    expected_files = expected_html | {path.removesuffix('.html') + '.md' for path in expected_html}
    expected_files |= {'knowledge/index.json'} | expected_raw
    expected_files |= {f'knowledge/attachments/{name}' for name in assets}
    actual_files = {p.relative_to(output).as_posix()
                    for key in SECTIONS for p in (output / key).rglob('*') if p.is_file()}
    require(actual_files == expected_files, '知识库文件范围与公开清单不一致')

    search_files = list((output / 'static').glob('search_index*.json'))
    require(bool(search_files), '缺少原生搜索索引')
    search = [row for path in search_files for row in json.loads(path.read_text(encoding='utf-8'))]
    counts = Counter(row['routePath'] for row in search)
    require(all(counts[n['url']] == 1 for n in notes.values()), '搜索索引缺少或重复收录笔记')
    require(all(counts[page['url']] == 1 for page in site_pages), '搜索索引缺少或重复收录网站项目页面')
    require(not aliases.intersection(counts), '搜索索引重复收录旧概览入口')
    allowed_search = {'/' + path.removesuffix('index.html') for path in expected_html}
    require(all(not any(url.startswith(f'/{key}/') for key in SECTIONS)
                or url in allowed_search for url in counts),
            '搜索索引包含未公开知识库页面')

    llms = (output / 'llms.txt').read_text(encoding='utf-8')
    require(origin + '/knowledge/index.json' in llms, 'llms.txt 缺少 JSON 关联资源地址')
    require(not re.search(r'\]\([^)]*index\.json\)', llms),
            'JSON 辅助资源不应作为文档页面参与发现和检查')
    links = re.findall(r'\]\(([^)]+\.md)\)', llms)
    require(len(links) == len(set(links)) and bool(links), 'llms.txt 入口重复或为空')
    paths = []
    for link in links:
        parsed = urlsplit(link)
        link_origin = f'{parsed.scheme}://{parsed.netloc}' if parsed.netloc else ''
        require(link_origin == origin, 'llms.txt 的 SITE_ORIGIN 不一致')
        path = (output / unquote(parsed.path).lstrip('/')).resolve()
        require(path.is_relative_to(output) and path.is_file(), f'llms.txt 链接失效：{link}')
        paths.append(path)
    listed = {urlsplit(link).path for link in links}
    required = {n['url'] + 'index.md' for n in notes.values()} | {
        f'/{key}/index.md' for key in sections} | {
        category_urls[identifier] + 'index.md' for identifier in active_categories} | {
        page['url'] + 'index.md' for page in site_pages}
    require(required <= listed, 'llms.txt 缺少公开笔记或领域入口')
    require(not {alias + 'index.md' for alias in aliases}.intersection(listed), 'llms.txt 重复收录旧入口')
    require(all(n['description'] in llms for n in notes.values()), 'llms.txt 缺少笔记摘要')
    require(all(page['description'] in llms for page in site_pages), 'llms.txt 缺少网站项目摘要')

    # JSON 单独核对其清单和关联结构；Markdown/HTML 提示及正文检查只应用于文档。
    markdown_files = sorted(output.rglob('*.md'))
    markdown_pages = [{'markdown': path.read_text(encoding='utf-8')} for path in markdown_files]
    hint = (f'> For AI agents: the complete documentation index is available at {origin}/llms.txt, '
            f'the full documentation bundle is available at {origin}/llms-full.txt.')
    markdown_links = markdown_tools('links', markdown_pages)
    for path, page, destinations in zip(markdown_files, markdown_pages, markdown_links):
        require(page['markdown'].startswith(hint + '\n\n'), f'Markdown 缺少 AI 导航提示或 SITE_ORIGIN 不一致：{path}')
        for destination in destinations:
            parsed = urlsplit(destination)
            if origin:
                require(bool(parsed.scheme), f'Markdown 链接不是完整网址：{path}：{destination}')
            if parsed.netloc and parsed.netloc != urlsplit(origin).netloc:
                continue
            if parsed.scheme not in ('', 'http', 'https') or not parsed.path:
                continue
            target = (output / unquote(parsed.path).lstrip('/')).resolve()
            require(target.is_relative_to(output), f'Markdown 链接超出构建目录：{destination}')
            if target.is_dir():
                target = target / 'index.html'
            require(target.is_file(), f'Markdown 本地链接失效：{path}：{destination}')

    sitemap = ET.parse(output / 'sitemap.xml')
    locations = [node.text for node in sitemap.findall('.//{*}loc')]
    sitemap_origin = origin or 'http://127.0.0.1:1320'
    sitemap_routes = set()
    for location in locations:
        parsed = urlsplit(location)
        require(f'{parsed.scheme}://{parsed.netloc}' == sitemap_origin, 'sitemap 的 SITE_ORIGIN 不一致')
        require(not parsed.query and not parsed.fragment, 'sitemap 不应包含查询参数或章节锚点')
        sitemap_routes.add(parsed.path)
    public_routes = set()
    # CLI 生成的独立演示是 iframe 资源，正文入口是 Cinderfolio-Marp 页面。
    presentation = 'cinderfolio/marp/example.html'
    has_marp = any(page['url'] == '/projects/cinderfolio/marp/' for page in site_pages)
    if has_marp:
        deck = Page(output / presentation)
        require(deck.has('figure', **{'class': 'cinderfolio-pele'})
                and deck.has('pre', **{'class': 'shiki shiki-themes cinderfolio-light cinderfolio-dark'}),
                'Marp 独立演示缺少 Pele 图表或 Shiki 高亮')
        require(Page(output / 'projects/cinderfolio/marp/index.html').has(
                    'iframe', src='/' + presentation),
                'Marp 页面缺少独立演示 iframe')
    for path in output.rglob('*.html'):
        relative = path.relative_to(output).as_posix()
        if has_marp and relative == presentation:
            continue
        route = '/' + relative.removesuffix('index.html')
        if relative != '404.html' and route not in aliases:
            public_routes.add(route)
    require(len(locations) == len(sitemap_routes) and sitemap_routes == public_routes,
            'sitemap 页面范围不一致，或包含旧入口、404、JSON 等非正文资源')
    bundle = '\n\n---\n\n'.join(path.read_text(encoding='utf-8').strip() for path in paths) + '\n'
    require((output / 'llms-full.txt').read_text(encoding='utf-8') == bundle,
            'llms-full.txt 与单篇 Markdown 不一致')
    return {'notes': len(notes),
            'site_project_pages': len(site_pages),
            'knowledge_html_pages': sum(p.startswith('knowledge/') for p in actual_html),
            'project_html_pages': sum(p.startswith('projects/') for p in actual_html),
            'attachments': len(assets),
            'search_pages': len(search), 'llms_pages': len(links), 'math_pages': math_pages,
            'markdown_files_checked': len(markdown_files), 'sitemap_pages': len(locations),
            'legacy_routes': len(aliases), 'site_origin': origin}


def main():
    site = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=site / '.generated/site')
    parser.add_argument('--manifest', type=Path, default=site / 'knowledge/publish.json')
    parser.add_argument('--vault', type=Path, default=site / 'knowledge-vault')
    args = parser.parse_args()
    report = check_build(args.output, args.manifest, args.vault, os.environ.get('SITE_ORIGIN', ''))
    (args.output.parent / 'build-check.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
