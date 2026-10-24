# Cinderfolio 维护

## 结构与边界

```text
palette.mjs              # 三个种子、固定色阶、语义职责、亮暗镜像
oklch.mjs                # 品牌衍生八色、色域处理与有限色觉校正
pele.mjs                 # Pele 18 个颜色职责与实底字色
shiki.mjs                # 阅读层级、通用 scope、HEX / 变量主题
marp.mjs                 # 通用 Marp 排版、字体栈与 Pele / Shiki 样式
rspress.mjs              # 通用 Rspress 职责映射，不包含使用方组件
css.mjs                  # 通用变量与独立 Pele CSS
license.mjs              # 浏览器生成 CSS 时附带 MIT 全文；测试与 LICENSE 核对
build.mjs                # 纯 Node.js 主题导出、对比度记录与产物检查
marp-engine.mjs          # Marp CLI 通用配置：Pele 图表、Shiki 高亮
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
npm run marp             # 生成两种比例的九页 HTML 样张
npm pack --dry-run       # 检查分发清单；不发布 npm 包
```

颜色调整从 `palette.mjs` 开始，适配器只引用职责，不复制种子。修改适配器后分别检查亮暗主题、默认与自定义种子；修改 Shiki scope 需以真实语法验证，修改 Marp 排版需对照两种比例。`dist/` 与 `node_modules/` 均不提交。

## Marp 排版与渲染

`marp.mjs` 提供同一份自包含 CSS，含 Pele 的 18 个颜色变量、实底字色和 Shiki 字形。16:9 为 1280×720、正文 32px；4:3 为 960×720、正文 28px。通过 Marp 原生 `data-size` 选择间距，字体与颜色共用；浏览器窗口大小不改变比例。

每页以 `#` 页题开头，正文上对齐；页题下方细品牌色线，`header / footer` 与页码在底部信息栏。普通 `strong` 只加粗。样张覆盖 `h1`–`h6`、正文行内元素、列表、引用、表格、图片、公式、代码和 SVG；`---` 显式分页，备注记录标签，不添加样张专用 CSS。

`marp-engine.mjs` 使用 CLI 异步 `engine` 扩展：`mermaid` 围栏交给 Pele，其他围栏交给 Shiki，保留 Marp 原生代码自动缩放。内置语言仅构建时加载，未知语言按纯文本转义。Shiki 调用同一份 `createShikiTheme(..., { variables: true })`，亮暗字形相同，颜色由 `light-dark()` 选择。生成 HTML 不再加载两个渲染库。

每图以 Markdown 行号生成稳定的 `idPrefix`，Pele 同步处理真实 ID 与可访问性引用；图内 `data-id` 可重复，不做字符串替换。测试验证重复图表的 ID 唯一、引用归属和渲染稳定。`buildMarpExample()` 只输出通用 HTML 与资源，不包含状态存储或页面组件脚本。

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
selectedBackground = mix(accent, background, 15); // 当前导航底色
controlSelectedBackground = accent;             // 控件选中实底
// 控件选中文字与滑块，从 ink / paper 中选择与选中实底对比更高的一端。
```

默认背景三层为亮色 `g16 / g15 / g14`、暗色 `g0 / g1 / g2`。主题色 `brand` 用于交互、焦点与控件选中实底；亮色链接取 `dark`，暗色链接取 `light`。通用 `diagramStroke` 角色保留品牌色 `darker / light`，Pele 的普通描边独立使用上述中性灰。文字选区使用 `color: currentColor`。搜索当前项和亮暗切换按钮复用控件选中职责，默认橙色实底上的文字与滑块均取 `g0`。

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

## Pele 配色

`pele.mjs` 定义 7 个画布与结构色、3 个强调与状态色、8 个品牌衍生分类色。运行时生成和 `cf-pele.css` 共用这份配置；通用灰阶与品牌色五档保持原规则。

普通描边使用中性灰：亮色 `g7 / #787877`，暗色镜像为 `g9 / #959593`，随深浅端点更新。节点与分组边界、网格和分隔线由此复用；强调与关键状态继续使用品牌色。

```js
// 完整配置在 oklch.mjs 的 seriesRecipe；色相以品牌色为起点，顺序固定。
hueOffsets = [0, 180, 90, 270, 45, 225, 135, 315];
lightness = 0.74; // 亮暗共用。
chroma = 0.16;
// 超出 sRGB 时降低 C，保持 L / h；以 0.01 的步长适配 L。
// 分类色与深色文字的对比目标为 7:1；画布对比度单独记录。
```

[OKLCH](https://developer.mozilla.org/zh-CN/docs/Web/CSS/color_value/oklch) 转换采用 [Oklab 原作者的矩阵](https://bottosson.github.io/posts/oklab/)。更换品牌色时八色重新生成；更换深色端点时重新适配。中性品牌色没有稳定色相时，采用默认品牌色的色相起点。分类色在亮暗主题中保持同值，编号 `1–8` 在调色与亮暗切换时保持稳定。

色觉模拟采用 [Machado 等人（2009）](https://doi.org/10.1109/TVCG.2009.113) 严重度 100 的三类矩阵，作用于线性 RGB。普通色觉与三类模拟各检查 28 对颜色，使用 `ΔE_OK × 100` 距离；普通色觉参考值为 8，模拟参考值为 4.5，均为工程检查参数。

最多进行三轮有限校正：第一色保持品牌色色相，其余色相最多偏移 ±12°；明度相对文字对比度适配结果最多变化 ±0.06，彩度最多降低 0.02。仅接受降低差异短缺平方和、保持深色文字对比度的候选；普通色觉最小距离下限取 `min(初稿最小距离, 8)`。`colors.json` 保留校正前后距离、每色校正量和剩余冲突；不把有限模拟的结果表述为所有色觉条件下均可辨。

强调与关键状态在主题内统一引用同一档位：亮色为 `light / brand`，暗色为 `light / lighter`。甘特普通任务、看板票号与 Wardley 地图演化箭头使用强调色；甘特 `crit` 任务、看板高优先级标记使用关键状态色，填充与描边均沿用这份配置。实底字色从深浅端点中按实际颜色选择。Git 分支标签、时间线标题与矩形树图继续使用亮暗共用的八个分类色和计算字色。

实底适配只匹配没有 `fill-opacity` 属性的彩色矩形，透明分组与事件卡片沿用原色。Pele 1.6.0 的饼图内外标签分别分组，未保留系列索引，内侧数字使用深色字加浅色描边。填充透明度沿用 SVG 原始设置，不再通过 CSS 统一覆盖：普通流程图分组为 50%，智能体分组为 6%、节点为 14%，雷达区域为 20%、图例为 40%；事件建模和桑基图同样保留原生透明度。雷达轮廓仍稍加粗。

对比度目标针对不透明实底。自定义端点过于接近时可能无法满足目标；明度搜索与校正均有固定次数上限，生成器会检查默认方案。颜色由 CSS 变量继承，图内显式的 `style` / `classDef` 仍可覆盖主题。
