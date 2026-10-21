"""调用与 Rspress 一致的 Markdown 解析器；不重排来源文本。"""
import json
from pathlib import Path
import subprocess


def markdown_tools(action, pages, **options):
    script = Path(__file__).with_suffix('.mjs')
    process = subprocess.run(['node', str(script)],
                             input=json.dumps({'action': action, 'pages': pages, **options}),
                             text=True, capture_output=True)
    if process.returncode:
        raise ValueError(f'Markdown 解析失败：{process.stderr.strip()}')
    return json.loads(process.stdout)
