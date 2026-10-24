/** CSS 导出仅依赖配色计算，可在 Node.js 和浏览器中复用。 */
import { seeds, createGrayScale, createAccentScale, createPalette, cssName } from './palette.mjs';
import { createPeleTheme, peleRoles } from './pele.mjs';
import { licenseComment } from './license.mjs';

export function themeVariables(input = seeds, mode = 'light') {
  return Object.fromEntries([
    ...Object.entries(createGrayScale(input)).map(([key, value]) => [cssName(key), value]),
    ...Object.entries(createAccentScale(input.accent)).map(([key, value]) => [`--cf-accent-${key}`, value]),
    ...Object.entries(createPalette(input)[mode]).map(([key, value]) => [cssName(key), value]),
  ]);
}

/** 默认跟随 data-cinderfolio；框架自己的主题选择器由适配入口传入。 */
export function createColorCss(input = seeds, selectors = {
  light: ':root,\n[data-cinderfolio="light"]',
  dark: '[data-cinderfolio="dark"]',
}) {
  return ['light', 'dark'].map(mode => {
    const declarations = Object.entries(themeVariables(input, mode))
      .map(([key, value]) => `  ${key}: ${value};`).join('\n');
    return `${selectors[mode]} {\n  color-scheme: ${mode};\n${declarations}\n}`;
  }).join('\n\n') + '\n';
}

/** 与网页适配器分开输出，实时预览和独立下载复用同一套 Pele 颜色。 */
export function createPeleColorCss(input = seeds, selectors = {
  light: '[data-cinderfolio="light"]',
  dark: '[data-cinderfolio="dark"]',
}) {
  return ['light', 'dark'].map(mode => {
    const { colors, onFill } = createPeleTheme(input, mode);
    const variables = [
      ...Object.entries(colors).map(([key, value]) => `  --pele-${key}: ${value};`),
      ...Object.entries(onFill).map(([key, value]) => `  --cf-pele-on-${key}: ${value};`),
    ].join('\n');
    return `${selectors[mode]} {\n${variables}\n}`;
  }).join('\n\n') + '\n';
}

export function createPeleAdapterCss() {
  // 这些实底与文字在同一组内，可直接根据 SVG 的填充变量选择对应字色。
  const solidLabels = Object.keys(peleRoles).filter(key => key.startsWith('series-')).map(key => `
.cinderfolio-pele :is(.pele-branch, .pele-leaf, .pele-period, .pele-timeline .pele-section):has(> rect[fill^="var(--pele-${key}"]:not([fill-opacity])) > text {
  fill: var(--cf-pele-on-${key});
}`).join('\n');
  return `/* 在内联 SVG 或包裹它的元素上添加 cinderfolio-pele。 */
.cinderfolio-pele {
  color: var(--pele-fg);
  background: var(--pele-bg);
}

.cinderfolio-pele .pele-node > :is(rect, circle, ellipse, polygon, path),
.cinderfolio-pele .pele-node > .cf-pele-edge > .pele-edge,
.cinderfolio-pele .pele-cluster > rect {
  stroke-width: 1.75px;
}

.cinderfolio-pele .pele-edge > :is(path, line, polyline):not(.pele-marker, .cf-pele-edge-hit) {
  stroke-width: 1.5px;
}

/* 命中层不参与绘制；连续的 10px 描边覆盖虚线空隙，缩放后仍保持可选宽度。 */
.cinderfolio-pele .cf-pele-edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 10px;
  stroke-dasharray: none;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

/* 填充透明度沿用 SVG 原始设置；雷达仅稍加粗轮廓。 */
.cinderfolio-pele .pele-curves {
  stroke-width: 2px;
}

/* 只强调鼠标下的对象，保留分类填充、透明度和相邻连线；触屏不保留悬停状态。 */
@media (hover: hover) {
  .cinderfolio-pele .cf-pele-edge-hit {
    pointer-events: stroke;
  }

  .cinderfolio-pele :is(.pele-node, .pele-task, .pele-note, .pele-commit, .pele-commit-label, .pele-ishikawa-head):hover
    > :is(rect, circle, ellipse, polygon, path):not(.pele-edge, .pele-marker, .cf-pele-edge-hit, .pele-divider, .pele-er-divider),
  .cinderfolio-pele .pele-gitGraph .pele-branch:hover > rect,
  .cinderfolio-pele .pele-ishikawa-category:has(> rect:hover, > .pele-label:hover) > rect,
  .cinderfolio-pele :is(.pele-slice, .pele-point, .pele-curve, .pele-venn-set, .pele-sankey-node):hover,
  .cinderfolio-pele .pele-series > :is(rect, circle, path):not(.cf-pele-edge-hit):hover {
    stroke: var(--pele-accent);
    stroke-width: 2.5px;
  }

  /* 连线既可能是独立路径，也可能与箭头分组；保留虚线和空心箭头。 */
  .cinderfolio-pele .pele-edge:hover,
  .cinderfolio-pele .pele-edge:hover > :is(path, line, polyline, polygon, circle):not([stroke="none"], .cf-pele-edge-hit),
  .cinderfolio-pele .cf-pele-edge:hover > .pele-edge,
  .cinderfolio-pele .pele-series:has(> .cf-pele-edge-hit:hover) > path:not(.cf-pele-edge-hit),
  .cinderfolio-pele .pele-marker:hover:not([stroke="none"]) {
    stroke: var(--pele-accent);
    stroke-width: 2.5px;
  }

  .cinderfolio-pele .pele-edge:hover > .pele-marker[fill]:not([fill="none"], [fill="var(--_bg)"]),
  .cinderfolio-pele .pele-marker[fill]:not([fill="none"], [fill="var(--_bg)"]):hover {
    fill: var(--pele-accent);
  }

  /* 纯文字节点没有可描边的形状，改为强调自身文字。 */
  .cinderfolio-pele :is(.pele-shape-text, .pele-tree-dir, .pele-tree-file, .pele-venn-region):hover > text,
  .cinderfolio-pele .pele-ishikawa-causes > text:hover {
    fill: var(--pele-accent);
  }

  /* 百分比文字与扇区分组分离，鼠标穿过数字时仍命中下方扇区。 */
  .cinderfolio-pele .pele-pie .pele-slice-labels {
    pointer-events: none;
  }
}

.cinderfolio-pele .pele-task:has(> rect[fill="var(--_c)"]:not([fill-opacity])) > text[fill="var(--_bg)"] {
  fill: var(--cf-pele-on-accent);
}

.cinderfolio-pele .pele-task:has(> rect[fill^="var(--pele-critical"]:not([fill-opacity])) > text[fill="var(--_bg)"] {
  fill: var(--cf-pele-on-critical);
}

/* 饼图标签分组不保留系列索引；双端点描边避免按位置猜测所属扇区。 */
.cinderfolio-pele .pele-slice-labels[fill="var(--_bg)"] > text {
  fill: var(--cf-g0);
  stroke: var(--cf-g16);
  stroke-width: 2.5px;
  stroke-linejoin: round;
  paint-order: stroke;
}
${solidLabels}
`;
}

/** 单文件包含全部颜色和图表规则，复制后无需加载 colors.css 或 Rspress。 */
export function createPeleCss(input = seeds) {
  return licenseComment + createColorCss(input, {
    light: '[data-cinderfolio="light"]',
    dark: '[data-cinderfolio="dark"]',
  }) + '\n' + createPeleColorCss(input) + '\n' + createPeleAdapterCss();
}
