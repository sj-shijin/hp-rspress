# Cinderfolio

统一配色计算与独立 CSS、Shiki 主题 JSON 导出。项目说明维护于 `site/projects/cinderfolio/`，默认使用三个种子：

```js
seeds = { ink: '#121212', paper: '#fafaf8', accent: '#f97316' };
```

`accent` 是可替换的主题色，默认保持已确认的 Orange 效果；中性职责保持十六等分与亮暗镜像。

## 生成与使用

```sh
# 仅需 Node.js 内置模块，不加载 Rspress 或 Pele。
node cinderfolio/build.mjs
node cinderfolio/build.mjs --out-dir /tmp/cinderfolio
node cinderfolio/build.mjs --check

npm run dev    # 自动生成配色与网站内容；http://127.0.0.1:1320/
npm run build  # 自动生成配色、构建网站、检查公开产物
npm test       # 配色与独立导出测试
```

Rspress、Pele、Shiki、Marp 四个预览页面共用同一调色板，提供深色、浅色、品牌色三个紧凑选择栏；“默认”只重置对应颜色，彩虹圆轮使用浏览器原生拾色器。亮暗切换与下载按钮放在同一操作区，宽度不足时自动换行；调色板随页面正常滚动。选择栏与导航的开关通过 Rspress `ThemeContext` 同步控制亮暗，调色跨页面保留，刷新后重置；保存默认方案时修改 `palette.mjs`。

深色栏复用 `g15` 浅灰底，浅色栏复用 `g1` 深灰底；底色随端点调色更新，亮暗切换不反转。页面以 `g0…g16`、`darker / dark / brand / light / lighter` 标注色阶，`bg` 标记当前背景；混色比例与明度偏移直接显示在色块下。

Pele 页使用两层原生 `Tabs / Tab`：外层按框线结构、分类实底、透明叠色和强调状态分组，内层切换 32 种图表，每种保留一张精简样例。显示职责默认折叠；饼图覆盖八色，甘特图覆盖普通、进行中、完成和关键任务。

- Cinderfolio-Rspress 页下载 `cf-rspress.css`：当前参数的完整 Rspress 亮暗样式。
- Pele 页下载 `cf-pele.css`：当前参数的独立 SVG 样式。
- Shiki 页下载 `cf-shiki-light.json`、`cf-shiki-dark.json`：当前参数的独立亮暗主题。
- Marp 页下载 `cf-marp.css`：当前参数的独立 Marp 主题，包含亮暗配色、幻灯片排版及 Pele / Shiki 样式。
- `dist/` 与 `/cinderfolio/` 下的静态文件始终对应源码中的默认方案。

```html
<link rel="stylesheet" href="./cf-pele.css" />
<figure class="cinderfolio-pele" data-cinderfolio="dark">
  <!-- 插入 Pele render(source).svg 生成的内联 SVG -->
</figure>
```

`cf-pele.css` 自包含，不需要 `colors.css` 或 Rspress。类名与主题属性也可以放在 SVG 根元素上；通过 `<img>` 引用的外部 SVG 需要在自身文档中包含样式。

```js
import { createPeleCss } from './css.mjs';
import { createRspressCss } from './rspress.mjs';
const input = { ink: '#121212', paper: '#fafaf8', accent: '#f97316' };
const peleCss = createPeleCss(input);
const rspressCss = createRspressCss(input);
```

## 文件职责

```text
palette.mjs       # 配色种子、固定色阶、网页职责与亮暗镜像
oklch.mjs         # 品牌色衍生八色、sRGB 色域处理、色觉模拟与有限校正
pele.mjs          # Pele 的 18 个颜色职责与实底文字计算
shiki.mjs         # Shiki 的六个阅读层级、通用 scope、变量主题与 HEX 主题
marp.mjs          # 独立 Marp CSS、Pele 变量与 Shiki 字形，静态和实时同步共用
examples/marp.md  # 正文、双图与代码示例，包含公开的演讲者备注
css.mjs           # 通用变量与独立 Pele CSS；兼容 Node.js / 浏览器
rspress.mjs       # Rspress 职责映射与完整 CSS 导出，不包含 Pele 规则
build.mjs         # 生成器、对比度记录与产物一致性检查
README.md         # 开发与使用说明

dist/             # 自动生成，已忽略，不手改
  colors.css      # 通用 --cf-* 变量，data-cinderfolio 控制亮暗
  colors.json     # HEX、规则、Pele / Shiki 配色与对比度记录
  cf-pele.css     # 自包含 Pele 主题
  cf-rspress.css  # 自包含 Rspress 主题，跟随 html.rp-dark
  cf-shiki-light.json # 独立 Shiki 亮色主题，具体 HEX
  cf-shiki-dark.json  # 独立 Shiki 暗色主题，具体 HEX
  cf-marp.css         # 独立 Marp 主题，跟随外层或系统亮暗
  marp/example.html   # Marp CLI 生成的独立 Bespoke 演示
```

网站由 `theme/index.tsx` 加载两个 CSS 适配文件，`rspress.config.ts` 加载 Shiki 变量主题。Layout 中的 `CinderfolioProvider` 保持调色状态，通过原生 `useHead` 更新整站色阶变量；Shiki 语法颜色直接引用这些变量。`CinderfolioPreview.tsx` 展示选择栏、职责与色阶；MDX 单独放置 `CinderfolioDownload`，使用同一生成接口导出当前参数。

## Marp 主题与网页嵌入

```sh
npm run colors # 导出 cf-marp.css；配色导出仍只依赖 Node.js 内置模块
npm run marp   # 使用已安装的 Marp CLI 生成示例 HTML，不需要浏览器
```

`npm run dev`、`npm run build` 会依次执行上述步骤。示例源文件是 `examples/marp.md`，页面 `/projects/cinderfolio/marp/` 通过同源 iframe 加载 `/cinderfolio/marp/example.html`。翻页、全屏、概览和演讲者模式沿用 CLI 的 Bespoke 模板；iframe 显式允许全屏，不重做播放器。

`cf-marp.css` 是自包含样式，供 Marp Core / CLI 加载，主题名为 `cinderfolio`。Pele 的 18 个颜色职责、实底文字适配和 Shiki 字形规则也在其中，无需再加载 `cf-pele.css` 或 `colors.css`。亮暗通过 `prefers-color-scheme` 选择，嵌入时可跟随外层的 `color-scheme`。

```sh
# 在本仓库中转换其他演示，复用相同渲染器。
npx marp slides.md --config-file scripts/marp.config.mjs --theme-set ./cinderfolio/dist/cf-marp.css -o slides.html
```

`scripts/marp.config.mjs` 使用 CLI 的异步 `engine` 扩展：`mermaid` 围栏通过 Pele 生成 SVG，其他围栏通过 Shiki 高亮，保留 Marp 的代码自动缩放。Shiki 在构建期加载内置语言，并复用网站的 Vue 语法适配；未知语言按纯文本显示。主题直接调用 `createShikiTheme(..., { variables: true })`，没有第二份配色配置。亮暗字形相同，颜色使用 `light-dark()` 读取现有色阶变量。

每张图以 Markdown 行号生成稳定的 `idPrefix`，Pele 同时处理标题、描述的真实 `id` 和可访问性引用。普通节点的 `data-id` 属于图内数据标记，可以在不同图中重复；不做无差别的字符串替换。编译测试核验重复图表的真实 ID 唯一、引用有效和输出稳定。

渲染扩展需要构建依赖 Marp CLI、Pele 与 Shiki；独立分享 CSS 只提供主题和排版，不会为默认 CLI 自动增加渲染能力。生成的 HTML 已包含 SVG 和高亮代码，浏览时不再加载这两个渲染库。

网站示例额外包含 `scripts/marp_theme_sync.mjs`：`CinderfolioMarp` 将当前配色写入同源本地存储，iframe、演讲者窗口和下一页预览监听更新，只替换变量、不重载 HTML，保留当前页码。备注来自 Markdown 注释，会进入公开 HTML。全屏与弹出演讲者窗口由用户操作触发，窗口同步需要可用的同源本地存储；单独分享 CSS 不需要同步脚本。

## Shiki 主题

`shiki.mjs` 按六个阅读层级组织通用 scope；加上 Diff 删除字形，共导出七组 `tokenColors`。背景单独配置，页面、实时主题与两份独立 JSON 共用同一来源。

```js
// 亮色 / 暗色；灰阶镜像，品牌色复用现有五档。
navigation = 'darker / light · 粗体'; // 关键字、声明、预处理、标题与标签
execution  = 'g0 / g16 · 粗体';      // 函数、变量、运算与结构边界
comment    = 'g0 / g16 · 斜体';      // 注释与强调文本
content    = 'g0 / g16 · 常规';      // 字符串、数字与正文
auxiliary  = 'g3 / g13 · 常规';      // 转义、格式与差异标题
structure  = 'g6 / g10 · 常规';      // 类型、尖括号、分隔符与引用
// Diff：新增复用 execution，修改复用 navigation，删除使用 g6 / g10 + 删除线。
```

```js
import { createShikiTheme } from './shiki.mjs';

// 可以直接传给 Shiki，或序列化为独立 JSON；不含 CSS 变量。
const theme = createShikiTheme(input, 'light');

// 网站构建时使用变量主题；调色只更新 --cf-g* / --cf-accent-*，无需重新分词。
const liveTheme = createShikiTheme(input, 'light', { variables: true });
```

圆、方、花括号与结构边界统一匹配 `meta.brace`、`punctuation.bracket(s)`、`punctuation.section`、`punctuation.definition` 等通用标记，覆盖调用、定义、分组、数组、捕获、属性及代码块。Python 定义块的冒号也随结构边界加粗；成员、导入和类型路径的连接符统一强调。泛型、模板、包含路径与 HTML 标签的尖括号归入类型灰阶，使用常规字重；比较与移位运算符继续使用端点粗体。Kotlin 当前语法未单独标记泛型尖括号，仍沿用默认样式。引号、排版符号、列表标记由更具体的规则归回次级灰色，字符串与注释中的普通括号保持所属文字的样式。

预处理指令复用关键字样式，`#include / #define / #if` 连同 `#` 一起使用品牌色粗体。普通类型保持灰阶，因此只为缺少通用声明子类的 JS、TS、Rust 声明和 Java `var` 保留四条语言后缀规则；其余规则按通用 scope 或上下文匹配。字符串前缀通过 `string storage.type.string` 匹配，避免影响 Go 的 `string` 类型。

新增语言先复用现有主题，检查实际 scope 后再决定是否补充。所有规则都在 JSON 内，网页不额外解析或按字符改色；例如 Mermaid 将图类型关键字、括号和连线共用 `keyword.control.mermaid`，它们仍一起使用导航色。`.tex` 示例使用 `latex` 围栏，基础 `tex` 语法也可复用这套主题。

代码与标题底色沿用画布端点：亮色 `g16`、暗色 `g0`。默认中性语法文字在代码底色上均通过 `4.5:1` 检查。亮色品牌字色 `darker` 对 `g16` 约为 `3.75:1`，只记录对比度，不改变已确认色阶。独立导出仍只需要 Node.js 内置模块；加载与语法验证由网站现有的 Shiki 完成。

## Pele 配色

`pele.mjs` 定义 7 个画布与结构色、3 个强调与状态色、8 个品牌衍生分类色。Pele 页的“显示职责”、实时预览和 `cf-pele.css` 共用这份配置；通用灰阶与品牌色五档保持原规则。

普通描边使用中性灰：亮色 `g7 / #787877`，暗色镜像为 `g9 / #959593`，随深浅端点更新。节点与分组边界、网格和分隔线由此复用；强调与关键状态继续使用品牌色。

```js
// 完整配置在 oklch.mjs 的 seriesRecipe；色相以品牌色为起点，顺序固定。
hueOffsets = [0, 180, 90, 270, 45, 225, 135, 315];
lightness = 0.74; // 亮暗共用。
chroma = 0.16;
// 超出 sRGB 时降低 C，保持 L / h；以 0.01 的步长适配 L。
// 分类色与深色文字的对比目标为 7:1；画布对比度单独记录。
```

[OKLCH](https://developer.mozilla.org/zh-CN/docs/Web/CSS/color_value/oklch) 转换采用 [Oklab 原作者的矩阵](https://bottosson.github.io/posts/oklab/)。更换品牌色时八色重新生成；更换深色端点时重新适配。中性品牌色没有稳定色相时，采用默认品牌色的色相起点。分类色在亮暗主题中保持同值，显示职责只展示色块、固定编号 `1–8` 和 HEX；调色与亮暗切换不改变编号。

色觉模拟采用 [Machado 等人（2009）](https://doi.org/10.1109/TVCG.2009.113) 严重度 100 的三类矩阵，作用于线性 RGB。普通色觉与三类模拟各检查 28 对颜色，使用 `ΔE_OK × 100` 距离；普通色觉参考值为 8，模拟参考值为 4.5，均为工程检查参数。

最多进行三轮有限校正：第一色保持品牌色色相，其余色相最多偏移 ±12°；明度相对文字对比度适配结果最多变化 ±0.06，彩度最多降低 0.02。仅接受降低差异短缺平方和、保持深色文字对比度的候选；普通色觉最小距离下限取 `min(初稿最小距离, 8)`。`colors.json` 保留校正前后距离、每色校正量和剩余冲突；不把有限模拟的结果表述为所有色觉条件下均可辨。

强调与关键状态在主题内统一引用同一档位：亮色为 `light / brand`，暗色为 `light / lighter`。甘特普通任务、看板票号与 Wardley 地图演化箭头使用强调色；甘特 `crit` 任务、看板高优先级标记使用关键状态色，填充与描边均沿用这份配置。实底字色从深浅端点中按实际颜色选择。显示职责直接展示对应色块、HEX、档位与用途，不再另设实底映射。Git 分支标签、时间线标题与矩形树图继续使用亮暗共用的八个分类色和计算字色。

实底适配只匹配没有 `fill-opacity` 属性的彩色矩形，透明分组与事件卡片沿用原色。Pele 1.6.0 的饼图内外标签分别分组，未保留系列索引，内侧数字使用深色字加浅色描边。填充透明度沿用 SVG 原始设置，不再通过 CSS 统一覆盖：普通流程图分组为 50%，智能体分组为 6%、节点为 14%，雷达区域为 20%、图例为 40%；事件建模和桑基图同样保留原生透明度。雷达轮廓仍稍加粗。

对比度目标针对不透明实底。自定义端点过于接近时可能无法满足目标；明度搜索与校正均有固定次数上限，生成器会检查默认方案。颜色由 CSS 变量继承，图内显式的 `style` / `classDef` 仍可覆盖主题。

## 已确认规则

```js
// 编码后的 sRGB 通道插值，四舍五入为不透明 #rrggbb。
// 通道数值等差不保证感知明度等差。
g[i] = mix(paper, ink, i * 100 / 16); // i = 0…16
// 灰色职责配置亮色档位 i，暗色取 16 - i。

// 保持主题色的 HSL 色相、饱和度，只调整明度（百分点）。
accentSteps = { darker: -10, dark: -5, brand: 0, light: 10, lighter: 20 };

selection = mix(accent, background, 25);          // 文字选区，保留原字色
selectedBackground = mix(accent, background, 15); // 当前导航底色
controlSelectedBackground = accent;             // 控件选中实底
// 控件选中文字与滑块，从 ink / paper 中选择与选中实底对比更高的一端。
```

默认背景三层为亮色 `g16 / g15 / g14`、暗色 `g0 / g1 / g2`。主题色 `brand` 用于交互、焦点与控件选中实底；亮色链接取 `dark`，暗色链接取 `light`。通用 `diagramStroke` 角色保留品牌色 `darker / light`，Pele 的普通描边独立使用上述中性灰。文字选区使用 `color: currentColor`。搜索当前项和亮暗切换按钮复用控件选中职责，默认橙色实底上的文字与滑块均取 `g0`。

生成器中止未通过的必要中性文字、控件边界与选中文字对比度检查。品牌实底与邻近背景的对比度单独记录，不改变已确认色阶；默认橙色与浅色画布约 `2.68:1`，与选中文字约 `6.68:1`。默认亮色链接在画布上约 `3.06:1`，在淡橙选区上约 `2.38:1`，不宣称整套方案全部达到 AA。

亮暗独立品牌色尚未接入。
