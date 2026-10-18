# hp-rspress

ShiJin 的科研知识网站，使用 Rspress 2。当前只做本地预览，未绑定域名、未发布到线上。

## 安装与预览

需要 Node.js 20.19+／22.12+ 和 Python 3。

```sh
sh scripts/install.sh
npm run build
npm run preview
```

访问 `http://127.0.0.1:1320/`。网页仅监听本机。

知识库以私有 Git 子模块接入，`knowledge/publish.json` 是网页内容的唯一公开清单。
正式笔记仍在 Obsidian 知识库维护；不在子模块副本中编辑。
导出的网页源文件和构建结果位于被 Git 忽略的 `.generated/`，完整知识库不会进入网站构建目录。

## 内容与构建

```sh
npm run export  # 按清单生成正文、目录、反链、原始 Markdown 和关联索引
npm run build   # 导出后执行 Rspress 静态构建，包含 SSG-MD
npm run preview # 预览已构建的静态站点
npm run dev     # 开发时热更新；修改知识库或清单后重新启动
npm test        # 使用独立临时知识库检查公开范围、链接、公式及附件
```

构建链路：

```text
私有知识库子模块的固定提交
  → knowledge/publish.json 中的笔记与实际引用的允许附件
  → .generated/docs/（Rspress 内容输入）
  → .generated/site/（唯一的网站发布产物）
```

首页使用官方 Home 布局与领域入口；领域页使用官方 `OverviewGroup` 分组文字卡片。
侧栏按清单中的 `category`、`group`、`chapter` 和笔记顺序生成。
普通笔记保留 `.md`，双链和章节链接在导出时转换，并生成反向链接。
公式通过 `remark-math` 与 `rehype-katex` 渲染，不修改知识库原文。
整篇笔记嵌入、块引用及未获允许的附件会中止导出；未公开笔记链接显示为文字。

现有笔记网址继续使用 `/knowledge/<slug>/`。
`/knowledge/index.json` 提供类别、链接与反链，`/knowledge/raw/<slug>.md` 提供内容副本。
Rspress 的 SSG-MD 另生成 `llms.txt`、`llms-full.txt` 和每页的 Markdown；均只来自本次导出内容。
Rspress 2.0 的 SSG-MD 会转义部分 LaTeX；`postbuild` 用已导出的 Markdown 校正笔记副本，
再按原生 `llms.txt` 索引重建全文，保证公式与链接内容一致。

本地预览默认不读取正式知识库中尚未提交的修改。
修改公开范围后重新启动预览；更新笔记版本时，先在正式库提交并推送，再更新网站的子模块：

```sh
git -C knowledge-vault fetch origin
git -C knowledge-vault checkout --detach origin/main
git diff --submodule
npm run dev
```

当前未创建 GitHub 远程仓库或自动发布工作流。
后续上线时，私有库仍保持私有，构建固定到网站记录的提交，并仅上传 `.generated/site/`。
