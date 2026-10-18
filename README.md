# hp-rspress

ShiJin 的科研知识网站，使用 Rspress 2。

- 网站：<https://shijin.space/>
- 网站代码：<https://github.com/sj-shijin/hp-rspress>

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

## 网页字体

正文、导航、目录与代码使用 [LXGW WenKai Mono GB v1.530](https://github.com/lxgw/LxgwWenkaiGB/releases/tag/v1.530)。
Regular 对应 400，Medium 对应 500；标题与强调文字匹配 Medium，公式继续使用 KaTeX 字体。
网站自托管 WOFF2 字体，按拉丁字符、常用汉字和扩展字符加载，保留原字体的全部 Unicode 字符覆盖。
来源版本、原始文件 SHA-256 与分片信息记录在 `theme/fonts/lxgw-wenkai-mono-gb/SOURCE.json`。
字体遵循 OFL-1.1，原许可证随网页一同发布到 `/fonts/lxgw-wenkai-mono-gb/OFL.txt`。

日常构建直接使用已生成的字体文件。需要重新生成时，从上述官方版本下载
`LXGWWenKaiMonoGB-Regular.ttf`、`LXGWWenKaiMonoGB-Medium.ttf`，并放入同版本的 `OFL.txt`：

```sh
uv run --no-project --with 'fonttools[woff]==4.61.1' python scripts/prepare_fonts.py /path/to/font-sources
```

## 网站标识与导航

左上角采用 M2 柔方 SJ 徽章与 ShiJin 全名，整体链接到首页；顶部菜单仅保留知识库入口。
外轮廓为指数 n = 3 的超椭圆，参考[小米官网图标](https://www.mi.com/global/)的方圆形态。
内部字形基于 [IBM Plex Mono](https://www.ibm.com/plex/) 600，已转为 SVG 轮廓，不额外加载该字体。

SVG 文件位于 `theme/brand/`，通过原生 `logo.light`、`logo.dark` 配置切换墨绿／米白版本；
网站标签页图标使用同一 M2 图形 `sj-favicon.svg`。资源由构建复制到 `/brand/`。
设计参数、字体来源和原始文件 SHA-256 记录在 `theme/brand/SOURCE.json`，
IBM Plex 的原始 OFL-1.1 许可证保存在同目录的 `OFL-IBM-Plex.txt`。

## 自动发布

推送网站 `main` 分支后，`.github/workflows/pages.yml` 自动执行测试、构建和 GitHub Pages 发布；
也可以在 GitHub Actions 中手动运行。仅推送知识库不会自动更新网站，需要更新并提交网站的子模块版本。

构建使用网站记录的子模块提交，通过 `KNOWLEDGE_VAULT_DEPLOY_KEY` 读取私有知识库。
该密钥是知识库仓库的专用只读 Deploy Key，私钥仅保存在网站仓库的 Actions Secret 中。
网站仓库公开，知识库仓库保持私有；公开范围始终由 `knowledge/publish.json` 控制。
只有 `.generated/site/` 被上传为 Pages 发布产物。

GitHub Pages 使用 Actions 作为发布来源，自定义域名在仓库 Pages 设置中绑定。
DNS 指向 GitHub Pages，网站根路径为 `/`。Actions 发布不依赖仓库中的 `CNAME` 文件。
线上构建设置 `SITE_ORIGIN=https://shijin.space`，生成带正式域名的 Markdown 索引；
本地预览不设置该变量，继续使用本机链接。

```sh
# 修改网站代码或更新子模块版本后，推送网站触发部署
git push origin main

# 本地检查与线上相同的构建
SITE_ORIGIN=https://shijin.space npm run build
```

## AI 协作与内容读取

项目开发约定见 `AGENTS.md`。两个官方技能保存在本仓库的 `.agents/skills/`，
通过 `manage-skills` 和 Skills Manager CLI 从共享库导出，供本项目使用。
共享库保留官方 Git 来源与更新记录；这两个技能不做全局部署。

- [rspress-best-practices](https://github.com/rstackjs/agent-skills/tree/main/skills/rspress-best-practices)
- [rspress-custom-theme](https://github.com/rstackjs/agent-skills/tree/main/skills/rspress-custom-theme)

首次从已安装的共享库导出时，在仓库根目录执行：

```sh
"$HOME/.skills-manager/bin/skills-manager-cli" --json skills export rspress-best-practices \
  --dest .agents/skills/rspress-best-practices
"$HOME/.skills-manager/bin/skills-manager-cli" --json skills export rspress-custom-theme \
  --dest .agents/skills/rspress-custom-theme
```

项目中保留实际文件副本，随仓库版本管理；上游 MIT 许可证保存在
`.agents/skills/LICENSE-rstack-agent-skills.txt`。
当前 CLI 的 `deploy/undeploy/status` 面向全局部署，项目目录通过 `export --dest` 写入。
共享库更新不会自动刷新项目副本；更新前先核对项目中的修改，再重新导出。
默认导出不会覆盖已有目录。
