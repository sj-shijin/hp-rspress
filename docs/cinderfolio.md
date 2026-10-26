# 个人网站集成 Cinderfolio

网站通过 `cinderfolio/` 子模块引用 [sj-shijin/cinderfolio](https://github.com/sj-shijin/cinderfolio) 的固定提交，`package.json` 继续使用 `"cinderfolio": "file:./cinderfolio"` 加载本地包。子项目的使用方式见 [README](../cinderfolio/README.md)，内部规则见 [维护文档](../cinderfolio/docs/maintenance.md)。

## 归属

```text
cinderfolio/                    # 公开主题子模块，自己的依赖、锁文件、测试与 MIT 许可
theme/CinderfolioTheme.tsx      # Rspress Layout 中的配色状态与全站变量
theme/CinderfolioPreview.tsx    # 三栏选择器、色阶和显示职责
theme/CinderfolioDownload.tsx   # 按当前参数生成 CSS / JSON 下载
theme/MarpPreview.tsx           # 通用 iframe、比例、当前页与底栏操作
theme/DocSlides.tsx             # 从页面关联读取文稿，在 afterDocContent 展示
theme/CinderfolioMermaid.tsx    # 官方 Mermaid 的实时渲染与源码折叠
theme/cinderfolio_mermaid.mjs   # 懒加载、串行配置与绘图，跳过过期请求
theme/cinderfolio.css           # 本站预览组件布局
theme/index.tsx                 # 通过包入口加载 Rspress / Pele / Pseudocode CSS
site/projects/cinderfolio/     # 本站 MDX 展示页，保留现有网址
scripts/build_marp.mjs          # 复制主题、生成本站 HTML、注入主题同步
scripts/site_slides.py          # 显式关联、文稿元数据与构建清单
scripts/build_slides.mjs        # 调用 buildMarp，打包每份文稿的 assets/
scripts/marp_theme_sync.mjs     # 本站同源本地存储协议
scripts/remark_pseudocode.mjs   # 构建期算法块，调用共享渲染器
.generated/cinderfolio/        # 供网站发布的主题和 HTML，生成目录
.generated/slides/             # 关联文稿的 HTML 和素材，生成目录
```

网站组件只使用 `cinderfolio/*` 公开入口，不跨目录引用项目内部文件。`rspress.config.ts` 从包入口加载 Shiki 变量主题，并将主题文件加入构建缓存依赖。

## 安装与构建

```sh
sh scripts/install.sh # 初始化 Cinderfolio 子模块，安装网站及子项目依赖
npm run colors        # 调用 cinderfolio-build，生成纯主题 dist/
npm run marp          # 刷新导出并构建主题样张、关联文稿，只在网站版本注入同步脚本
npm run dev           # 自动准备主题、导出内容并构建演示
npm run build         # 相同准备步骤，随后静态构建和产物检查
npm test              # 先运行独立项目测试，再检查网站导出与集成
npm run test:theme    # 仅运行 Cinderfolio 测试
npm run test:site     # 仅运行网站导出与集成测试
```

本地 `file:` 依赖不会安装子项目的开发依赖，安装脚本和 CI 因此分别安装两份锁文件。手动安装时先执行 `git submodule update --init cinderfolio`，再执行 `npm ci` 和 `npm ci --prefix cinderfolio`。CI 单独初始化这个公开子模块，私有知识库继续使用专用只读密钥。`npm run dev` / `build` 的日常用法不变。

独立开发目录是 `/Users/shijin/Code/cinderfolio`；网站内的 `cinderfolio/` 是另一个检出目录，两者不会自动同步。独立仓库提交并推送后，在网站中更新固定版本：

```sh
git -C cinderfolio fetch origin
git -C cinderfolio checkout --detach origin/main
npm install             # 主题依赖变化时同步网站锁文件
npm ci --prefix cinderfolio
npm test && npm run build
git diff --submodule
git add cinderfolio package-lock.json
git commit -m "chore: 更新 Cinderfolio"
```

```text
Cinderfolio 源码 → cinderfolio/dist/（纯主题，带许可证）
                → scripts/build_marp.mjs
                → .generated/cinderfolio/（本站下载资源与同步 HTML）
                → .generated/site/cinderfolio/（Rspress 发布副本）
```

纯项目构建不会生成网站组件、读取知识库或注入本地存储脚本。网站集成不写回 Cinderfolio 产物；复制静态资源时沿用 `/cinderfolio/` 地址。

## 预览状态与下载

各适配页面共用 `CinderfolioProvider`。深色、浅色、品牌基准色选择器通过 `useHead` 更新全站变量；Shiki 直接引用变量，无需重新分词。调色跨页面保留，刷新后重置；默认方案仍维护在子项目 `palette.mjs`。

深色栏使用 `g15` 浅底，浅色栏使用 `g1` 深底，亮暗切换不反转。亮暗开关与导航共用 Rspress `ThemeContext`。显示职责与选择器的布局属于网站，通用职责定义来自 Cinderfolio。

MDX 单独放置 `CinderfolioDownload`。CSS / JSON 下载使用当前颜色，`/cinderfolio/` 静态文件使用默认种子；CSS 自带 MIT 全文，分享 JSON 时附上 `/cinderfolio/LICENSE`。

Shiki 和 Pele 使用原生双层 Tabs，仅保留必要间距、窄屏换行及选中项画布底色。Mermaid 源码用原生 `details / summary`，与图表共用底色；Pele 的渲染和源码折叠属于网站组件，不进入独立主题项目。

## Mermaid 官方渲染器

网站锁定 Mermaid 12.2.0，Node.js 要求为 22.12+；Cinderfolio 纯主题生成仍支持原来的 Node.js 版本。`mermaid` 围栏默认由 Pele 处理，只有标注 `renderer=mermaid` 才交给 `CinderfolioMermaid`。示例使用原生双层 Tabs 的 `keepDOM={false}`，只挂载当前图表；源码保留原生代码块和折叠样式。

渲染器在组件挂载后懒加载。调色与亮暗变化使用同一 `createMermaidTheme()` 重新绘图，初始化和绘制串行执行，过期请求跳过或丢弃结果。传入实际容器供甘特图等按嵌入宽度排版。正文预览沿用网站字体，独立 JSON 不携带网站字体。下载按钮导出当前配色，静态下载提供默认亮暗配置；无 JavaScript 时仍保留源码与静态下载入口。

## 论文式伪代码

网页与 Marp 共用 `pseudocode` 围栏；语法与示例见 [Cinderfolio 用法](../cinderfolio/README.md#论文式伪代码)。网页的 `remark_pseudocode.mjs` 在 Shiki 前生成算法 HTML，Marp 的围栏渲染调用同一 `renderPseudocode()`。标题编号在每篇文档内从 1 开始，重复构建不受其他页面影响。

算法排版维护于 Cinderfolio 的 `pseudocode.mjs`，导出 `cf-pseudocode.css` 并包含在 Marp 主题内。算法文字与公式采用同一引擎的字体：KaTeX Main 或 MathJax 3 的 TeX Main；中文后备字体分别使用网页文楷与 Marp 的 Noto Sans SC。颜色继续通过 `--cf-*` 变量跟随亮暗与调色。

网页外框由 `rspress.mjs` 适配：独立算法使用与代码块相同的细边框、圆角和留白；作为 Tab 的唯一内容时共用标签外框。源码与渲染结果等多块内容保留各自边框。此规则只作用于 Rspress 页面，Marp 继续使用算法自身的论文式排版。

横线粗细、标题间距与行距沿用 pseudocode.js 原始排版，不额外添加标题内边距；三条横线统一使用比正文淡三级的 `--cf-text-muted`。关键词通过 `light-dark()` 读取 `--cf-accent-darker` 与 `--cf-accent-light`，分别用于浅色与深色主题，与 Shiki 的流程导航色一致。`noEnd` 与 `scopeLines` 在 Cinderfolio 中统一默认为 `true`，默认隐藏块结束行、显示缩进竖线；围栏仍可显式覆盖。

算法容器自行设置字体、字重、行高与对齐。Marp 算法默认 `24px`，与正文和 `compact` 的字号无关；文稿可用 `--cf-pseudocode-font-size` 独立调节算法大小。

MathJax 的普通文字字体来自 `cinderfolio/fonts/mathjax-text/`，使用完整的垂直度量，避免字形越过标题横线；公式仍使用 MathJax 3.2.2 自带的 CHTML 专用字体。构建时将文字字体复制到 `mathjax-fonts/text/`，不通过额外行距或内边距补偿。

网页默认 KaTeX，Marp 跟随文稿的 `math` 设置；围栏 `pseudocode math=katex` / `pseudocode math=mathjax` 可单独指定引擎。[Cinderfolio-Pseudocode](/projects/cinderfolio/pseudocode/) 使用原生 Tabs 对照官方快速排序算法。`scripts/build_marp.mjs` 同时生成网站所需的 MathJax 静态 CSS 与字体资源，网页字体按需加载并独立缓存；独立 Marp HTML 内嵌两套本地公式字体。算法渲染器不进入客户端包，也不请求 CDN。

正式笔记保留算法原始 Markdown；下载与 AI 索引也保留围栏，不把生成的 HTML 写回知识库。

## Marp 集成

网站调用 `buildMarpExample()` 生成主题样张的 16:9 与 4:3 HTML，调用 `buildMarp()` 构建 `.generated/slides.json` 中显式关联的其他文稿；二者都注入 `installMarpThemeSync`。所有文稿共用原有字体资源，每份文稿只额外复制自己的 `assets/`。独立 Cinderfolio 的构建接口不依赖网站清单和 Rspress。

`MarpPreview` 接收标题与「比例 → HTML 地址」映射，不固定文稿地址。将当前颜色写入同源本地存储后，iframe 与独立窗口只替换变量、不重载 HTML，保留当前页码。独立项目的样张没有这层状态同步。

```mdx
<MarpPreview title="演示标题" sources={{
  '16:9': '/slides/sat-cdcl/index.html',
  '4:3': '/slides/sat-cdcl/index-4-3.html',
}} />
```

知识笔记的关联维护于 `knowledge/publish.json`，网站展示页的关联维护于页面前置属性。导出阶段读取文稿的 `title` 与 `size`，生成网页前置属性中的展示信息和独立构建清单；`DocSlides` 通过原生 `afterDocContent` 插槽展示，不改写笔记正文。完整目录与清单示例见 [README](../README.md#配套-marp-演示)。

底栏左侧是独立打开，只有存在多个比例时才显示等宽比例按钮，右侧是 PDF 图标。比例切换和独立打开通过 Marp URL 锚点保留当前页；PDF 调用 iframe 原生打印，用户选择“存储为 PDF”。字体仅由 Marp HTML 加载，网站继续使用文楷。备注来自 Markdown 注释，会进入公开 HTML。

验证范围：主题样张的两个比例、独立文稿比例、文末插槽、亮暗主题、当前页保持、调色同步、窄屏与素材；不重复检查播放器全屏和演讲者模式。同步协议测试维护在 `tests/marp_sync.test.mjs`；独立渲染、SVG ID 和字体哈希测试在 Cinderfolio 内。

修改预览器、Layout 或主题同步时，在本地页面复核下面三条流程。使用任一有双比例演示的笔记和一篇无演示的笔记，无需固定文案、总页数或截图基线：

1. 将演示翻到中间一页，切换比例，再独立打开；两次操作都应保留当前页码。
2. 切换网站亮暗主题，确认 iframe 配色同步、页码保持；检查后恢复原主题和比例。
3. 通过站内导航从有演示的笔记进入无演示的笔记，再返回；文末演示应消失和重新出现，且没有残留的旧文稿。

这些是浏览器验收步骤，不计入 `npm test`。自动化只使用临时样本，覆盖专题顺序与侧栏隔离、同名笔记链接、演示关联的添加／移除，以及小文稿的双比例构建和资源清理。

自动化打印 PDF 时，先切换到打印媒体并等待布局、字体完成，再导出；直接从仅显示一页的播放器立即导出，可能漏掉未完成自动缩放的代码。导出后核对总页数，并实际检查伪代码算法页。

## 许可范围

`cinderfolio/LICENSE` 仅适用于独立主题仓库的原创代码、主题和文档；字体及图片保留第三方授权。它不将个人网站内容、知识库、网页组件或其他目录改授 MIT。两个项目分别维护提交，网站只记录 Cinderfolio 的固定版本。
