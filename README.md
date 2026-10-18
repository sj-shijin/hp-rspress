# hp-rspress

ShiJin 的个人网站，使用 Rspress 2 构建，包含个人主页与知识库。

- 网站：<https://shijin.space/>
- 代码：<https://github.com/sj-shijin/hp-rspress>

## 本地使用

需要 Node.js 20.19+／22.12+ 和 Python 3。

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
site/                   # 个人主页、知识库入口等网站专属正文
  index.md              # /
  knowledge/index.md    # /knowledge/
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
公开清单维护笔记摘要、领域、分组、章节和顺序；导出不继承私有 frontmatter，也不沿链接扩大公开范围。
`site/knowledge/` 仅维护入口 `index.md`，领域页面和附件由清单生成。

`categories[].overview` 指定的概览正文作为 `/knowledge/<category>/` 领域首页，
普通笔记使用 `/knowledge/<slug>/`。旧概览网页与 Markdown 地址继续兼容，搜索和 AI 索引不重复收录。
双链在导出时转换并生成反链；未公开笔记链接显示为文字，整篇嵌入、块引用及未获允许的附件会中止导出。

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
  → .generated/docs/ → Rspress → Markdown 校正 → 产物检查
  → .generated/site/
```

- `/llms.txt`：按领域、分组和章节发现笔记，链接与摘要来自公开清单。
- `/llms-full.txt`：按上述索引合并的全文。
- `/knowledge/<slug>/index.md`、`/knowledge/raw/<slug>.md`：单篇 Markdown 与下载副本。
- `/knowledge/index.json`：单独标识的 JSON 辅助资源，提供链接、反链与旧地址。
- `/sitemap.xml`：官方插件生成的公开页面索引，排除旧概览跳转页和 404。

使用标准的 `mermaid` 围栏代码块编写图表：Pele 1.6.0 在构建时生成 SVG，页面保留可展开的源码，Markdown／AI 接口保留原始 Mermaid。
配色随网站亮暗主题切换，字体继承文楷；手写固定颜色会覆盖主题配色。
语法错误会中止构建。

`postbuild` 校正 Rspress 2.0 SSG-MD 的 LaTeX 转义，恢复 AI 导航提示，并按 `SITE_ORIGIN` 补全链接。
构建检查核对公开范围、搜索、链接、提示及 sitemap，逐个比较公式并双向核验正文。
检查失败会中止构建，报告见 `.generated/build-check.json`。
AFDocs 固定使用 0.22.2（需要 Node.js 22+）；通用正文比较可能误报 KaTeX，公式与正文一致性继续由上述严格构建检查验证。
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
