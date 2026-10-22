"""网站专属项目的显式页面登记，与私有知识库公开清单分开。"""
import json
from pathlib import Path
import re

import yaml


def read_site_projects(site: Path) -> list[dict]:
    manifest = site / 'projects.json'
    entries = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
    projects, allowed, ids = [], {'index.md'}, set()
    for entry in entries:
        identifier = entry['id']
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', identifier) or identifier in ids:
            raise ValueError('网站项目 id 必须唯一且使用小写英文、数字和连字符')
        ids.add(identifier)
        names = entry['pages']
        if not names or names[0] != 'index' or len(set(names)) != len(names):
            raise ValueError('网站项目 pages 必须以 index 开始且不重复')
        pages = []
        for name in names:
            if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', name):
                raise ValueError('网站项目页面名只能使用小写英文、数字和连字符')
            route = f'{identifier}/' + (f'{name}/' if name != 'index' else '')
            candidates = [site / 'projects' / route / f'index{suffix}' for suffix in ['.md', '.mdx']]
            sources = [source for source in candidates if source.is_file()]
            if len(sources) != 1:
                raise ValueError(f'网站项目页面需要唯一的 index.md 或 index.mdx：{route}')
            source = sources[0]
            if not source.resolve().is_relative_to((site / 'projects').resolve()):
                raise ValueError('网站项目页面不能位于 site/projects 之外')
            allowed.add(source.relative_to(site / 'projects').as_posix())
            raw = source.read_text(encoding='utf-8')
            frontmatter, separator, _ = raw[4:].partition('\n---\n')
            if not raw.startswith('---\n') or not separator:
                raise ValueError(f'网站项目页面需要 YAML frontmatter：{route}')
            metadata = yaml.safe_load(frontmatter)
            if not metadata.get('title') or not metadata.get('description'):
                raise ValueError(f'网站项目页面需要 title 和 description：{route}')
            pages.append({'title': metadata['title'],
                          'label': metadata.get('sidebarTitle', metadata['title']),
                          'description': metadata['description'], 'url': f'/projects/{route}'})
        projects.append({'id': identifier, 'title': pages[0]['title'],
                         'description': pages[0]['description'], 'url': pages[0]['url'], 'pages': pages})
    actual = {p.relative_to(site / 'projects').as_posix()
              for p in (site / 'projects').rglob('*') if p.is_file()}
    if actual - allowed:
        raise ValueError('site/projects 页面需列入网站项目清单 site/projects.json；知识内容请使用公开清单')
    return projects
