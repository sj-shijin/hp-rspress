"""只编译公开页面的 Typst 围栏；临时项目内只提供对应的配色模块。"""
import hashlib
import json
from pathlib import Path
import tempfile
import xml.etree.ElementTree as ET

import typst

from markdown_tools import markdown_tools


# 只在网站的临时项目中覆盖配色模式，保留模块的其他导出和原笔记中的调用。
WEB_PALETTE = '''#import ".source-palette.typ": *
#let cf-palette(mode: "light") = {
  import ".source-palette.typ" as original
  original.cf-palette(mode: sys.inputs.at("site-theme", default: mode))
}
'''

WEB_DOCUMENT = '''#import ".site-palette.typ": cf-palette
#let colors = cf-palette(mode: sys.inputs.at("site-theme"))
#set page(fill: colors.background)
#set text(fill: colors.foreground)
#include '''


def prepare_project(root, source, theme, vault):
    entry = root / source.with_suffix('.typ')
    entry.parent.mkdir(parents=True, exist_ok=True)
    document = root / '.site-figure.typ'
    include_path = json.dumps('/' + entry.relative_to(root).as_posix(), ensure_ascii=False)
    document.write_text(WEB_DOCUMENT + include_path, encoding='utf-8')
    (root / '.site-palette.typ').write_text(theme, encoding='utf-8')

    if vault is None:
        palette = entry.parent / 'cinderfolio.typ'
        original = theme
    else:
        module = Path('.typst/cinderfolio.typ')
        source_palette = vault / module
        if not source_palette.is_file():
            return entry, document
        if source_palette.resolve() != vault.resolve() / module:
            raise ValueError(f'Typst 配色模块必须是仓库内的普通文件：{module}')
        palette = root / module
        original = source_palette.read_text(encoding='utf-8')
    palette.parent.mkdir(parents=True, exist_ok=True)
    palette.with_name('.source-palette.typ').write_text(original, encoding='utf-8')
    palette.write_text(WEB_PALETTE, encoding='utf-8')
    return entry, document


def compile_pages(document, root, mode, image_dir):
    result = typst.compile(document, root=root, format='svg', package_path=root / 'packages',
                           sys_inputs={'site-theme': mode})
    pages = []
    for svg in ([result] if isinstance(result, bytes) else result):
        name = hashlib.sha256(svg).hexdigest()[:20] + '.svg'
        (image_dir / name).write_bytes(svg)
        # Typst 的 SVG 尺寸以 pt 表示。用 CSS 像素预留原图位置，懒加载时正文不会跳动。
        root_svg = ET.fromstring(svg)
        width, height = (round(float(root_svg.attrib[key].removesuffix('pt')) * 96 / 72)
                         for key in ('width', 'height'))
        pages.append({'src': '/typst/' + name, 'width': width, 'height': height})
    return pages


def render_typst(docs: Path, vault: Path, note_paths: dict[str, Path]):
    pages = {}
    for path in sorted(docs.rglob('*')):
        key = path.relative_to(docs)
        if key.parts[0] == 'public' or path.suffix not in {'.md', '.mdx'}:
            continue
        markdown = path.read_text(encoding='utf-8')
        if 'typst' in markdown:
            pages[key.as_posix()] = {'markdown': markdown}

    figures = {}
    if pages:
        parsed = markdown_tools('typst', list(pages.values()))
        for key, blocks in zip(pages, parsed['blocks']):
            if not blocks:
                continue
            source = note_paths.get(key, Path(key))
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                entry, document = prepare_project(root, source, parsed['theme'], vault if key in note_paths else None)
                image_dir = docs / 'public/typst'
                image_dir.mkdir(parents=True, exist_ok=True)
                figures[key] = {}
                for block in blocks:
                    code = block['code']
                    entry.write_text(code, encoding='utf-8')
                    variants = {}
                    for mode in ('light', 'dark'):
                        try:
                            variants[mode] = compile_pages(document, root, mode, image_dir)
                        except typst.TypstError as error:
                            raise ValueError(
                                f'Typst 编译失败：{source}（导出页 {key}:{block["line"]}，{mode}）\n{error.diagnostic}'
                            ) from error
                    figures[key][code] = variants

    (docs.parent / 'typst.json').write_text(json.dumps(figures, ensure_ascii=False), encoding='utf-8')
