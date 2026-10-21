#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

if ! command -v pandoc >/dev/null 2>&1; then
  printf '请先安装 Pandoc（CI 使用 3.12.1）；macOS 可执行 brew install pandoc。\n' >&2
  exit 1
fi

node -e 'const [m,n]=process.versions.node.split(".").map(Number); if (!((m===20 && n>=19)||(m===22 && n>=12)||m>22)) { console.error("请使用 Node.js 20.19+、22.12+ 或更新版本"); process.exit(1); }'
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
# 安装缓存保留在本项目，不改动全局 npm 配置或缓存权限。
npm install --cache .runtime/npm-cache --no-audit --no-fund
printf '\n安装完成。预览命令：npm run dev\n'
