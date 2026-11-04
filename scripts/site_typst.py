"""只编译公开页面的 Typst 围栏；临时项目内只提供对应的配色模块。"""
import hashlib
import json
from pathlib import Path
import tempfile

import typst

from markdown_tools import markdown_tools


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
                entry = root / source.with_suffix('.typ')
                entry.parent.mkdir(parents=True, exist_ok=True)
                if key in note_paths:
                    module = Path('.typst/cinderfolio.typ')
                    palette = vault / module
                    if palette.is_file():
                        if palette.resolve() != vault.resolve() / module:
                            raise ValueError(f'Typst 配色模块必须是仓库内的普通文件：{module}')
                        (root / module).parent.mkdir(exist_ok=True)
                        (root / module).write_bytes(palette.read_bytes())
                else:
                    (entry.parent / 'cinderfolio.typ').write_text(parsed['theme'], encoding='utf-8')

                figures[key] = {}
                for block in blocks:
                    code = block['code']
                    entry.write_text(code, encoding='utf-8')
                    try:
                        # 私有仓库不是编译根目录；相对导入仍按笔记的原始位置解析。
                        result = typst.compile(entry, root=root, format='svg', package_path=root / 'packages')
                    except typst.TypstError as error:
                        raise ValueError(
                            f'Typst 编译失败：{source}（导出页 {key}:{block["line"]}）\n{error.diagnostic}'
                        ) from error
                    urls = []
                    for svg in ([result] if isinstance(result, bytes) else result):
                        name = hashlib.sha256(svg).hexdigest()[:20] + '.svg'
                        target = docs / 'public' / 'typst' / name
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(svg)
                        urls.append('/typst/' + name)
                    figures[key][code] = urls

    (docs.parent / 'typst.json').write_text(json.dumps(figures, ensure_ascii=False), encoding='utf-8')
