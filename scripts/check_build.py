#!/usr/bin/env python3
"""检查实际网站产物的公开范围、链接、搜索索引和 Markdown 一致性。"""
import argparse
from collections import Counter
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

from export_knowledge import inside, outside_code


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


def check_build(output: Path, manifest: Path, vault: Path, site_origin: str = '') -> dict:
    output = output.resolve()
    origin = site_origin.rstrip('/')
    spec = json.loads(manifest.read_text(encoding='utf-8'))
    index = json.loads((output / 'knowledge/index.json').read_text(encoding='utf-8'))
    expected = {item['slug']: item for item in spec['notes']}
    notes = {note['id']: note for note in index['notes']}
    require(len(notes) == len(index['notes']) and notes.keys() == expected.keys(),
            '关联索引中的笔记与公开清单不一致')
    categories = {c['id']: c for c in spec.get('categories', [])}
    active_categories = {n.get('category') for n in expected.values()} - {None, ''}
    expected_html = {'knowledge/index.html'} | {
        f'knowledge/{identifier}/index.html' for identifier in active_categories}
    aliases, math_pages = set(), 0

    for identifier, note in notes.items():
        item = expected[identifier]
        category = categories.get(item.get('category'), {})
        landing = category.get('overview') == identifier
        url = f"/knowledge/{item['category'] if landing else identifier}/"
        old_urls = [f'/knowledge/{identifier}/'] if landing else []
        require(note['url'] == url and note.get('aliases', []) == old_urls,
                f'笔记网址与清单不一致：{identifier}')
        require(note['description'] == item['description'], f'笔记摘要不一致：{identifier}')
        require(set(note['links']) <= notes.keys(), f'关联指向未公开笔记：{identifier}')
        incoming = {n['id'] for n in notes.values() if identifier in n['links'] and n['id'] != identifier}
        require(set(note['backlinks']) == incoming, f'反向链接不一致：{identifier}')
        canonical = output / url.lstrip('/') / 'index.md'
        raw = output / 'knowledge/raw' / f'{identifier}.md'
        require(canonical.read_bytes() == raw.read_bytes(), f'Markdown 公式或正文不一致：{identifier}')
        page = Page(output / url.lstrip('/') / 'index.html')
        require(page.has('h1'), f'正文未生成：{identifier}')
        require(page.has('meta', name='description', content=item['description']),
                f'网页摘要不一致：{identifier}')
        require(page.has('link', rel='alternate', type='text/markdown', href=origin + url + 'index.md'),
                f'网页 Markdown 链接或 SITE_ORIGIN 不一致：{identifier}')
        require(page.has('link', rel='describedby', href=origin + '/llms.txt'),
                f'网页 AI 索引链接或 SITE_ORIGIN 不一致：{identifier}')
        classes = {token for _, attrs in page.tags for token in attrs.get('class', '').split()}
        require('katex-error' not in classes, f'公式渲染失败：{identifier}')
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

    actual_html = {p.relative_to(output).as_posix() for p in (output / 'knowledge').rglob('*.html')}
    require(actual_html == expected_html, '知识库网页范围与公开清单不一致')
    actual_raw = {p.relative_to(output / 'knowledge/raw').as_posix()
                  for p in (output / 'knowledge/raw').rglob('*') if p.is_file()}
    require(actual_raw == {f'{identifier}.md' for identifier in notes}, '原始 Markdown 公开范围不一致')
    allowed_assets = set()
    for relative in spec.get('attachments', []):
        asset = inside(vault, relative)
        allowed_assets.add(hashlib.sha256(asset.read_bytes()).hexdigest()[:16] + asset.suffix.lower())
    assets = {p.relative_to(output / 'knowledge/attachments').as_posix()
              for p in (output / 'knowledge/attachments').rglob('*') if p.is_file()}
    require(assets <= allowed_assets, '构建产物包含未允许的知识库附件')
    expected_files = expected_html | {path.removesuffix('.html') + '.md' for path in expected_html}
    expected_files |= {'knowledge/index.json'} | {f'knowledge/raw/{identifier}.md' for identifier in notes}
    expected_files |= {f'knowledge/attachments/{name}' for name in assets}
    actual_files = {p.relative_to(output).as_posix() for p in (output / 'knowledge').rglob('*') if p.is_file()}
    require(actual_files == expected_files, '知识库文件范围与公开清单不一致')

    search_files = list((output / 'static').glob('search_index*.json'))
    require(bool(search_files), '缺少原生搜索索引')
    search = [row for path in search_files for row in json.loads(path.read_text(encoding='utf-8'))]
    counts = Counter(row['routePath'] for row in search)
    require(all(counts[n['url']] == 1 for n in notes.values()), '搜索索引缺少或重复收录笔记')
    require(not aliases.intersection(counts), '搜索索引重复收录旧概览入口')
    allowed_search = {'/' + path.removesuffix('index.html') for path in expected_html}
    require(all(not url.startswith('/knowledge/') or url in allowed_search for url in counts),
            '搜索索引包含未公开知识库页面')

    llms = (output / 'llms.txt').read_text(encoding='utf-8')
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
    required = {n['url'] + 'index.md' for n in notes.values()} | {'/knowledge/index.md'} | {
        f'/knowledge/{identifier}/index.md' for identifier in active_categories}
    require(required <= listed, 'llms.txt 缺少公开笔记或领域入口')
    require(not {alias + 'index.md' for alias in aliases}.intersection(listed), 'llms.txt 重复收录旧入口')
    require(all(n['description'] in llms for n in notes.values()), 'llms.txt 缺少笔记摘要')
    bundle = '\n\n---\n\n'.join(path.read_text(encoding='utf-8').strip() for path in paths) + '\n'
    require((output / 'llms-full.txt').read_text(encoding='utf-8') == bundle,
            'llms-full.txt 与单篇 Markdown 不一致')
    return {'notes': len(notes), 'knowledge_html_pages': len(actual_html), 'attachments': len(assets),
            'search_pages': len(search), 'llms_pages': len(links), 'math_pages': math_pages,
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
