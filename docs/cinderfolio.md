# 个人网站集成 Cinderfolio

网站通过 `cinderfolio/` 子模块固定主题版本，以 `"cinderfolio": "file:./cinderfolio"` 加载本地包。主题用法见其 [README](../cinderfolio/README.md)，渲染与配色规则见[维护文档](../cinderfolio/docs/maintenance.md)。本文负责网站组件、资源和状态同步。

## 安装与版本更新

`sh scripts/install.sh` 初始化公开子模块并分别安装两个项目的锁定依赖；私有知识库由 CI 使用专用只读密钥获取。手动安装：

```sh
git submodule update --init cinderfolio
npm ci
npm ci --prefix cinderfolio
```

独立开发目录 `/Users/shijin/Code/cinderfolio` 与网站子模块分别维护检出状态。主题提交并推送后，在网站选择新版本：

```sh
git -C cinderfolio fetch origin
git -C cinderfolio checkout --detach origin/main
npm install                  # 同步本地包依赖与网站锁文件
npm ci --prefix cinderfolio
npm test
npm run build
git diff --submodule
# 按本次发布授权提交子模块版本与 package-lock.json。
```

网站使用 `cinderfolio/*` 公开入口。Cinderfolio 负责纯主题与独立渲染，网站负责组件、状态和资源打包；资源复制到网站生成目录，发布地址沿用 `/cinderfolio/`：

```text
cinderfolio/dist/ → scripts/build_marp.mjs → .generated/cinderfolio/
公开文稿关联      → scripts/build_slides.mjs → .generated/slides/
                                               ↓
                                    .generated/site/ 发布副本
```

`npm run dev` / `build` 自动准备主题、导出内容和构建演示。Cinderfolio 的原创内容与第三方资源分别遵循其[许可说明](../cinderfolio/README.md#维护与许可)；个人网站的授权独立管理。

## 配色与下载

`CinderfolioProvider` 通过 `useHead` 更新全站变量；Shiki 使用变量主题，`rspress.config.ts` 将主题文件纳入构建缓存依赖。颜色跨页面保留，刷新后恢复 `palette.mjs` 的默认值。亮暗切换共用 Rspress `ThemeContext`；深色选择栏固定用 `g15` 浅底，浅色栏固定用 `g1` 深底。

`CinderfolioDownload` 生成当前配色的 CSS / JSON，静态下载提供默认种子。CSS 带 MIT 许可，JSON 分发时附上 `/cinderfolio/LICENSE`。各适配页共用原生 `<Tabs className="cf-tabs">`，配色由 Cinderfolio 提供，交互由 Rspress 提供；网站维护选择器、下载按钮及展示页布局。

## 图表与算法

标准 `mermaid` 围栏由 Pele 构建首屏 SVG，浏览器使用 `mountAsync()` 自适应接管，页面卸载时清理监听，加载失败时保留静态 SVG。标注 `renderer=mermaid` 的围栏交给 `CinderfolioMermaid`，在挂载后加载官方渲染器。网站与主题包的运行环境均为 Node.js 22.12+。

Mermaid 使用 `createMermaidTheme()` 响应调色与亮暗变化，初始化和绘制串行执行，过期结果丢弃。实际容器传入渲染器供甘特图等布局；Tabs 使用 `keepDOM={false}` 挂载当前图表。源码使用原生 `details / summary`，静态下载入口与源码可独立读取。

`remark_pseudocode.mjs` 在 Shiki 前调用共享 `renderPseudocode()`，算法编号每篇从 1 开始。网页默认 KaTeX，围栏可指定 `math=katex` / `math=mathjax`；[语法与接入](../cinderfolio/README.md#论文式伪代码)统一在主题项目维护。

网站加载算法 CSS 与公式引擎样式，中文后备字体使用文楷。`scripts/build_marp.mjs` 生成 MathJax 静态 CSS，将公式字体和普通文字字体分别部署到 `mathjax-fonts/` 与其 `text/` 子目录，供浏览器按需加载、缓存。算法 HTML 在构建期生成，正文、下载和 AI 索引保留原始围栏。

## Marp 集成

`buildMarpExample()` 构建主题样张的 16:9、4:3 HTML；`buildMarp()` 构建 `.generated/slides.json` 中的关联文稿。网站为两者注入 `installMarpThemeSync`，共用字体资源，按文稿复制各自的 `assets/`。

`MarpPreview` 接收标题与比例到 HTML 的映射。颜色写入同源本地存储，iframe 与独立窗口更新变量并保留当前页；这层同步由网站提供。

```mdx
<MarpPreview title="演示标题" sources={{
  '16:9': '/slides/sat-cdcl/index.html',
  '4:3': '/slides/sat-cdcl/index-4-3.html',
}} />
```

文稿关联、元数据和公开范围见 [内容发布](content.md#配套-marp-演示)。`DocSlides` 在 `afterDocContent` 插槽展示关联文稿。比例切换和独立打开通过 Marp URL 锚点保留页码，存在多个比例时显示切换按钮；PDF 按钮调用 iframe 原生打印，由用户选择“存储为 PDF”。Marp HTML 加载演示字体，网站正文使用文楷。

## 验证

主题项目验证独立渲染、配色与资源，网站测试验证参数传递、导出关联、组件生命周期及同步。自动化使用临时样本；浏览器检查亮暗、窄屏、比例、文末插槽、页码与素材。

修改预览器、Layout 或同步时，用一篇双比例演示笔记及一篇普通笔记检查：

1. 翻到演示中间一页，切换比例，再独立打开，两次操作均保留页码。
2. 切换网站亮暗，确认 iframe 配色同步、页码保持，检查后恢复原主题与比例。
3. 站内导航到普通笔记再返回，文末演示随页面正确移除和恢复。

验证自动化 PDF 导出时，先切换到打印媒体，等待布局与字体完成，再导出并核对总页数、伪代码页；这保证代码缩放在打印前完成。
