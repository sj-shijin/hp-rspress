/** CSS 导出仅依赖配色计算，可在 Node.js 和浏览器中复用。 */
import { seeds, createGrayScale, createAccentScale, createPalette, cssName } from './palette.mjs';

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

/** Pele 只认识自己的 CSS 变量；这里不引用 Rspress 的类、变量或渲染组件。 */
export const peleRoles = {
  bg: 'background', fg: 'foreground', muted: 'foreground', line: 'foreground',
  surface: 'background', 'surface-alt': 'surfaceHover',
  border: 'diagramStroke', accent: 'diagramStroke', critical: 'diagramStroke', error: 'diagramStroke',
  'series-1': 'link', 'series-2': 'foreground', 'series-3': 'textMuted', 'series-4': 'textSubtle',
  'series-5': 'diagramStroke', 'series-6': 'foreground', 'series-7': 'textMuted', 'series-8': 'textSubtle',
};

export function createPeleAdapterCss() {
  const variables = Object.entries(peleRoles)
    .map(([key, role]) => `  --pele-${key}: var(${cssName(role)});`).join('\n');
  return `/* 在内联 SVG 或包裹它的元素上添加 cinderfolio-pele。 */
.cinderfolio-pele {
${variables}
  color: var(--cf-foreground);
  background: var(--cf-background);
}

.cinderfolio-pele .pele-node > :is(rect, circle, ellipse, polygon, path),
.cinderfolio-pele .pele-cluster > rect {
  stroke-width: 1.75px;
}

.cinderfolio-pele .pele-edge > :is(path, line, polyline):not(.pele-marker) {
  stroke-width: 1.5px;
}

.cinderfolio-pele .pele-cluster > rect {
  fill-opacity: 1;
}

.cinderfolio-pele .pele-eventmodeling .pele-node > rect {
  fill: var(--pele-surface);
  fill-opacity: 1;
  stroke: var(--pele-border);
}

.cinderfolio-pele .pele-em-lane > rect {
  fill: var(--pele-surface-alt);
}
`;
}

/** 单文件包含全部颜色和图表规则，复制后无需加载 colors.css 或 Rspress。 */
export function createPeleCss(input = seeds) {
  return createColorCss(input, {
    light: '[data-cinderfolio="light"]',
    dark: '[data-cinderfolio="dark"]',
  }) + '\n' + createPeleAdapterCss();
}
