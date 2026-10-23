#!/usr/bin/env python3
"""将已核验的官方字体分片为 Marp 本地 WOFF2；只在更新字体时运行。"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

from fontTools import subset
from fontTools.ttLib import TTFont
from prepare_fonts import unicode_ranges


# Source URL、版本、原始文件哈希与许可证随资源一起记录；日常构建只复制产物。
FONTS = [
    ('Noto Sans SC', 'NotoSansSC-VF.ttf', '100 900', 'normal',
     'd68bafcb48a2707749396aa12bbbd833cb70401f3a9a689fd2902c7e0d295964'),
    ('Inter', 'InterVariable.woff2', '100 900', 'normal',
     '693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3'),
    ('Inter', 'InterVariable-Italic.woff2', '100 900', 'italic',
     'e564f652916db6c139570fefb9524a77c4d48f30c92928de9db19b6b5c7a262a'),
    ('Sarasa Mono SC', 'SarasaMonoSC-Regular.ttf', '400', 'normal',
     '1be4cbf6e568b44fc83f1abe4c197884fb2b4a788a7c2eb78378b949680805b0'),
    ('Sarasa Mono SC', 'SarasaMonoSC-Bold.ttf', '700', 'normal',
     '3f18d6f258f0814d6979a7da53499e0c12d548ae244c21bd630dfd2d08920dbe'),
    ('Sarasa Mono SC', 'SarasaMonoSC-Italic.ttf', '400', 'italic',
     '05a9489f3754a6579d143fbaef9e45cdbf5f95763775eadbe99ae4d31cb69501'),
    ('Sarasa Mono SC', 'SarasaMonoSC-BoldItalic.ttf', '700', 'italic',
     '207819db06e13541387112d9b6c81fdc3067a24dee39313d3d663a5cbf6346e5'),
]
LICENSES = ['NotoSansSC-OFL.txt', 'Inter-OFL.txt', 'SarasaMonoSC-OFL.txt']


def prepare(source: Path, output: Path):
    common = set()
    for a in range(0xA1, 0xF8):
        for b in range(0xA1, 0xFF):
            common.update(map(ord, bytes([a, b]).decode('gb2312', errors='ignore')))
    common.update(range(0x3000, 0x3100))
    common.update(range(0xFF00, 0xFFF0))

    output.mkdir(parents=True, exist_ok=True)
    styles = ['/* Marp 本地字体；OFL-1.1；由 scripts/prepare_marp_fonts.py 生成。 */']
    report = {
        'versions': {'Noto Sans SC': '2.004', 'Inter': '4.1', 'Sarasa Mono SC': '1.0.42'},
        'sources': {name: {key: entry[key] for key in ['url', 'sha256', 'bytes']}
                    for name, entry in json.loads((source / 'sources.json').read_text()).items()},
        'groups': 'Latin / GB2312 common / extended；保留原始字体的全部 Unicode 字符映射。',
        'fonts': [],
    }
    for family, filename, weight, style, expected_hash in FONTS:
        path = source / filename
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != expected_hash:
            raise ValueError(f'{filename} 与已核验的官方文件不一致')
        with TTFont(path) as original:
            points = set(original.getBestCmap())
        # Inter 已是官方 WOFF2；中文字体按固定字符集分片，不依赖示例里的文字。
        groups = {'all': points} if family == 'Inter' else {
            'latin': {p for p in points if p < 0x2E80},
            'common': {p for p in points & common if p >= 0x2E80},
            'extended': {p for p in points - common if p >= 0x2E80},
        }
        for group, characters in groups.items():
            target = filename if group == 'all' else f'{path.stem}-{group}.woff2'
            if group == 'all':
                shutil.copyfile(path, output / target)
            else:
                font = TTFont(path, recalcTimestamp=False)
                options = subset.Options()
                options.name_IDs = ['*']
                options.name_languages = ['*']
                options.name_legacy = True
                options.layout_features = ['*']
                options.notdef_outline = True
                worker = subset.Subsetter(options=options)
                worker.populate(unicodes=characters)
                worker.subset(font)
                font.flavor = 'woff2'
                font.save(output / target)
                font.close()
            with TTFont(output / target) as generated:
                if set(generated.getBestCmap()) != characters:
                    raise ValueError(f'{target} 的字符映射不完整')
            unicode = '' if group == 'all' else f'\n  unicode-range: {unicode_ranges(characters)};'
            styles.append(f'''@font-face {{
  font-family: "{family}";
  font-style: {style};
  font-weight: {weight};
  font-display: swap;
  src: url("./{target}") format("woff2");{unicode}
}}''')
            report['fonts'].append({
                'family': family, 'file': target, 'weight': weight, 'style': style,
                'characters': len(characters), 'bytes': (output / target).stat().st_size,
                'sha256': hashlib.sha256((output / target).read_bytes()).hexdigest(),
                'source_file': filename, 'source_sha256': digest,
            })
            print(f'{target}: {len(characters)} 字符，{(output / target).stat().st_size} 字节', flush=True)

    for filename in LICENSES:
        shutil.copyfile(source / filename, output / filename)
    (output / 'font.css').write_text('\n\n'.join(styles) + '\n')
    (output / 'SOURCE.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='官方字体、三份许可证与 sources.json 所在目录')
    parser.add_argument('--output', type=Path,
                        default=Path(__file__).resolve().parents[1] / 'cinderfolio/fonts/marp')
    args = parser.parse_args()
    prepare(args.source, args.output)
