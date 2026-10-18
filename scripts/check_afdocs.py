#!/usr/bin/env python3
"""分别保存 AFDocs 默认参数与项目仅报告模式的原始检测结果。"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import subprocess


AFDOCS_VERSION = '0.22.2'
ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url', nargs='?', help='覆盖配置中的网址，例如 http://127.0.0.1:1320')
    args = parser.parse_args()
    output = ROOT / '.runtime/afdocs' / datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    output.mkdir(parents=True)
    run = {'afdocs_version': AFDOCS_VERSION, 'runs': []}
    summary = ['默认参数与仅报告模式分开保存；仅报告模式的 PASS 不表示内容差异已修复。']
    exit_code = 0
    print(f'检测报告：{output}', flush=True)
    for name, source in [('default', 'agent-docs.defaults.yml'), ('report', 'agent-docs.config.yml')]:
        # 显式配置避免原始对照意外继承项目阈值；快照保留当次检测口径。
        config = output / f'{name}.config.yml'
        config.write_bytes((ROOT / source).read_bytes())
        command = ['npx', '--yes', f'afdocs@{AFDOCS_VERSION}', 'check']
        if args.url:
            command.append(args.url)
        command += ['--config', str(config), '--format', 'json', '--score']
        print(f'开始 {name} 检测（AFDocs {AFDOCS_VERSION}）', flush=True)
        with (output / f'{name}.log').open('w', encoding='utf-8') as log:
            result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=log,
                                    text=True, encoding='utf-8')
        (output / f'{name}.json').write_text(result.stdout, encoding='utf-8')
        run['runs'].append({'mode': name, 'command': command, 'exit_code': result.returncode})
        (output / 'run.json').write_text(json.dumps(run, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        report = json.loads(result.stdout)
        lines = [f'{name}: {report["url"]}', f'  汇总：{report["summary"]}']
        for check in report['results']:
            if check['id'] in ('markdown-content-parity', 'content-negotiation'):
                lines.append(f'  {check["id"]}: {check["status"]}; {check["message"]}')
        if name == 'report':
            lines.append('  本模式的内容一致性状态仅供报告；是否一致以严格构建检查为准。')
        summary.extend(lines)
        (output / 'summary.txt').write_text('\n'.join(summary) + '\n', encoding='utf-8')
        print('\n'.join(lines), flush=True)
        # 其他检查失败或工具异常仍返回非零，不能被仅报告模式掩盖。
        exit_code = max(exit_code, result.returncode if name == 'report' else int(result.returncode not in (0, 1)))
    print(f'完整结果：{output / "summary.txt"}', flush=True)
    raise SystemExit(exit_code)


if __name__ == '__main__':
    main()
