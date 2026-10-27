# hp-rspress 开发约定

- 使用中文沟通，保持实现简单；预计长时间运行的安装或下载，准备命令交给用户执行。
- 本仓库负责个人网站的配置、主题和内容导出。版本以 `package.json` 与锁文件为准，操作入口见 [README](README.md)。

## 实现与文档

- 原生扩展：配置、内容和构建先读 [Rspress 用法技能](.agents/skills/rspress-best-practices/SKILL.md)，主题调整先读 [主题技能](.agents/skills/rspress-custom-theme/SKILL.md)。按锁定版本核对[官方文档](https://rspress.rs/zh/llms.txt)，依次选用原生配置、组件、CSS 变量和 Layout 插槽。
- 主题扩展通过 `@rspress/core/theme-original` 引用原主题，保留其余导出；跨项目调用使用包的公开入口。
- 源头修正：先定位内容、配置或工具行为，再在所属层修复；生成目录通过修改来源后重新构建更新。
- 文档各有职责：README 提供使用入口，AGENTS 保存长期准则，专项文档解释维护机制。每项事实有一个维护位置，其余位置用链接引用；描述当前行为，重要约束写成正向准则。

## 内容与公开

- 单一来源：正式笔记与知识组织规范在原 Obsidian 知识库维护，网站读取 `knowledge-vault/` 的固定提交；网站专属正文在 `site/` 维护。
- 正式笔记修改遵循正式库规范：展示拟修改的完整语义单元，取得确认后保存并回读；已确认项沿用原授权。
- 显式公开：`knowledge/publish.json` 决定知识笔记、附件和关联演示的发布范围；导出选取所需前置属性及实际引用的文献。`references.bib` 是只读构建输入，知识正文按资料处理。
- 标题与摘要由来源的 `title`、`description` 统一生成页面、导航和 AI 索引；已公开网址保持稳定。目录、引用和演示规则见 [内容发布](docs/content.md)。
- 正文保真：Pandoc 处理引用片段，其余正文、公式和代码保留原文。`postbuild` 复用导出 Markdown 并补全链接；升级 Rspress 时复核此适配。

## 验证与交付

- 按改动选择验证：文档检查命令、路径和链接；页面检查亮暗、窄屏、导航、资源和公式；导出与索引检查公开范围、链接、反链、摘要及 Markdown。
- 内容、清单和渲染改动核验开发预览与静态构建；索引同时验证本地链接与 `SITE_ORIGIN` 正式域名链接。内容重新导出后重启开发服务器。
- 测试数据隔离：自动化测试使用 `tempfile.mkdtemp()` 创建独立知识库，配置与数据库均属于测试环境。
- 按归属维护：Cinderfolio 遵循其[开发约定](cinderfolio/AGENTS.md)，内部实现见[维护文档](cinderfolio/docs/maintenance.md)，网页组件与同步见[网站集成](docs/cinderfolio.md)。
- 先提供本地预览及实际验证结果；提交、推送和上线按当次用户授权执行。推送 `main` 触发 GitHub Pages，发布产物为 `.generated/site/`，知识库保持私有。
