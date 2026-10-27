# 内容发布

## 来源与公开清单

正式笔记在原 Obsidian 知识库维护，网站从 `knowledge-vault/` 固定提交读取。`knowledge/publish.json` 维护笔记路径、网址、类别、分组、章节和顺序；标题、摘要分别读取笔记的 `title`、`description`，供页面、关联索引与 llms.txt 共用。

公开范围由清单显式决定：导出清单中的笔记、获准附件、关联演示及所需前置属性。双链转换为链接，未公开的目标显示为文字；反链存入关联索引的 `backlinks`。整篇嵌入、块引用及未获允许的附件会中止导出。

`site/knowledge/index.md` 维护知识库入口。网站项目正文在 `site/projects/<id>/` 维护，由 `site/projects.json` 登记页面顺序；各页提供 `title`、`description`，可用 `sidebarTitle` 设置侧栏标签。网站项目与知识库项目共用导航、搜索和 AI 索引，分别从各自来源导出；未登记页面与冲突网址会中止导出。

```text
categories[].overview  → /knowledge/<category>/ 类别首页
普通笔记的 slug         → /knowledge/<slug>/
section: projects      → /projects/ 导航、侧栏与卡片入口
```

知识专题至少有一篇公开笔记时显示入口，入口与菜单按 `categories` 排序；侧栏和上一篇／下一篇限于所属专题。已有网址保持稳定，旧概览网页与 Markdown 地址保留跳转，搜索和 AI 索引收录正式地址。

更新正式库并提交、推送后，在网站选择新版本，再重新构建；开发预览需重启：

```sh
git -C knowledge-vault fetch origin
git -C knowledge-vault checkout --detach origin/main
git diff --submodule
npm run build
```

## 配套 Marp 演示

知识笔记通过公开清单的 `slides` 数组关联文稿；网站项目页在前置属性中使用同名字段：

```json
{
  "path": "SAT求解/CDCL.md",
  "slug": "sat-cdcl",
  "category": "sat",
  "slides": ["slides/sat-cdcl/index.md"]
}
```

文稿在 `slides/<英文标识>/index.md` 维护，素材位于同目录的 `assets/`，使用相对路径：

```markdown
---
marp: true
title: 从 DPLL 到 CDCL
theme: cinderfolio
size: 16:9
paginate: true
---

# 从 DPLL 到 CDCL

<!-- 演讲备注会进入公开 HTML。 -->

---

## 冲突驱动子句学习

![示意图](./assets/diagram.svg)
```

- `title` 是展示标题的唯一来源；`size` 支持 `16:9`、`4:3`。双比例文稿添加 `sizes: ["16:9", "4:3"]`，生成两份 HTML，Markdown 下载保留两个入口。
- `slides` 顺序决定展示顺序，同一文稿可被多篇笔记共用。发布范围包含已关联文稿、演讲备注及其整个 `assets/` 目录。
- `npm run marp` 刷新关联、生成 HTML、打包素材并同步主题；`dev` / `build` 已包含这些步骤。文稿或关联变化后重启开发预览。
- 网页在文末 `afterDocContent` 插槽展示演示；笔记正文独立维护。下载与关联索引保留演示入口，正式域名链接由 `SITE_ORIGIN` 补全。

播放器、资源打包和浏览器验收见 [Marp 集成](cinderfolio.md#marp-集成)。

## 文献引用

文献在正式知识库根目录的 `references.bib` 维护，构建时只读。正文使用 Pandoc 引用：

```markdown
关键结论 [@Regev2004Introduction, pp. 1, 3–4]。
多篇文献 [@Regev2004Introduction, p. 1; @Micciancio2017PointLattices, p. 2]。
```

导出将引用片段交给 Pandoc `--citeproc`，再把编号引用放回原文，其余正文、公式和代码保持原样。`knowledge/author-title.csl` 按首次引用顺序编号，定位留在正文，例如 `[1, pp. 3–4]`；每篇被引用文献在参考文献中展示一次作者、题名、出版信息及来源链接。

来源优先 DOI，其次 URL；`scripts/citation_links.lua` 将链接显示为“DOI”或“原文”，书目锚点带笔记 slug。公开书目限于实际引用条目的上述展示字段，Bib `note` 保留在私有来源。产物检查核验 Pandoc 书目锚点及引用目标，未知文献键或错误语法中止导出并报告来源问题。
