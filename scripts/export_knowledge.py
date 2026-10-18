#!/usr/bin/env python3
"""按显式清单生成 Rspress 内容、Markdown 和关联索引；不修改知识库。"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

import yaml


@dataclass
class Note:
    path: Path
    slug: str
    title: str
    body: str
    permalink: str
    description: str
    category: str = ''
    group: str = ''
    chapter: str = ''
    landing: bool = False
    links: set[str] = field(default_factory=set)

    @property
    def url(self) -> str:
        return f"/knowledge/{self.category if self.landing else self.slug}/"


def inside(root: Path, relative: str) -> Path:
    path = root / relative
    if Path(relative).is_absolute() or any(x.startswith('.') for x in Path(relative).parts):
        raise ValueError("清单路径必须是知识库内的非隐藏文件")
    if not path.resolve().is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError("清单文件不存在或位于知识库之外")
    return path


def read_note(vault: Path, item: dict) -> Note:
    path = inside(vault, item['path'])
    slug = item['slug']
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError("slug 只能使用小写英文、数字和连字符")
    description = str(item.get('description', '')).strip()
    if not description:
        raise ValueError('公开笔记需要在清单中填写 description 摘要')
    text = path.read_text(encoding='utf-8')
    metadata = {}
    if text.startswith('---\n'):
        frontmatter, separator, text = text[4:].partition('\n---\n')
        if not separator:
            raise ValueError("笔记的 YAML 属性未闭合")
        metadata = yaml.safe_load(frontmatter) or {}
    if '{{<' in text or '{{%' in text:
        raise ValueError("笔记包含 Hugo shortcode，请先转换为普通 Markdown")
    title = str(metadata.get('title', path.stem))
    text = re.sub(r'^\s*# ' + re.escape(title) + r'\s*\n', '', text, count=1)
    return Note(path, slug, title, text.strip() + '\n', str(metadata.get('permalink', '')),
                description=description, category=item.get('category', ''),
                group=item.get('group', ''),
                chapter=item.get('chapter', ''))


def outside_code(text: str, transform) -> str:
    """保留代码块和行内代码，避免改写示例中的双链或美元符号。"""
    chunks, current = [], []
    fence = None
    for line in text.splitlines(keepends=True):
        match = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
        if fence is None and match:
            if current:
                chunks.append((False, ''.join(current)))
                current = []
            fence = match.group(1)
        current.append(line)
        if fence and match and len(current) > 1 and match.group(1)[0] == fence[0] and len(match.group(1)) >= len(fence):
            chunks.append((True, ''.join(current)))
            current, fence = [], None
    if current:
        chunks.append((fence is not None, ''.join(current)))
    result = []
    for protected, chunk in chunks:
        if protected:
            result.append(chunk)
            continue
        pos = 0
        for match in re.finditer(r'(`+)(.+?)\1', chunk, re.S):
            result.extend((transform(chunk[pos:match.start()]), match.group(0)))
            pos = match.end()
        result.append(transform(chunk[pos:]))
    return ''.join(result)


def anchor(title: str) -> str:
    title = title.strip().lower()
    title = re.sub(r'\s+', '-', title)
    return ''.join(c for c in title if unicodedata.category(c)[0] in 'LN' or c in '-_')


def headings(text: str) -> str:
    counts = {}
    def replace(match):
        title = match.group(2).strip()
        if re.search(r'\{#[^}]+\}$', title):
            return match.group(0)
        name = anchor(title)
        count = counts.get(name, 0)
        counts[name] = count + 1
        suffix = f'-{count}' if count else ''
        return f'{match.group(1)} {title} {{#{name}{suffix}}}'
    return outside_code(text, lambda part: re.sub(r'^(#{1,6})\s+(.+)$', replace, part, flags=re.M))


def redirect_page(target: str) -> str:
    """旧概览地址保留为组件路由；使用原生运行时保留查询参数与章节锚点。"""
    return """import { useEffect } from 'react';
import { useHead, useLocation, useNavigate, withBase, withSiteOrigin } from '@rspress/core/runtime';

export function OverviewRedirect() {
  const navigate = useNavigate();
  const { search, hash } = useLocation();
  const target = withBase(__TARGET__);
  useHead({
    link: [{ rel: 'canonical', href: withSiteOrigin(target) }],
    meta: [{ name: 'robots', content: 'noindex' }],
  });
  useEffect(() => {
    navigate(target + search + hash, { replace: true });
  }, [navigate, target, search, hash]);
  return <p>概览已合并至<a href={target}>领域首页</a>。</p>;
}

<OverviewRedirect />
""".replace('__TARGET__', json.dumps(target))


class Exporter:
    def __init__(self, vault: Path, manifest: dict):
        self.vault = vault.resolve()
        self.notes = [read_note(self.vault, item) for item in manifest.get('notes', [])]
        if len({n.slug for n in self.notes}) != len(self.notes) or len({n.path for n in self.notes}) != len(self.notes):
            raise ValueError("清单中有重复笔记或 slug")
        self.categories = {}
        for category in manifest.get('categories', []):
            identifier = category['id']
            if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', identifier) or identifier in self.categories:
                raise ValueError("类别 id 必须是唯一的小写英文、数字和连字符组合")
            if identifier in {n.slug for n in self.notes}:
                raise ValueError("类别 id 与笔记 slug 冲突，会生成重复网址")
            self.categories[identifier] = category
        if any(n.category and n.category not in self.categories for n in self.notes):
            raise ValueError("笔记引用了未定义的类别")
        for identifier, category in self.categories.items():
            if category.get('overview'):
                overview = next((n for n in self.notes if n.slug == category['overview']
                                 and n.category == identifier), None)
                if overview is None:
                    raise ValueError("概览必须是同一类别中已列入公开清单的笔记")
                overview.landing = True
        self.allowed_assets = {inside(self.vault, path).resolve() for path in manifest.get('attachments', [])}
        self.used_assets = {}
        self.unlinked = 0

    def resolve_note(self, target: str, source: Note) -> Note | None:
        target = unquote(target).removesuffix('.md')
        local = (source.path.parent / target).resolve()
        matches = []
        for note in self.notes:
            relative = note.path.relative_to(self.vault).as_posix().removesuffix('.md')
            if target in {relative, note.path.stem, note.title, note.permalink} or local == note.path.with_suffix('').resolve():
                matches.append(note)
        if len(matches) > 1:
            raise ValueError("链接目标有重名，请在笔记中使用相对路径")
        return matches[0] if matches else None

    def asset_url(self, target: str, source: Note) -> str:
        target = unquote(target)
        candidates = {(source.path.parent / target).resolve(), (self.vault / target).resolve()}
        matches = self.allowed_assets & candidates
        if not matches:
            matches = {p for p in self.allowed_assets if p.name == target}
        if len(matches) != 1:
            raise ValueError("本地附件未列入清单或存在歧义；请显式列出所需附件")
        path = matches.pop()
        name = hashlib.sha256(path.read_bytes()).hexdigest()[:16] + path.suffix.lower()
        self.used_assets[path] = name
        return f'/knowledge/attachments/{name}'

    def link(self, source: Note, destination: str, label: str, embed: bool = False) -> str:
        parts = urlsplit(destination)
        if parts.scheme in {'http', 'https', 'mailto'}:
            return ('!' if embed else '') + f'[{label}]({destination})'
        if parts.scheme:
            self.unlinked += 1
            return label
        target, _, fragment = destination.partition('#')
        if not target and fragment:
            return f'[{label}](#{quote(anchor(unquote(fragment)))})'
        note = self.resolve_note(target, source)
        if note:
            if embed:
                raise ValueError("首轮版本不展开整篇笔记嵌入；请改用普通笔记链接")
            if fragment.startswith('^'):
                raise ValueError("首轮版本不支持块引用；请使用章节链接")
            source.links.add(note.slug)
            suffix = '#' + quote(anchor(unquote(fragment))) if fragment else ''
            return f'[{label}]({note.url}{suffix})'
        if embed or (Path(target).suffix and Path(target).suffix.lower() != '.md'):
            return ('!' if embed else '') + f'[{label}]({self.asset_url(target, source)})'
        # 不沿链接扩大公开范围，也不为未选中的笔记生成页面。
        self.unlinked += 1
        return label

    def convert(self, note: Note) -> str:
        def transform(part):
            part = re.sub(r'%%.*?%%', '', part, flags=re.S)
            # 先转换普通 Markdown 链接，避免再次处理随后生成的双链目标。
            def markdown(match):
                destination = match.group(3)
                if destination.startswith('<') and destination.endswith('>'):
                    destination = destination[1:-1]
                return self.link(note, destination, match.group(2), bool(match.group(1)))
            part = re.sub(r'(!?)\[([^\]\n]+)\]\((<[^>]+>|[^\s)]+)\)', markdown, part)
            def wiki(match):
                target, separator, label = match.group(2).replace(r'\|', '|').partition('|')
                return self.link(note, target, label if separator else target, bool(match.group(1)))
            return re.sub(r'(!?)\[\[([^\]\n]+)\]\]', wiki, part)
        return outside_code(note.body, transform)

    def sidebar_items(self, notes: list[Note]) -> list[dict]:
        """排序完全来自公开清单；章节不再在站点配置中重复维护。"""
        result = []
        for group in dict.fromkeys(n.group for n in notes):
            grouped = [n for n in notes if n.group == group]
            children = []
            for chapter in dict.fromkeys(n.chapter for n in grouped):
                items = [{'text': n.title, 'link': n.url}
                         for n in grouped if n.chapter == chapter]
                if chapter:
                    children.append({'text': chapter, 'items': items,
                                     'collapsible': True, 'collapsed': False})
                else:
                    children.extend(items)
            if group:
                result.append({'text': group, 'items': children,
                               'collapsible': True, 'collapsed': False})
            else:
                result.extend(children)
        return result

    def write(self, output: Path, *, preview: bool = True, site_source: Path | None = None) -> dict:
        site_source = site_source or Path(__file__).resolve().parents[1] / 'site'
        # 网站入口与知识笔记分开维护，知识页面与附件始终只能由公开清单导出。
        if (site_source / 'public/knowledge').exists() or any(
                p.is_file() and p.relative_to(site_source / 'knowledge').as_posix() != 'index.md'
                for p in (site_source / 'knowledge').rglob('*')):
            raise ValueError('site/knowledge/ 仅允许入口 index.md，知识内容请使用公开清单')
        converted = {note.slug: self.convert(note) for note in self.notes}
        marker = output / '.knowledge-export'
        if output.exists() and any(output.iterdir()) and not marker.exists():
            raise ValueError('输出目录已有其他文件，请使用独立的导出目录')
        if output.resolve().is_relative_to(self.vault):
            raise ValueError('导出目录不能位于知识库内')
        output.mkdir(parents=True, exist_ok=True)
        marker.touch()
        docs = output / 'docs'
        if docs.exists():
            shutil.rmtree(docs)
        shutil.copytree(site_source, docs)
        public = docs / 'public/knowledge'
        (public / 'raw').mkdir(parents=True)
        content = docs / 'knowledge'
        content.mkdir(exist_ok=True)

        def page(path: Path, metadata: dict, body: str = ''):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('---\n' + yaml.safe_dump(metadata, allow_unicode=True,
                            sort_keys=False) + '---\n\n' + body, encoding='utf-8')

        features, navigation, sidebar, categories = [], [], [], []
        for identifier, category in self.categories.items():
            notes = [n for n in self.notes if n.category == identifier]
            if not notes:
                continue
            url = f'/knowledge/{identifier}/'
            description = category.get('description', '')
            features.append({'title': category['title'],
                             'details': f'{description} 共 {len(notes)} 篇笔记。',
                             'link': url})
            navigation.append({'text': category['title'], 'link': url})
            overview = next((n for n in notes if n.landing), None)
            if overview:
                # 领域首页就是概览，侧栏只保留一个概览入口。
                sidebar.append({'text': category['title'], 'items': [
                    {'text': '概览与阅读路线', 'link': url},
                    *self.sidebar_items([n for n in notes if not n.landing]),
                ]})
            else:
                sidebar.append({'text': category['title'], 'link': url,
                                'items': self.sidebar_items(notes)})
            categories.append({'id': identifier, 'title': category['title'],
                               'url': url,
                               'description': overview.description if overview else description,
                               'overview': overview.slug if overview else '',
                               'notes': [n.slug for n in notes]})
            if overview:
                continue  # 正文由下方笔记循环直接生成到领域首页。
            # 未配置概览的领域，仍使用官方组件提供目录入口。
            blocks = ["import { OverviewGroup } from '@rspress/core/theme';", '',
                      f'# {category["title"]}', '', description, '']
            for group in dict.fromkeys(n.group for n in notes):
                grouped = [n for n in notes if n.group == group]
                for chapter in dict.fromkeys(n.chapter for n in grouped):
                    name = ' · '.join(x for x in [group, chapter] if x) or category['title']
                    items = [{'text': n.title, 'link': n.url} for n in grouped if n.chapter == chapter]
                    data = json.dumps({'name': name, 'items': items}, ensure_ascii=False)
                    blocks += [f'<OverviewGroup group={{{data}}} />', '']
            page(content / identifier / 'index.mdx',
                 {'title': category['title'], 'description': description},
                 '\n'.join(blocks))

        # 领域卡片只出现在知识库入口；个人首页独立维护于 site/index.md。
        source = docs / 'knowledge/index.md'
        raw = source.read_text(encoding='utf-8')
        metadata, separator, body = raw[4:].partition('\n---\n')
        if not raw.startswith('---\n') or not separator:
            raise ValueError('知识库入口需要 YAML frontmatter：knowledge/index.md')
        metadata = yaml.safe_load(metadata)
        metadata['features'] = features
        page(source, metadata, body.lstrip('\n'))

        uncategorized = [n for n in self.notes if not n.category]
        if uncategorized:
            sidebar.append({'text': '其他笔记', 'items': self.sidebar_items(uncategorized)})
        theme_config = {
            'nav': [{'text': '知识库', 'link': '/knowledge/', 'items': navigation}],
            'sidebar': {'/knowledge/': sidebar},
        }
        (output / 'theme-config.json').write_text(
            json.dumps(theme_config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

        records = []
        for note in self.notes:
            incoming = [other for other in self.notes if note.slug in other.links and other != note]
            body = converted[note.slug]
            if incoming:
                body += '\n## 引用此笔记\n\n' + '\n'.join(
                    f'- [{other.title}]({other.url})' for other in incoming) + '\n'
            markdown_url = f'/knowledge/raw/{note.slug}.md'
            # .md 使用普通 Markdown 解析；remark-math 在解析期识别公式。
            # 不继承私有 frontmatter，也不把数学改写为 Hugo 简码或 MDX。
            title = self.categories[note.category]['title'] if note.landing else note.title
            page(content / note.url.removeprefix('/knowledge/') / 'index.md',
                 {'title': title, 'description': note.description}, headings(body))
            (public / 'raw' / f'{note.slug}.md').write_text(
                f'# {title}\n\n' + body, encoding='utf-8')
            if note.landing:
                # 保留旧文章路由，使用原生运行时跳转；正文不再生成第二份页面。
                page(content / note.slug / 'index.mdx',
                     {'title': '概览入口', 'pageType': 'blank', 'search': False},
                     redirect_page(note.url))
            records.append({'id': note.slug, 'title': note.title, 'description': note.description,
                            'url': note.url,
                            'markdown': markdown_url, 'category': note.category,
                            'group': note.group, 'chapter': note.chapter,
                            'links': sorted(note.links), 'backlinks': [n.slug for n in incoming]})
            if note.landing:
                records[-1]['aliases'] = [f'/knowledge/{note.slug}/']
        for source, name in self.used_assets.items():
            (public / 'attachments').mkdir(exist_ok=True)
            shutil.copyfile(source, public / 'attachments' / name)
        (public / 'index.json').write_text(
            json.dumps({'categories': categories, 'notes': records}, ensure_ascii=False, indent=2)
            + '\n', encoding='utf-8')
        revision = subprocess.run(['git', '-C', str(self.vault), 'rev-parse', 'HEAD'],
                                  text=True, capture_output=True)
        report = {'notes': len(self.notes), 'categories': len(categories),
                  'attachments': len(self.used_assets), 'links': sum(len(n.links) for n in self.notes),
                  'unpublished_links_as_text': self.unlinked, 'preview': preview,
                  'source_commit': revision.stdout.strip() if revision.returncode == 0 else None}
        (output / 'report.json').write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return report


def export(vault: Path, manifest: Path, output: Path, *, preview: bool = True,
           site_source: Path | None = None) -> dict:
    return Exporter(vault, json.loads(manifest.read_text(encoding='utf-8'))).write(
        output, preview=preview, site_source=site_source)


def main():
    site = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vault', type=Path, default=site / 'knowledge-vault')
    parser.add_argument('--manifest', type=Path, default=site / 'knowledge/publish.json')
    parser.add_argument('--output', type=Path, default=site / '.generated')
    args = parser.parse_args()
    print(json.dumps(export(args.vault, args.manifest, args.output), ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
