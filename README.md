# hp-rspress

ShiJin 的个人网站，使用 Rspress 2 构建，包含个人主页、知识库与项目记录。

- 网站：<https://shijin.space/>
- 代码：<https://github.com/sj-shijin/hp-rspress>

## 本地使用

需要 Node.js 20.19+／22.12+、Python 3 和 Pandoc；CI 固定使用 Pandoc 3.12.1。
本机未安装 Pandoc 时先执行 `brew install pandoc`（macOS），其他系统使用 [官方安装包](https://github.com/jgm/pandoc/releases/tag/3.12.1)。

```sh
sh scripts/install.sh  # 首次安装依赖
npm run dev           # 开发预览；修改内容或公开清单后需重启
npm run build         # 导出、构建、校正 Markdown 并检查产物
npm run preview       # 预览已构建的静态网站
npm test              # 使用独立临时知识库运行测试
npm run check:build   # 单独检查现有构建产物
```

预览地址为 `http://127.0.0.1:1320/`，仅监听本机。

## 项目目录

```text
site/                   # 个人主页、知识库与项目入口等网站专属正文
  index.md              # /
  knowledge/index.md    # /knowledge/
  projects/index.md     # /projects/
theme/                  # 样式、字体与标识资源
knowledge/publish.json  # 知识库笔记与附件的唯一公开清单
knowledge-vault/        # 私有知识库的固定版本子模块
scripts/                # 内容导出、Markdown 校正与产物检查
.generated/docs/        # 生成的 Rspress 输入，不提交
.generated/site/        # 唯一发布产物，不提交
.runtime/               # 本地日志，不提交
```

开发约定见 [AGENTS.md](AGENTS.md)，框架与主题用法见 `.agents/skills/`。
项目技能来自 [rstackjs/agent-skills](https://github.com/rstackjs/agent-skills)，
通过 Skills Manager 导出为项目副本；更新时先更新共享库，再重新导出，不做全局部署。

## 知识库内容

正式笔记在 Obsidian 知识库维护，不在子模块副本中编辑。
公开清单维护笔记路径、网址、类别、分组、章节和顺序；标题和摘要直接读取笔记的 `title`、`description`，不重复维护。
导出只选取需要的前置属性，不沿链接扩大公开范围。
`site/knowledge/` 与 `site/projects/` 仅维护入口 `index.md`，正文和附件由清单生成。

`categories[].overview` 指定的概览正文作为类别首页，默认位于 `/knowledge/<category>/`，
普通笔记使用 `/knowledge/<slug>/`。类别指定 `section: projects` 时，使用独立的 `/projects/` 导航、侧栏和卡片入口。旧概览网页与 Markdown 地址继续兼容，搜索和 AI 索引不重复收录。
双链在导出时转换，反链仅保存在关联索引的 `backlinks` 字段，不追加到正文；未公开笔记链接显示为文字，整篇嵌入、块引用及未获允许的附件会中止导出。

文献在知识库根目录的 `references.bib` 维护，正文使用 Pandoc 引用：

```markdown
关键结论 [@Regev2004Introduction, pp. 1, 3–4]。
多篇文献 [@Regev2004Introduction, p. 1; @Micciancio2017PointLattices, p. 2]。
```

导出时仅把引用片段交给 Pandoc `--citeproc`，将生成的编号引用放回原文；正文、公式、代码与 Mermaid 不重新序列化。
`knowledge/author-title.csl` 按首次引用顺序编号，定位保留在正文，例如 `[1, pp. 3–4]`；“参考文献”中每篇只展示一次完整作者、题名、出版信息，不输出 Bib 的 `note`。
来源链接优先使用 DOI，否则使用 URL；`scripts/citation_links.lua` 仅将链接缩为“DOI”或“原文”，并为书目锚点加上笔记 slug，合并全文时不会串引。书目文件不整库发布，未引用条目不会导出。
Rspress 2.0 的内置锚点检查仅登记标题；书目使用 Pandoc 原生 `div` 锚点，由产物检查核验引用目标存在且不重复。
未知文献键或不正确的引用语法会报告来源问题，不自动改写知识库。

预览使用子模块的固定提交，不读取正式库中尚未提交的修改。
更新笔记时，先在正式库提交并推送，再更新网站的子模块版本、检查差异并重新构建：

```sh
git -C knowledge-vault fetch origin
git -C knowledge-vault checkout --detach origin/main
git diff --submodule
```

## 构建与 AI 读取

```text
网站正文 + 私有子模块中的公开内容
  → 读取笔记摘要、转换文献引用 → .generated/docs/
  → Rspress → 复用导出的 Markdown、补全链接 → 产物检查
  → .generated/site/
```

- `/llms.txt`：按公开清单的领域、分组和章节发现笔记，摘要来自笔记属性。
- `/llms-full.txt`：按上述索引合并的全文。
- `/knowledge/<slug>/index.md`、`/knowledge/raw/<slug>.md`：单篇 Markdown 与下载副本。
- `/knowledge/index.json`：单独标识的 JSON 辅助资源，提供链接、反链与旧地址。
- `/sitemap.xml`：官方插件生成的公开页面索引，排除旧概览跳转页和 404。

使用标准的 `mermaid` 围栏代码块编写图表：Pele 1.6.0 在构建时生成首屏 SVG，含图页面在浏览器中按需使用 `mountAsync()` 接管，随容器宽度自动重排。
配色随网站亮暗主题切换，字体继承文楷；页面保留可展开的源码，Markdown／AI 接口保留原始 Mermaid。
手写固定颜色会覆盖主题配色，语法错误会中止构建；离开图表页面时清理监听，渲染器加载失败时保留静态 SVG。

Rspress 2.0 SSG-MD 不运行自定义数学插件，会重新转义 LaTeX；`postbuild` 复用同一份导出 Markdown 作为标准入口与下载副本，保留公式与文献引用，并补充 AI 导航提示及 `SITE_ORIGIN` 链接。
构建检查核对公开范围、摘要、搜索、链接、提示及 sitemap；不比较 HTML 与 Markdown 的正文文本。
公式保留由引用转换测试验证，公式和 Mermaid 的语法错误由各自渲染器报告。
检查失败会中止构建，报告见 `.generated/build-check.json`。
AFDocs 固定使用 0.22.2（需要 Node.js 22+）；通用正文比较可能误报公式和脚注，差异保留供人工核对。
`agent-docs.config.yml` 仅将该项设为仅报告，保留差异数据；`agent-docs.defaults.yml` 不覆盖任何检查参数，保留原始对照口径。

```sh
npm run check:afdocs                            # 读取线上网站，同时保存两套检测结果
npm run check:afdocs -- http://127.0.0.1:1320    # 检测已启动的本地静态预览
```

每次在 `.runtime/afdocs/<时间戳>/` 保存 `default.json`、`report.json`、配置快照、命令记录和摘要，不覆盖历史结果。
仅报告模式的 PASS 不表示差异已修复，分数不能与默认参数直接比较；其他检查失败仍返回非零。
内容协商由 ESA 边缘提供；WebMCP 尚未接入。

## 部署

推送网站 `main` 会触发 `.github/workflows/pages.yml`，执行测试、构建并发布到 GitHub Pages。
构建通过只读 `KNOWLEDGE_VAULT_DEPLOY_KEY` 获取私有知识库的固定提交，仅上传 `.generated/site/`。
知识库仓库保持私有；仅推送知识库不会更新网站，还需提交网站中的子模块版本。

自定义域名继续在 GitHub Pages 设置中绑定；阿里云 DNS 通过 CNAME 指向 ESA，由 ESA 回源 GitHub Pages。
边缘规则、验收基线和回退方法见 [ESA 运维记录](docs/esa.md)。
线上设置 `SITE_ORIGIN=https://shijin.space`；本地默认使用本机路径。
构建缓存随 `SITE_ORIGIN` 切换失效。检查正式域名产物时，构建与检查需使用相同的变量：

```sh
SITE_ORIGIN=https://shijin.space npm run build
SITE_ORIGIN=https://shijin.space npm run check:build
```
