#!/usr/bin/env python3
"""从 Rspress 内置 sitemap 中排除公开索引登记的兼容旧地址。"""
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET


def finalize_sitemap(output: Path) -> dict:
    index = json.loads((output / 'knowledge/index.json').read_text(encoding='utf-8'))
    excluded = {'/404.html'} | {
        alias for note in index['notes'] for alias in note.get('aliases', [])
    }
    path = output / 'sitemap.xml'
    sitemap = ET.parse(path)
    root = sitemap.getroot()
    removed = 0
    for page in root.findall('{*}url'):
        location = page.findtext('{*}loc', '')
        if unquote(urlsplit(location).path) in excluded:
            root.remove(page)
            removed += 1
    ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    sitemap.write(path, encoding='utf-8', xml_declaration=True)
    return {'sitemap_pages': len(root.findall('{*}url')), 'excluded_pages': removed}


if __name__ == '__main__':
    site = Path(__file__).resolve().parents[1]
    print(json.dumps(finalize_sitemap(site / '.generated/site'), ensure_ascii=False))
