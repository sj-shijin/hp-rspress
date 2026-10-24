# Cinderfolio

以深色、浅色和品牌色三个输入生成统一配色，导出 Rspress、Pele、Mermaid、Shiki 与 Marp 主题。包含十六等分灰阶、五档品牌色、亮暗职责映射和品牌衍生的八个分类色。

```js
const input = { ink: '#121212', paper: '#fafaf8', accent: '#f97316' };
```

## 生成主题

需要 Node.js 20.19+ 或 22.12+。以下命令在本项目目录执行；生成 CSS / JSON 仅使用 Node.js 内置模块，无需安装依赖。

```sh
npm run build                         # 生成 dist/，会清理该目录
npm run check                         # 核对产物及默认配色对比度
node build.mjs --out-dir /tmp/cf-theme # 指定输出目录
```

```text
dist/
  colors.css             # 通用 --cf-* 变量，data-cinderfolio 控制亮暗
  colors.json            # 色阶、职责、HEX 与对比度记录
  cf-rspress.css         # Rspress 主题，跟随 html.rp-dark
  cf-pele.css            # 独立 Pele SVG 主题
  cf-mermaid-light.json  # Mermaid 官方渲染器亮色配置
  cf-mermaid-dark.json   # Mermaid 官方渲染器暗色配置
  cf-shiki-light.json    # Shiki 亮色主题，具体 HEX
  cf-shiki-dark.json     # Shiki 暗色主题，具体 HEX
  cf-marp.css            # Marp 主题，包含 Pele / Shiki 样式
  LICENSE               # 分发主题时一并保留
```

修改默认颜色时编辑 `palette.mjs` 的 `seeds`；运行时生成可直接传入三个颜色。各适配 CSS 均自包含，不要求同时加载 `colors.css`。

## 在其他项目使用

当前通过本地路径引用，不要求 npm 发布或独立远程仓库：

```sh
# 在使用方项目中，将路径替换为本项目所在目录。
npm install /path/to/cinderfolio
```

先在 Cinderfolio 中运行 `npm run build`，再引用 `cinderfolio/themes/*` 静态产物。JavaScript 入口可在 Node.js 或支持打包的浏览器项目中使用：

```js
import { createRspressCss } from 'cinderfolio/rspress';
import { createPeleCss } from 'cinderfolio/css';
import { createShikiTheme } from 'cinderfolio/shiki';
import { createMermaidTheme } from 'cinderfolio/mermaid';
import { createMarpCss } from 'cinderfolio/marp';

const input = { ink: '#121212', paper: '#fafaf8', accent: '#f97316' };
const rspressCss = createRspressCss(input);
const peleCss = createPeleCss(input);
const marpCss = createMarpCss(input);
const shikiLight = createShikiTheme(input, 'light');
const shikiDark = createShikiTheme(input, 'dark');
const mermaidLight = createMermaidTheme(input, 'light');
const mermaidDark = createMermaidTheme(input, 'dark');
```

Rspress 主题入口中加载 `cinderfolio/themes/cf-rspress.css`，Shiki 配置使用上述亮暗主题对象。需要实时调色时，`createShikiTheme(input, mode, { variables: true })` 可生成引用通用色阶变量的主题；独立 JSON 默认使用 HEX。

Pele 渲染后的内联 SVG 可以直接加载导出的 CSS：

```html
<link rel="stylesheet" href="./cf-pele.css" />
<figure class="cinderfolio-pele" data-cinderfolio="dark">
  <!-- 插入 Pele render(source).svg -->
</figure>
```

类名与主题属性也可放在 SVG 根元素上。通过 `<img>` 引用的外部 SVG，需要在 SVG 自身文档中包含样式。

需要扩大连线的鼠标命中范围时，在插入 SVG 前调用同包的辅助函数。它添加连续的透明命中层，配合 `cf-pele.css` 覆盖线条两侧和虚线空隙，保留默认显示线宽：

```js
import { render } from 'pele';
import { withPeleHitAreas } from 'cinderfolio/pele';

const svg = withPeleHitAreas(render(source).svg);
```

## Mermaid

两份 `cf-mermaid-*.json` 是 Mermaid 官方的完整主题配置，使用 `base` 与 `classic`，颜色均为具体 HEX。使用方安装 Mermaid 后直接传给初始化入口：

```js
import mermaid from 'mermaid';
import { createMermaidTheme } from 'cinderfolio/mermaid';

mermaid.initialize({ ...createMermaidTheme(input, 'light'), startOnLoad: false });
const { svg } = await mermaid.render('diagram-id', source);
```

也可读取导出的 JSON 代替生成函数。切换亮暗后由使用方应用对应配置并重新渲染；生成主题本身不依赖 Mermaid、DOM 或网站代码。适配以 Mermaid 12.2.0 验证，渲染器需要 Node.js 22.12+；纯主题导出的 Node.js 要求不变。通用主题不附带字体文件。

## Marp

```sh
npm ci         # 安装独立项目的锁定依赖；测试和渲染示例需要
npm run marp   # 生成 dist/marp/，包含 16:9、4:3 HTML、字体和图片
npm test       # 配色、独立导出、真实 Shiki 语法与 Marp 渲染测试
```

`examples/marp.md` 包含一页 `cover` 封面、一页 `transition` 过渡页与九页内容元素排版样张。生成的 HTML 保留 Marp 官方播放器，可整体复制 `dist/marp/` 分享。字体固定为 Inter、Noto Sans SC、Sarasa Mono SC，本地 WOFF2 随示例分发。

```yaml
---
marp: true
theme: cinderfolio
size: 16:9 # 或 4:3
---
```

`cf-marp.css` 可由 Marp Core / CLI 加载，亮暗随 `prefers-color-scheme`，嵌入时可继承外层的 `color-scheme`。单独 CSS 不内嵌字体；其他渲染入口还需加载 `fonts/marp/font.css` 及同目录 WOFF2。

在本项目内转换其他文稿，使用通用渲染扩展启用 Pele 与 Shiki：

```sh
npx --no-install marp slides.md --config-file ./marp-engine.mjs --theme-set ./dist/cf-marp.css -o slides.html
```

其他项目可通过 `cinderfolio/marp-engine` 引用该配置，或通过 `cinderfolio/marp-build` 的 `buildMarpExample(outputDirectory)` 构建随包样张。这两个入口需要使用方安装 Marp CLI、Pele 和 Shiki；它们不参与纯主题导出。

## 维护与许可

模块职责、算法、语法规则和字体更新见 [维护文档](docs/maintenance.md)。

原创代码、主题和文档使用 [MIT 许可](LICENSE)。CSS 导出包含许可文本；分享 Shiki、Mermaid JSON 或其他产物时同时附带 `LICENSE`。

- 字体保留各自的 SIL Open Font License，许可证、来源与哈希位于 `fonts/marp/`，不改授 MIT。
- 示例图片的作者、来源与授权链接见 `examples/assets/SOURCE.json`，图片不在 MIT 授权范围内。
- Marp、Pele、Shiki 等依赖遵循各自许可证。
