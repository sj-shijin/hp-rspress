# 个人网站集成 Cinderfolio

网站通过 `package.json` 中的 `"cinderfolio": "file:./cinderfolio"` 引用独立项目，保留通用 Rspress 主题。子项目的使用方式见 [README](../cinderfolio/README.md)，内部规则见 [维护文档](../cinderfolio/docs/maintenance.md)。

## 归属

```text
cinderfolio/                    # 独立主题项目，自己的依赖、锁文件、测试与 MIT 许可
theme/CinderfolioTheme.tsx      # Rspress Layout 中的配色状态与全站变量
theme/CinderfolioPreview.tsx    # 三栏选择器、色阶和显示职责
theme/CinderfolioDownload.tsx   # 按当前参数生成 CSS / JSON 下载
theme/CinderfolioMarp.tsx       # iframe、比例、当前页与底栏操作
theme/cinderfolio.css           # 本站预览组件布局
theme/index.tsx                 # 通过包入口加载 Rspress / Pele CSS
site/projects/cinderfolio/     # 本站 MDX 展示页，保留现有网址
scripts/build_marp.mjs          # 复制主题、生成本站 HTML、注入主题同步
scripts/marp_theme_sync.mjs     # 本站同源本地存储协议
.generated/cinderfolio/        # 供网站发布的主题和 HTML，生成目录
```

网站组件只使用 `cinderfolio/*` 公开入口，不跨目录引用项目内部文件。`rspress.config.ts` 从包入口加载 Shiki 变量主题，并将主题文件加入构建缓存依赖。

## 安装与构建

```sh
sh scripts/install.sh # 安装网站及子项目各自锁定的依赖
npm run colors        # 调用 cinderfolio-build，生成纯主题 dist/
npm run marp          # 生成 .generated/cinderfolio/，只在网站版本注入同步脚本
npm run dev           # 自动先运行 colors、marp，再导出网站内容
npm run build         # 相同准备步骤，随后静态构建和产物检查
npm test              # 先运行独立项目测试，再检查网站导出与集成
```

本地 `file:` 依赖不会安装子项目的开发依赖，安装脚本和 CI 因此分别安装两份锁文件。手动安装时执行 `npm ci` 和 `npm ci --prefix cinderfolio`。`npm run dev` / `build` 的日常用法不变。

```text
Cinderfolio 源码 → cinderfolio/dist/（纯主题，带许可证）
                → scripts/build_marp.mjs
                → .generated/cinderfolio/（本站下载资源与同步 HTML）
                → .generated/site/cinderfolio/（Rspress 发布副本）
```

纯项目构建不会生成网站组件、读取知识库或注入本地存储脚本。网站集成不写回 Cinderfolio 产物；复制静态资源时沿用 `/cinderfolio/` 地址。

## 预览状态与下载

四个适配页面共用 `CinderfolioProvider`。深色、浅色、品牌色选择器通过 `useHead` 更新全站变量；Shiki 直接引用变量，无需重新分词。调色跨页面保留，刷新后重置；默认方案仍维护在子项目 `palette.mjs`。

深色栏使用 `g15` 浅底，浅色栏使用 `g1` 深底，亮暗切换不反转。亮暗开关与导航共用 Rspress `ThemeContext`。显示职责与选择器的布局属于网站，通用职责定义来自 Cinderfolio。

MDX 单独放置 `CinderfolioDownload`。CSS / JSON 下载使用当前颜色，`/cinderfolio/` 静态文件使用默认种子；CSS 自带 MIT 全文，分享 JSON 时附上 `/cinderfolio/LICENSE`。

Shiki 和 Pele 使用原生双层 Tabs，仅保留必要间距、窄屏换行及选中项画布底色。Mermaid 源码用原生 `details / summary`，与图表共用底色；Pele 的渲染和源码折叠属于网站组件，不进入独立主题项目。

## Marp 集成

网站调用 `buildMarpExample()` 生成 16:9 与 4:3 HTML，然后注入 `installMarpThemeSync`。`CinderfolioMarp` 将当前颜色写入同源本地存储；iframe 与独立窗口只替换变量、不重载 HTML，保留当前页码。独立项目的样张没有这层状态同步。

底栏左侧是独立打开、等宽比例按钮，右侧是 PDF 图标。比例切换和独立打开通过 Marp URL 锚点保留当前页；PDF 调用 iframe 原生打印，用户选择“存储为 PDF”。字体仅由 Marp HTML 加载，网站继续使用文楷。备注来自 Markdown 注释，会进入公开 HTML。

验证范围：两个比例、亮暗主题、当前页保持、调色同步、窄屏与下载资源；不重复检查播放器全屏和演讲者模式。同步协议测试维护在 `tests/marp_sync.test.mjs`，独立渲染、SVG ID 和字体哈希测试在 Cinderfolio 内。

## 许可范围

`cinderfolio/LICENSE` 仅适用于该子项目的原创代码、主题和文档；字体及图片保留第三方授权。它不将个人网站内容、知识库、网页组件或其他目录改授 MIT。当前两个项目仍在同一仓库，本地依赖即可表达引用关系。
