# Cinderfolio

统一配色计算与独立 CSS 导出。项目说明维护于 `site/projects/cinderfolio/`，默认使用三个种子：

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

`/projects/cinderfolio/preview/`（Cinderfolio-Rspress）提供深色、浅色、品牌色三个选择栏；“默认”只重置对应颜色，彩虹圆轮使用浏览器原生拾色器。选择栏与导航的开关通过 Rspress `ThemeContext` 同步控制亮暗，调色跨页面保留，刷新后重置；保存默认方案时修改 `palette.mjs`。

深色栏复用 `g15` 浅灰底，浅色栏复用 `g1` 深灰底；底色随端点调色更新，亮暗切换不反转。页面以 `g0…g16`、`darker / dark / brand / light / lighter` 标注色阶，`bg` 标记当前背景；混色比例与明度偏移直接显示在色块下。

- Cinderfolio-Rspress 页下载 `cf-rspress.css`：当前参数的完整 Rspress 亮暗样式。
- Pele 页下载 `cf-pele.css`：当前参数的独立 SVG 样式。
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
palette.mjs       # 唯一配色源：种子、色阶、职责、亮暗镜像、语法角色
css.mjs           # 通用变量与独立 Pele CSS；兼容 Node.js / 浏览器
rspress.mjs       # Rspress 职责映射与完整 CSS 导出，不包含 Pele 规则
build.mjs         # 生成器、对比度记录与产物一致性检查
README.md         # 开发与使用说明

dist/             # 自动生成，已忽略，不手改
  colors.css      # 通用 --cf-* 变量，data-cinderfolio 控制亮暗
  colors.json     # HEX、规则、语法角色与对比度记录
  cf-pele.css     # 自包含 Pele 主题
  cf-rspress.css  # 自包含 Rspress 主题，跟随 html.rp-dark
```

网站由 `theme/index.tsx` 分别加载两个适配文件，通过 Layout 中的 `CinderfolioProvider` 保持调色状态，并用原生 `useHead` 更新整站颜色变量。`CinderfolioPreview.tsx` 展示选择栏、职责与色阶；MDX 单独放置 `CinderfolioDownload`，使用同一生成接口导出当前参数。图表在 Pele 页查看。

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
```

默认背景三层为亮色 `g16 / g15 / g14`、暗色 `g0 / g1 / g2`。主题色 `brand` 用于交互与焦点；亮色链接取 `dark`，描边取 `darker`，暗色链接与描边取 `light`。文字选区使用 `color: currentColor`，控件选中单独使用灰色实底与对应文字色。

生成器中止未通过的必要中性文字与控件对比度检查。默认亮色链接在画布上约 `3.06:1`，在淡橙选区上约 `2.38:1`，不宣称整套方案全部达到 AA。

Shiki 主题和亮暗独立主题色尚未接入；`syntaxRoles` 保留后续语法契约，网页语法 token 继续使用现有主题。
