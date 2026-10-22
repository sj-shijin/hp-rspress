/** Pele 专用职责；分类色由品牌色色相扩展，结构色复用固定灰阶。 */
import { seeds, createGrayScale, grayIndex, createAccentScale, contrast } from './palette.mjs';
import { seriesRecipe, createCategoricalPalette } from './oklch.mjs';

export const peleRoles = {
  bg: { label: '画布', gray: 16, usage: 'SVG 画布' },
  fg: { label: '主文字', gray: 0, usage: '标题、节点与图例文字' },
  muted: { label: '次要文字', gray: 3, usage: '说明、数值与轴标签' },
  line: { label: '连线', gray: 3, usage: '连线、箭头与坐标轴' },
  surface: { label: '节点底色', gray: 15, usage: '节点、卡片与表格' },
  'surface-alt': { label: '分组底色', gray: 14, usage: '分组、泳道与交替行' },
  border: { label: '描边', gray: 7, usage: '节点与分组边界' },
  accent: { label: '强调', accent: { light: 'light', dark: 'light' }, usage: '普通任务、票号与演化箭头' },
  critical: { label: '关键状态', accent: { light: 'brand', dark: 'lighter' }, usage: '关键任务与看板高优先级' },
  error: { label: '错误文字', gray: 0, usage: '渲染错误信息' },
  ...Object.fromEntries(seriesRecipe.hueOffsets.map((hueOffset, index) => [
    `series-${index + 1}`, { label: `分类 ${index + 1}`, hueOffset },
  ])),
};

export const peleRoleGroups = [
  ['画布与结构', ['bg', 'fg', 'muted', 'line', 'surface', 'surface-alt', 'border']],
  ['强调与状态', ['accent', 'critical', 'error']],
  ['分类色', ['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6', 'series-7', 'series-8']],
];

function textOn(fill, input) {
  return contrast(input.ink, fill) >= contrast(input.paper, fill) ? input.ink : input.paper;
}

export function createPeleTheme(input = seeds, mode = 'light') {
  const gray = createGrayScale(input);
  const accent = createAccentScale(input.accent);
  const generated = createCategoricalPalette(input);
  const colors = {}, onFill = {};
  for (const [key, role] of Object.entries(peleRoles)) {
    if ('gray' in role) colors[key] = gray[`g${grayIndex(role.gray, mode)}`];
    else if ('accent' in role) colors[key] = accent[role.accent[mode]];
    else colors[key] = generated.colors[key];
    if ('accent' in role || 'hueOffset' in role) onFill[key] = textOn(colors[key], input);
  }
  return { colors, onFill, series: generated.series, vision: generated.vision };
}

export function createPelePalette(input = seeds) {
  return Object.fromEntries(['light', 'dark'].map(mode => [mode, createPeleTheme(input, mode)]));
}
