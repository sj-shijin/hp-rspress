# hp-rspress

ShiJin 的个人网站，使用 Rspress 2 构建，包含个人主页、知识库与项目记录。

[网站](https://shijin.space/) · [代码](https://github.com/sj-shijin/hp-rspress) · [开发约定](AGENTS.md)

## 本地使用

需要 Node.js 22.12+、Python 3 和 Pandoc；CI 使用 Node.js 24 与 Pandoc 3.12.1。macOS 可用 `brew install pandoc` 安装，其他系统见[官方安装包](https://github.com/jgm/pandoc/releases/tag/3.12.1)。

```sh
sh scripts/install.sh # 首次安装依赖
npm run dev           # 导出并启动开发预览；内容或清单更新后重启
npm run build         # 导出、静态构建、校正 Markdown 并检查产物
npm run preview       # 预览已构建的网站
npm run colors        # 单独导出 Cinderfolio 主题
npm run marp          # 刷新内容关联并构建演示
npm test              # Cinderfolio 与网站全量测试
npm run test:theme    # Cinderfolio 配色、渲染、资源与 CLI
npm run test:site     # 网站导出、索引、产物检查器与前端适配
npm run check:build   # 检查现有构建产物；build 已自动执行
```

开发与静态预览地址为 `http://127.0.0.1:1320/`，监听本机。正文改动执行构建并检查受影响页面；主题、依赖改动或发布前运行全量测试。页面交互另做浏览器验收，Marp 预览器的验收流程见[网站集成](docs/cinderfolio.md#验证)。

## 目录与维护入口

```text
site/                   # 个人主页、知识库入口与网站项目正文
site/projects.json      # 网站项目的页面清单
slides/<id>/            # Marp 文稿 index.md 与公开素材 assets/
rspress.config.ts       # 网站配置
theme/                  # 网页组件、样式、字体与标识
cinderfolio/            # 公开主题仓库的固定版本子模块
knowledge/publish.json  # 知识笔记、附件与演示的公开清单
knowledge-vault/        # 私有知识库的固定版本子模块
scripts/                # 导出、渲染、Markdown 校正与产物检查
.generated/             # 本地生成目录；site/ 子目录为发布产物
.runtime/               # 本地日志与检测报告
```

- [内容发布](docs/content.md)：笔记、网站项目、文献与演示的维护和导出。
- [Cinderfolio 集成](docs/cinderfolio.md)：主题版本更新、网页组件、调色同步与资源打包。
- [Cinderfolio 用法](cinderfolio/README.md)与[维护文档](cinderfolio/docs/maintenance.md)：独立主题的接入、渲染与实现规则。
- [ESA 运维](docs/esa.md)：内容协商、缓存、验收基线与回退。

Rspress 技能来自 [rstackjs/agent-skills](https://github.com/rstackjs/agent-skills)，通过 Skills Manager 导出到 `.agents/skills/`；更新流程为更新共享库后重新导出项目副本。

## 构建与 AI 读取

```text
site/ 正文 + knowledge/publish.json 中的笔记与演示
  → 导出正文、摘要、引用和关联索引 → .generated/docs/
  → Rspress 静态构建 → 复用导出 Markdown、补全链接、检查产物
  → .generated/site/
```

- `/llms.txt`：按领域、分组和章节组织的索引，摘要来自来源属性。
- `/llms-full.txt`：按索引顺序合并的全文。
- `/knowledge/<slug>/index.md`、`/knowledge/raw/<slug>.md`：单篇 Markdown 与下载副本。
- `/knowledge/index.json`：链接、反链和旧地址等关联信息。
- `/sitemap.xml`：官方插件生成的公开页面索引，收录正式地址。

标准 `mermaid` 围栏由 Pele 在构建时生成 SVG，浏览器按需接管并随容器重排；配色跟随网站亮暗主题，源码可展开。公式和图表的语法由各自渲染器检查。Markdown 与 AI 入口保留原始公式、代码和图表源码，具体集成见 [Cinderfolio 集成](docs/cinderfolio.md)。

Rspress 2.0 的 SSG-MD 会重新转义 LaTeX，`postbuild` 因此复用导出 Markdown。构建检查核验公开范围、摘要、搜索、链接、提示与 sitemap；失败时中止构建，报告写入 `.generated/build-check.json`。

AFDocs 0.22.2 提供外部检测，公式与脚注的正文比较差异由人工核对：

```sh
npm run check:afdocs                         # 检测线上网站
npm run check:afdocs -- http://127.0.0.1:1320 # 检测已启动的本地静态预览
```

每次结果保存在 `.runtime/afdocs/<时间戳>/`，包括 `default.json`、`report.json`、配置快照、命令与摘要。默认配置保留工具原始口径；项目配置将正文比较设为仅报告，其 PASS 表示检测已完成，差异仍需核对。两种评分分别解读，其余检查失败返回非零。

## 部署

推送 `main` 触发 [GitHub Pages 工作流](.github/workflows/pages.yml)，执行测试、构建并上传 `.generated/site/`。Cinderfolio 经 HTTPS 获取固定版本；私有知识库通过只读 `KNOWLEDGE_VAULT_DEPLOY_KEY` 获取固定提交。知识库更新通过网站的子模块版本进入下一次发布。

GitHub Pages 绑定 `shijin.space`，阿里云 DNS 指向 ESA，ESA 回源 GitHub Pages。线上构建设置 `SITE_ORIGIN`，本地默认使用本机路径；构建与产物检查使用同一值：

```sh
SITE_ORIGIN=https://shijin.space npm run build
SITE_ORIGIN=https://shijin.space npm run check:build
```

[Cinderfolio 的 MIT 许可](cinderfolio/LICENSE) 覆盖该子项目的原创内容；网站、知识库及第三方资源的授权分别管理。
