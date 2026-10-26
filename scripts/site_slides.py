"""将显式关联的站内 Marp 文稿登记为构建输入，不扫描未关联的文稿。"""
from pathlib import Path
import re

import yaml


class SlideRegistry:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.entries = {}

    def resolve(self, sources: list[str]) -> list[dict]:
        if not isinstance(sources, list) or any(not isinstance(source, str) for source in sources):
            raise ValueError('slides 必须是 Marp 文稿路径数组')
        slides = []
        for source in dict.fromkeys(sources):
            if source not in self.entries:
                match = re.fullmatch(r'slides/([a-z0-9]+(?:-[a-z0-9]+)*)/index\.md', source)
                if not match:
                    raise ValueError('演示文稿路径须为 slides/<英文标识>/index.md')
                path = self.root / source
                if not path.is_file() or not path.resolve().is_relative_to(self.root / 'slides'):
                    raise ValueError(f'演示文稿不存在或位于 slides 之外：{source}')
                raw = path.read_text(encoding='utf-8')
                frontmatter, separator, _ = raw[4:].partition('\n---\n')
                # Marp 使用 YAML 1.2；避免 PyYAML 将 4:3 等比例按六十进制读成数字。
                metadata = yaml.load(frontmatter, Loader=yaml.BaseLoader) if raw.startswith('---\n') and separator else {}
                if not isinstance(metadata, dict) or metadata.get('marp') != 'true' or not metadata.get('title'):
                    raise ValueError(f'演示文稿需要 marp: true 和 title：{source}')
                size = str(metadata.get('size', '16:9'))
                if size not in {'16:9', '4:3'}:
                    raise ValueError(f'演示文稿 size 须为 16:9 或 4:3：{source}')
                sizes = metadata.get('sizes', [size])
                if not isinstance(sizes, list) or not sizes or any(value not in {'16:9', '4:3'} for value in sizes):
                    raise ValueError(f'演示文稿 sizes 须为 16:9、4:3 的非空数组：{source}')
                if size not in sizes:
                    raise ValueError(f'演示文稿 sizes 须包含默认 size：{source}')
                # 默认比例保持 index.html，新增比例使用独立文件；一份源稿维护全部内容。
                sources = {}
                for value in dict.fromkeys([size, *sizes]):
                    suffix = '-' + value.replace(':', '-') if value != size else ''
                    sources[value] = f'/slides/{match[1]}/index{suffix}.html'
                # 该文稿的 assets/ 是随演示公开的素材，不能链接到私有目录。
                assets = path.parent / 'assets'
                if assets.is_symlink() or any(asset.is_symlink() for asset in assets.rglob('*')):
                    raise ValueError(f'演示素材不能使用符号链接：{source}')
                self.entries[source] = {'source': source, 'title': str(metadata['title']),
                                        'src': f'/slides/{match[1]}/index.html', 'size': size}
                if len(sources) > 1:
                    self.entries[source]['sources'] = sources
            slides.append({key: value for key, value in self.entries[source].items() if key != 'source'})
        return slides


def slides_markdown(slides: list[dict]) -> str:
    """Markdown 下载保留演示入口，笔记正文和 Marp 源稿继续独立维护。"""
    if not slides:
        return ''
    links = []
    for slide in slides:
        if slide.get('sources'):
            links.extend(f'- [{slide["title"]} · {size}]({src})' for size, src in slide['sources'].items())
        else:
            links.append(f'- [{slide["title"]}]({slide["src"]})')
    return '\n\n## 配套演示\n\n' + '\n'.join(links) + '\n'
