# Cinderfolio 维护

## 结构与边界

```text
palette.mjs              # 三个种子、固定色阶、语义职责、亮暗镜像
oklch.mjs                # 品牌衍生八色、色域处理与有限色觉校正
pele.mjs                 # Pele 18 个颜色职责与实底字色
pele-svg.mjs             # 连线透明命中层，构建期与浏览器共用
mermaid.mjs              # 同一图表职责映射到 Mermaid 官方主题变量，亮暗 JSON
shiki.mjs                # 阅读层级、通用 scope、HEX / 变量主题
marp.mjs                 # 通用 Marp 排版、字体栈与 Pele / Shiki 样式
rspress.mjs              # 通用 Rspress 职责映射，不包含使用方组件
css.mjs                  # 通用变量与独立 Pele CSS
license.mjs              # 浏览器生成 CSS 时附带 MIT 全文；测试与 LICENSE 核对
build.mjs                # 纯 Node.js 主题导出、对比度记录与产物检查
marp-engine.mjs          # Marp CLI 通用配置：Pele、Shiki、Markdown 扩展
scripts/build_marp.mjs   # 独立构建样张与字体、图片资源
scripts/prepare_marp_fonts.py # 字体维护工具，日常构建不运行
examples/                # 通用内容排版样张与图片
fonts/marp/              # WOFF2、font.css、来源与 OFL
tests/                   # 独立配色、语法、渲染与字体验证
```

核心主题生成只依赖 Node.js 内置模块。`marp-engine` / `marp-build` 单独声明可选 peer 依赖，独立开发使用本目录的 `package-lock.json`。使用方负责界面组件、状态管理、页面路由和部署；这些内容不进入本项目。

## 修改与验证

```sh
npm ci
npm run build            # 默认会清空 dist/，修改源文件后重新生成
npm run check            # 生成结果与来源一致，必要对比度通过
npm test                 # 真实分词、SVG ID、字体哈希、无依赖导出
npm run marp             # 生成两种比例的 Cinderfolio-Marp 使用演示
npm pack --dry-run       # 检查分发清单；不发布 npm 包
```

颜色调整从 `palette.mjs` 开始，适配器只引用职责，不复制种子。修改适配器后分别检查亮暗主题、默认与自定义种子；修改 Shiki scope 需以真实语法验证，修改 Marp 排版需对照两种比例。`dist/` 与 `node_modules/` 均不提交。

## Marp 排版与渲染

`marp.mjs` 提供同一份自包含 CSS，含 Pele 的 18 个颜色变量、实底字色和 Shiki 字形。按颜色变量、画布、基础内容、媒体、布局工具、页眉页脚、页面预设、Pele 共用规则排列；各版式的 4:3 差异紧跟对应默认值。16:9 为 1280×720，4:3 为 960×720。通过 Marp 原生 `data-size` 选择间距，字体与颜色共用；浏览器窗口大小不改变比例。

正文页以 `##` 页题开头，第一个顶层 `h2` 使用“均衡”标题区，页内小标题从 `###` 开始，内容上对齐。16:9 / 4:3 的页题为 40px / 36px，行高 1.25，正文左右边距为 64px / 48px。页题行框到 header 下边缘、到品牌线、品牌线到正文起点三处均为 16px，独立使用 `--cf-marp-title-gap`。品牌线仍为贯穿全页的 2px 线条；切换正文密度不影响标题字号、标题行高或正文起点。页题换行时按实际行数向下排布。

常规正文为 32px / 28px、行高 1.5，段落与组间距为 24px / 20px。单页 `_class: compact` 改为 28px / 24px、行高 1.4，段落与组间距为 12px / 10px，列间距为 20px / 16px；不添加另一套分栏结构。正文小标题随正文字号缩放。标题区与密度规则只作用于普通正文，不影响 `cover / transition`。

原生 `header / footer` 分别位于上下 32px 灰栏，16px 文字的 20px 行框垂直居中，页码与页脚对齐。信息栏取 `surface`（亮色 g15 / 暗色 g1）。普通文本页眉水平居中；包含顶层章节链接时，header 按章节数量等分整页宽度，文字居中、整块链接可点击。用 `strong` 标出的当前章采用画布底色，并移除底部分隔线，与正文区域连接；普通文本中的加粗不改变底色。当前章文字继承信息栏灰色，以底色和字重区分。页眉页脚、封面与过渡页继续使用原有 `--cf-marp-inline-space`，正文边距由独立的 `--cf-marp-content-inset` 管理。

`header` 从设置的当前页起沿用到后续页面；在下一章节首页更新一次即可。`_header` 只覆盖当前页，封面使用 `_header: ""` 隐藏章节栏。

```markdown
<!-- header: '**[引言](#1)** [方法](#2)' -->
<!-- footer: 研究汇报 · 作者 -->

## 研究问题

---

<!-- header: '[引言](#1) **[方法](#2)**' -->

## 方法
```

示例按“快速开始—特性展示—高级 Marp”组织，`---` 显式分页，三个章节入口使用过渡页。CLI 路线复用锁定依赖、引擎与字体；VS Code 路线明确 CSS 加载与完整渲染的区别。正文用实际分栏、公式、表格、图片、代码和 SVG 展示用法，备注补充来源与使用边界，不添加示例专用 CSS。

图文混排使用 `cf-cols` 与 `cf-col`；标签与 Markdown 之间保留空行。默认等宽、左上对齐，列间距使用 `--cf-marp-column-gap`，组间距使用 `--cf-marp-body-space`，随正文密度选择。空列（只有空白或注释）自动隐藏，剩余列重新分配全部宽度；整组为空时不留间距。`cf-col` 独立使用时是一组全宽内容，上下总述与结论可分别设置对齐，空组同样收起；不需要对齐时也可直接写普通段落。

- 比例：`cf-cols` 内的每栏用 `cf-w1`–`cf-w5` 指定权重，`cf-w3` 与 `cf-w2` 即为 3:2，比例在扣除列间距后计算。不写默认为 1；独立单栏不使用宽度权重，也不会自动瓜分页面的剩余高度。
- 对齐：每栏使用一个 `cf-align-*` 类，默认 `cf-align-tl`，可省略。先纵向 `t / m / b`（上／中／下），再横向 `l / c / r`（左／中／右）；文字、图片和图注共用位置。整栏内容作为一个整体垂直对齐。

```text
cf-align-tl  cf-align-tc  cf-align-tr
cf-align-ml  cf-align-mc  cf-align-mr
cf-align-bl  cf-align-bc  cf-align-br
```

```markdown
<div class="cf-col cf-align-tc">

总述。

</div>

<div class="cf-cols">

<div class="cf-col cf-w3 cf-align-ml">

左侧说明。

</div>
<div class="cf-col cf-w2 cf-align-tc">

![图示](./assets/figure.png)

</div>
</div>

<div class="cf-col cf-align-tr">

**结论：** 一句话归纳。

</div>
```

任意比例或额外高度使用 Marp 原生局部样式。默认 HTML 允许列表会移除标签上的 `style` 属性，因此写入 `<style scoped>`；不需要更改 CLI 参数或引擎配置。

```html
<style scoped>
/* 对应 class="cf-col wide"，与默认另一栏组成 2.5:1。 */
.cf-col.wide { flex-grow: 2.5; }
/* 对应 class="cf-cols tall"，需要额外纵向空间时再设置。 */
.cf-cols.tall { min-height: 320px; }
/* 独立单栏使用 class="cf-col summary cf-align-ml"，在 120px 区域内垂直居中、靠左。 */
.cf-col.summary { min-height: 120px; }
</style>
```

单栏或各栏内容等高时，垂直对齐没有额外空间可分配；需要时再指定组的最小高度。图片、通用 SVG、Pele 图表和代码块默认均无固定限高，保留横向防溢出与 Marp 原生自动缩放；内容不会自动按整页剩余高度缩小，多块内容的合计高度由作者控制。图片仍可用 Marp 原生 `w:` / `h:` 指定尺寸，图注使用 `figcaption` 并跟随水平对齐。

按页调整代码字号或设置限高，继续使用 `<style scoped>`。`--cf-marp-column-media-height` 在两种画幅下均默认为 `none`，仅作用于双栏内的代码与 Pele 图表：

```html
<style scoped>
/* 当前页代码字号统一缩小，保留 Marp 原生缩放。 */
pre code { font-size: 24px; }
/* 对应 class="cf-col diagram"，按需限制该栏的图表高度。 */
.cf-col.diagram { --cf-marp-column-media-height: 300px; }
</style>
```

```markdown
## 图片

<div class="cf-col cf-align-tc">

![h:500 整页图示](./assets/figure.png)

</div>
```

`h:500` 是单行页题下适用于当前两种画幅的示例尺寸，不是主题上限；增加标题行数或其他正文后需相应调整。

封面使用单页 `_class: cover`：`#`（`h1`）为标题，可在同一标题内用原生 `<small>副标题</small>`；作者、单位、日期各用一个普通段落，任意一项都可省略。主标题容纳一至两行，自动均衡断行，也可用 `<br>` 指定断点；主标题自身在品牌线上方垂直居中。`small` 由 CSS 定位在主标题下方 24px，不参与标题高度计算。整页宽的 2px 品牌色线与过渡页统一在距顶部 400px 处，共用 `--cf-marp-divider-top`；两种画幅均为 720px 高，单行或双行主标题的行框中心均为 200px，增删副标题不移动主标题。下方汇报信息组中心为 560px，段落间距统一为 8px；删除任意信息段落后，该组自动重新居中，不保留空位，也不影响主标题。16:9 / 4:3 的标题为 80px / 70px，副标题为 32px / 28px，汇报信息为 20px / 17.5px，颜色与字体继续共用主题。示例用原生指令清空封面页眉、页脚并跳过编号，正文从 1 开始；章节链接仍指向实际幻灯片序号。

封面布局只依赖主题 CSS 与 Marp 原生支持的 HTML，不需要包装容器、标题分组插件或浏览器脚本。原有的独立 `######` 副标题应改写为标题内的 `small`。

```markdown
<!--
_class: cover
_paginate: skip
_header: ""
_footer: ""
-->

# 面向异构计算的<br>算法设计与性能优化 <small>研究范围或报告场合（可省略）</small>

作者

单位

日期
```

过渡页使用单页 `_class: transition`。`##`（`h2`）章节标题必填，前面的普通段落为编号，后面的普通段落为一句引导，两者均可删除。两种画幅的 2px 品牌色线均距顶部 400px，与封面共用 `--cf-marp-divider-top`。删除编号、引导句或页眉页脚，标题与品牌线均保持原位。编号到标题、标题到线、线到引导句的间距分别为 24px / 20px。16:9 / 4:3 的标题为 64px / 56px，支持自动换行或 `<br>` 手动换行；两行标题向上扩展，品牌线保持固定。页眉与页脚沿用正文，过渡页计入页数；章节链接指向过渡页。只需独立 CSS，不依赖引擎扩展。

```markdown
<!-- _class: transition -->

02

## 研究方法

如何把研究问题转化为可验证的方案？
```

`marp-engine.mjs` 使用 CLI 异步 `engine` 扩展：`mermaid` 围栏交给 Pele，其他围栏交给 Shiki，保留 Marp 原生代码自动缩放。Pele 的布局参数 `maxWidth: 1120` 保持不变，最终显示宽度仍适配所在栏。内置语言仅构建时加载，未知语言按纯文本转义。Shiki 调用同一份 `createShikiTheme(..., { variables: true })`，亮暗字形相同，颜色由 `light-dark()` 选择。生成 HTML 不再加载两个渲染库。

每图以 Markdown 行号生成稳定的 `idPrefix`，Pele 同步处理真实 ID 与可访问性引用；图内 `data-id` 可重复，不做字符串替换。测试验证重复图表的 ID 唯一、引用归属和渲染稳定。`buildMarpExample()` 只输出通用 HTML 与资源，不包含状态存储或页面组件脚本。

标注块由构建期依赖 [`@mdit/plugin-alert`](https://mdit-plugins.github.io/alert.html) 解析，锁定兼容 Node.js 20 与 Markdown-it 14 的 0.23.2。`deep: true` 允许在分栏、列表和引用中使用；正文保留 Markdown 解析，代码围栏不转换。沿用 GitHub 的五种标记与 `.markdown-alert-*` 类名，不增加折叠或自定义标记。

```markdown
> [!IMPORTANT]
> **核心结论：** 分层处理减少了重复计算。

> [!NOTE]
> 结果基于相同数据与硬件。
```

`IMPORTANT` 省略默认标题，使用 2px 品牌色全边框与 `selectedBackground` 淡底；`NOTE` 使用灰阶边框与 `surface` 底色；`TIP / WARNING` 使用品牌色左边线；`CAUTION` 使用品牌色全边框。后四种保留简短中文标签，无图标；小号标签使用 `foreground` 端点色与 600 字重，品牌色负责边框和底色，正文继承文字色。辅助信息继续使用灰阶，正文链接仍使用 `link` 职责。样式随 `cf-marp.css` 导出；单独加载 CSS 不启用解析，CLI 沿用现有引擎配置和构建命令。

行内扩展由 [`markdown-it-mark`](https://github.com/markdown-it/markdown-it-mark) 4.0.0、[`markdown-it-sup`](https://github.com/markdown-it/markdown-it-sup) 2.0.0、[`markdown-it-sub`](https://github.com/markdown-it/markdown-it-sub) 2.0.0 在同一引擎中启用，分别把 `==高亮==`、`x^2^`、`H~2~O` 转为 `mark / sup / sub`。`mark` 使用 `selection` 淡品牌色并继承字色，`sup / sub` 沿用浏览器排版。行内代码底色取 `surfaceHover`（亮色 g14 / 暗色 g2），与画布拉开两档；独立代码块仍取画布底色。插件只在构建期运行；测试覆盖标注块内使用、原生删除线、公式和代码原文。

## 字体和资源

正文与图表用 `Inter, "Noto Sans SC"`，代码用 `"Sarasa Mono SC"`。当前固定版本为 Noto Sans SC 2.004、Inter 4.1、Sarasa Mono SC 1.0.42。中文按 Latin、GB2312 常用字和扩展字分片，保留原字体字符映射；Inter / Noto 保留可变字重，代码有常规、粗体、斜体和粗斜体。`font.css` 只引用同级 WOFF2，不使用系统 `local()`。

日常构建直接复制资源，不下载或重制字体。仅升级字体时准备官方字体、三份 OFL 和 `sources.json`（每个来源的 `url / sha256 / bytes`），再运行：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-fonts.txt
.venv/bin/python scripts/prepare_marp_fonts.py /path/to/original-fonts
node --test tests/marp.test.mjs
```

核对 `fonts/marp/SOURCE.json` 中的版本、来源与哈希，保留三份 OFL；示例照片的授权来源独立记录于 `examples/assets/SOURCE.json`。图片和字体不改授 MIT。复制 HTML 时保留同级 `fonts/`、`assets/` 与许可证。

## 灰阶与品牌色规则

```js
// 编码后的 sRGB 通道插值，四舍五入为不透明 #rrggbb。
// 通道数值等差不保证感知明度等差。
g[i] = mix(paper, ink, i * 100 / 16); // i = 0…16
// 灰色职责配置亮色档位 i，暗色取 16 - i。

// 保持主题色的 HSL 色相、饱和度，只调整明度（百分点）。
accentSteps = { darker: -10, dark: -5, brand: 0, light: 10, lighter: 20 };

selection = mix(accent, background, 25);          // 文字选区，保留原字色
selectedBackground = mix(accent, background, 15); // 当前导航与代码高亮行底色
controlSelectedBackground = accent;             // 控件选中实底
// 控件选中文字与滑块，从 ink / paper 中选择与选中实底对比更高的一端。
```

默认背景三层为亮色 `g16 / g15 / g14`、暗色 `g0 / g1 / g2`。主题色 `brand` 用于交互、焦点与控件选中实底；亮色链接取 `dark`，暗色链接取 `light`。通用 `diagramStroke` 角色保留品牌色 `darker / light`，Pele 的普通描边独立使用上述中性灰。文字选区使用 `color: currentColor`。搜索输入框使用控件边界灰，结果当前项保持画布底色，以品牌色边框强调，普通文字与图标取正文端点色，匹配词始终保持品牌色；亮暗切换按钮复用控件选中职责，默认橙色实底上的滑块取 `g0`。

生成器中止未通过的必要中性文字、控件边界与选中文字对比度检查。品牌实底与邻近背景的对比度单独记录，不改变已确认色阶；默认橙色与浅色画布约 `2.68:1`，与选中文字约 `6.68:1`。默认亮色链接在画布上约 `3.06:1`，在淡橙选区上约 `2.38:1`，不宣称整套方案全部达到 AA。

亮暗独立品牌色尚未接入。

## Shiki 主题

`shiki.mjs` 按六个阅读层级组织通用 scope；加上 Diff 删除字形，共导出七组 `tokenColors`。背景单独配置，实时主题与两份独立 JSON 共用同一来源。

```js
// 亮色 / 暗色；灰阶镜像，品牌色复用现有五档。
navigation = 'darker / light · 粗体'; // 分支、循环、声明、预处理与构建指令
execution  = 'g0 / g16 · 粗体';      // 函数、变量、属性、表达式、规则与标题
comment    = 'g0 / g16 · 斜体';      // 注释与强调文本
content    = 'g0 / g16 · 常规';      // 默认代码、字面量、参数值、标签与普通正文
auxiliary  = 'g3 / g13 · 常规';      // 类型约束、修饰符、声明附注、命名空间与参数标签
structure  = 'g6 / g10 · 常规';      // 分隔符、引号、文档排版边界与引用
// Diff：上下文复用 content，新增复用 execution，修改复用 navigation，删除使用 g6 / g10 + 删除线。
```

```js
import { createShikiTheme } from './shiki.mjs';

// 可以直接传给 Shiki，或序列化为独立 JSON；不含 CSS 变量。
const theme = createShikiTheme(input, 'light');

// 实时调色时使用变量主题；调色只更新 --cf-g* / --cf-accent-*，无需重新分词。
const liveTheme = createShikiTheme(input, 'light', { variables: true });
```

通用 scope 定义默认层级，具体语法和上下文负责覆盖；各例外的标记与原因直接维护在 `shiki.mjs` 中。

`source` 默认使用常规端点色；变量、属性、对象键、函数及表达式通过通用标记加粗，函数体和调用上下文保留局部兜底。C、Python、SQL、Lua、CMake、Kotlin、Swift 在顶层也有未细分的标识符或边界，因此仅这些语言保留粗体兜底；类型、字面量和注释仍由更具体的规则接管。正则继续保持除注释外使用阅读主体。

- 程序语言：函数、变量、表达式括号和成员连接符使用阅读主体；能识别的类型括号、泛型尖括号、修饰符、命名空间与声明附注使用辅助信息。比较和移位运算符保持阅读主体。预处理、分支、循环和异步流程保留导航色。
- 模板与样式：流程指令使用导航色，数据绑定、事件和 CSS 选择器使用阅读主体；JSX/TSX、Svelte 属性统一加粗，静态 HTML/XML 与 Vue 已识别的普通属性使用辅助信息，标签名使用数据正文。
- 数据与配置：键、锚点、别名和 YAML 合并键使用阅读主体，值使用数据正文。SQL 查询步骤保留导航色，标识符使用阅读主体，`AS` 使用辅助信息。
- 脚本与构建：强调命令、变量、执行连接和构建关系；普通参数值使用数据正文，CMake 参数标签使用辅助信息。Dockerfile 的未细分 `RUN` 参数不另行解析为 Shell。
- 文档与文本：Markdown、LaTeX 标题与正文强调保留字形，排版命令和边界使用灰阶；Diff 上下文使用数据正文。正则除了 `(?#...)` 注释，其余模式内容使用阅读主体。

语法无法区分的部分保留现状，不按字符推断语义；例如 Python 的部分类型括号、YAML 带引号的键、SQL 共用关键字标记的名称，以及 Mermaid 共用控制标记的图类型、括号和连线。

Marp 与独立 JSON 均使用 Shiki 内置 Vue 语法，无需补全注入。Shiki 4.5.0 的 HTML 回退仍保留属性上下文：`v-if`、`v-else-if`、`v-else`、`v-for` 使用导航色；未识别属性（包括动态绑定、事件和自定义属性）的名称与取值使用阅读主体。回退语法未细分属性值中的表达式和正文中的 `{{ … }}`，前者整体加粗，后者保留数据正文；不额外解析源码。已有专用 Vue 标记仍沿用通用规则。

新增语言先复用通用主题，再按实际 scope 补充必要例外。真实语法测试覆盖程序语言、模板、配置与文档格式。`.tex` 示例使用 `latex` 围栏，基础 `tex` 语法也有测试。

```sh
node --test tests/shiki.test.mjs # 用真实语法验证亮暗层级、字形、变量主题和原生 Vue
npm run build                 # 从同一来源生成两份 cf-shiki-*.json
node build.mjs --check
```

代码与标题底色沿用画布端点：亮色 `g16`、暗色 `g0`。默认中性语法文字在代码底色上均通过 `4.5:1` 检查。亮色品牌字色 `darker` 对 `g16` 约为 `3.75:1`，只记录对比度，不改变已确认色阶。独立导出仍只需要 Node.js 内置模块；加载与语法验证使用本项目锁定的 Shiki。

## Mermaid 配色

`mermaid.mjs` 复用 `createPeleTheme()` 的结构色、强调色、八色与实底字色；不另建色阶。声明官方渲染器的变量映射和必要的补充样式，纯主题生成不导入 `mermaid` 包。网站负责加载渲染器、监听调色与亮暗、串行绘图和取消过期结果。

适配按 Mermaid 12.2.0 的 `base` 主题校验。显式覆盖基础色和流程图、时序图、类图、状态图、ER、甘特、Git、饼图、思维导图、时间线、旅程、XY 与象限图的相关变量。`cScale*`、`git*` 和实底字色显式赋值，避免主题初始化时再次调整明度；读取 12 档的图表循环使用八色。饼图使用 `pieOpacity: 1` 保持实底文字对比度，其余透明度沿用原生值，不统一覆盖 SVG 填充。

旅程图的分组使用同序八色，角色复用前六色（原生提供六个角色色槽）。`themeCSS` 仅补充旅程实底标签和时间线连线的字色／描边；规则随 JSON 导出。时间线事件等原生层次处理仍由 Mermaid 保留。升级时同时复核这些原生类名。

甘特普通任务使用强调色，关键任务使用关键状态色；`active` 与 `done` 在官方样式中共用 `taskTextDarkColor`，二者均使用中性底色和正文文字，通过描边区别状态。内外标签分别匹配实际底色。饼图内侧标签只有一个主题字色，使用现有分类色所适配的深色端点。

独立测试验证配色映射、亮暗和无依赖 JSON 导出；使用方需用真实 Mermaid 检查覆盖变量与生成图表。升级时复核变量名、SVG 样式及自动派生行为。Typora 适配未接入。

## Pele 配色

`pele.mjs` 定义 7 个画布与结构色、3 个强调与状态色、8 个品牌衍生分类色。运行时生成和 `cf-pele.css` 共用这份配置；通用灰阶与品牌色五档保持原规则。

普通描边使用中性灰：亮色 `g7 / #787877`，暗色镜像为 `g9 / #959593`，随深浅端点更新。节点与分组边界、网格和分隔线由此复用；强调与关键状态继续使用品牌色。

`css.mjs` 的 Pele 适配器在支持悬停的设备上强调当前对象：形状与连线描边使用 `--pele-accent`、线宽为 `2.5px`，纯文字节点改用强调字色。连线分组中的箭头同步高亮，保留实心、空心与虚线形式；独立路径和箭头也可单独悬停。节点填充、透明度与相邻对象保持原样；移出后由原始样式恢复。网站、放大预览和独立导出的 CSS 共用该规则，饼图百分比标签不拦截扇区的鼠标命中。

`pele-svg.mjs` 的 `withPeleHitAreas(svg)` 只处理 Pele 生成的 SVG，为关系连线与 XY 折线添加连续透明路径。命中层使用 `10px`、`stroke-dasharray: none` 与 `vector-effect: non-scaling-stroke`，在支持悬停的设备上开启 `pointer-events: stroke`；默认显示线宽不变，箭头、节点和可访问性 ID 不复制。构建期、Pele 挂载前的 `sanitize` 回调和 Marp 共用该函数，自适应重绘会重新生成命中层。独立使用时需在插入 SVG 前调用该函数，再加载导出的 CSS；此函数不承担清理不可信 SVG 的职责。

```js
// 色相环九等分，0° 留给品牌强调；其余八色按色相顺序分配分类编号。
hueOffsets = [40, 80, 120, 160, 200, 240, 280, 320];
lightness = 0.74; // 亮色基准。
darkLightnessOffset = -0.04; // 暗色只降低校正后八色的明度。
chroma = 0.16;
// 超出 sRGB 时降低 C，保持 L / h；以 0.01 的步长适配 L。
// 分类实底文字的对比目标：亮色 7:1，暗色 4.5:1；画布对比度单独记录。
```

[OKLCH](https://developer.mozilla.org/zh-CN/docs/Web/CSS/color_value/oklch) 转换采用 [Oklab 原作者的矩阵](https://bottosson.github.io/posts/oklab/)。更换品牌色时八色重新生成；更换深色端点时重新适配。中性品牌色没有稳定色相时，采用默认品牌色的色相起点。亮色保留基准八色，暗色从校正后的颜色降低 `0.04` 的 OKLCH 明度，保留色相与类别顺序；编号 `1–8` 在调色与亮暗切换时保持稳定。实底字色按各主题的实际 HEX 从深浅端点中选择。

色觉模拟采用 [Machado 等人（2009）](https://doi.org/10.1109/TVCG.2009.113) 严重度 100 的三类矩阵，作用于线性 RGB。普通色觉与三类模拟各检查 28 对颜色，使用 `ΔE_OK × 100` 距离；普通色觉参考值为 8，模拟参考值为 4.5，均为工程检查参数。

基准八色最多进行三轮有限校正：各分类色相最多偏移 ±12°，与品牌色相仍至少间隔 28°；明度相对文字对比度适配结果最多变化 ±0.06，彩度最多降低 0.02。仅接受降低差异短缺平方和、保持深色文字对比度的候选；普通色觉最小距离下限取 `min(初稿最小距离, 8)`。暗色在此基础上降低明度，不重新分配色相。`colors.json` 分别记录亮暗实际输出的校正前后距离、基准校正量和剩余冲突；不把有限模拟的结果表述为所有色觉条件下均可辨。

强调与关键状态在主题内统一引用同一档位：亮色为 `light / brand`，暗色为 `light / lighter`。甘特普通任务、看板票号与 Wardley 地图演化箭头使用强调色；甘特 `crit` 任务、看板高优先级标记使用关键状态色，填充与描边均沿用这份配置。实底字色从深浅端点中按实际颜色选择。Git 分支标签、时间线标题与矩形树图使用各主题同序的八个分类色和计算字色。

实底适配只匹配没有 `fill-opacity` 属性的彩色矩形，透明分组与事件卡片沿用原色。Pele 1.6.0 的饼图内外标签分别分组，未保留系列索引，内侧数字使用深色字加浅色描边。填充透明度沿用 SVG 原始设置，不再通过 CSS 统一覆盖：普通流程图分组为 50%，智能体分组为 6%、节点为 14%，雷达区域为 20%、图例为 40%；事件建模和桑基图同样保留原生透明度。雷达轮廓仍稍加粗。

对比度目标针对不透明实底。自定义端点过于接近时可能无法满足目标；明度搜索与校正均有固定次数上限，生成器会检查默认方案。颜色由 CSS 变量继承，图内显式的 `style` / `classDef` 仍可覆盖主题。
