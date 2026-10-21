#!/usr/bin/env python3
"""复用导出的 Markdown、补全链接并同步全文入口，不重写正文。"""
import json
import os
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit
from markdown_tools import markdown_tools


def finalize(output: Path, site_origin: str = '') -> dict:
    output = output.resolve()
    site_origin = site_origin.rstrip('/')
    index = json.loads((output / 'knowledge/index.json').read_text(encoding='utf-8'))
    routes = {'/': '/index.md', '/knowledge/': '/knowledge/index.md'}
    contexts = {}
    for note in index['notes']:
        source = output / note['markdown'].lstrip('/')
        target = output / note['url'].lstrip('/') / 'index.md'
        if not source.resolve().is_relative_to(output) or not target.resolve().is_relative_to(output):
            raise ValueError('Markdown 路径超出网站构建目录')
        # Rspress 2.0 的 SSG-MD 不执行自定义数学插件，会转义 LaTeX。
        # 此处只使用清单导出得到的副本，网页渲染与正式知识库均保持原状。
        shutil.copyfile(source, target)
        contexts[source] = note['url']
        contexts[target] = note['url']
        routes[note['url']] = note['url'] + 'index.md'
        # 兼容先前公开的 Markdown 链接；AI 索引只收录领域首页一次。
        for alias in note.get('aliases', []):
            legacy = output / alias.lstrip('/') / 'index.md'
            shutil.copyfile(source, legacy)
            contexts[legacy] = note['url']
            routes[alias] = note['url'] + 'index.md'

    # 原生 404 页也带 Markdown alternate 链接，但 2.0 不生成对应文件。
    if (output / '404.html').exists():
        (output / '404.md').write_text(
            '# 页面不存在\n\n请从[知识库目录](/knowledge/)继续查阅。\n', encoding='utf-8')

    # 统一处理原生页面、笔记、下载副本与旧地址，不重新序列化正文。
    files = sorted(output.rglob('*.md'))
    for path in files:
        relative = '/' + path.relative_to(output).as_posix()
        if relative.endswith('/index.md') and '/raw/' not in relative:
            routes.setdefault(relative.removesuffix('index.md'), relative)
    pages = [{'route': contexts.get(path, '/' + path.relative_to(output).as_posix()),
              'markdown': path.read_text(encoding='utf-8')} for path in files]
    prepared = markdown_tools('prepare', pages, origin=site_origin, routes=routes)
    for path, markdown in zip(files, prepared):
        path.write_text(markdown, encoding='utf-8')

    paths = []
    for href in re.findall(r'\]\(([^)]+)\)', (output / 'llms.txt').read_text(encoding='utf-8')):
        url = urlsplit(href)
        if url.netloc and url.netloc != urlsplit(site_origin).netloc:
            continue
        if url.scheme not in ('', 'http', 'https') or not url.path.endswith('.md'):
            continue
        path = (output / unquote(url.path).lstrip('/')).resolve()
        if not path.is_relative_to(output):
            raise ValueError('llms.txt 中的路径超出网站构建目录')
        if path not in paths:
            paths.append(path)
    (output / 'llms-full.txt').write_text(
        '\n\n---\n\n'.join(path.read_text(encoding='utf-8').strip() for path in paths) + '\n',
        encoding='utf-8')
    report = {'markdown_pages': len(index['notes']), 'llms_pages': len(paths)}
    (output.parent / 'markdown-report.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


if __name__ == '__main__':
    site = Path(__file__).resolve().parents[1]
    print(json.dumps(finalize(site / '.generated/site', os.environ.get('SITE_ORIGIN', '')),
                     ensure_ascii=False))
