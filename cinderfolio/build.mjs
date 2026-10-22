/** 独立生成 CSS / JSON；仅使用 Node.js 内置模块，不依赖 Pele 或 Rspress。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { seeds, recipes, grayDivisions, createGrayScale, accentSteps, createAccentScale, syntaxRoles, createPalette, contrast } from './palette.mjs';
import { createColorCss, createPeleCss } from './css.mjs';
import { createRspressCss } from './rspress.mjs';
import { peleRoles, createPelePalette } from './pele.mjs';
import { seriesRecipe } from './oklch.mjs';

const directory = new URL('./', import.meta.url);
const { values } = parseArgs({ options: { check: { type: 'boolean' }, 'out-dir': { type: 'string' } } });
const output = values['out-dir'] ? path.resolve(values['out-dir']) : fileURLToPath(new URL('dist/', directory));
const themes = createPalette();
const grayScale = createGrayScale();
const accentScale = createAccentScale();
const checks = {};
const peleThemes = createPelePalette();
const peleChecks = {};

for (const [mode, { colors, onFill, series, vision }] of Object.entries(peleThemes)) {
  if (vision.after.loss > vision.before.loss) throw new Error(`Pele ${mode} 色觉校正损失增大`);
  if (vision.after.models.normal.minimum < seriesRecipe.distance.normal) throw new Error(`Pele ${mode} 普通色觉下的分类色过于接近`);
  peleChecks[mode] = [
    ...Object.keys(series).flatMap(key => [
      [`--pele-${key}`, '深色文字', colors[key], onFill[key], seriesRecipe.textContrast],
      [`--pele-${key}`, '画布', colors[key], colors.bg, 3, false],
    ]),
    ...['accent', 'critical'].map(key => [`--pele-${key}`, '实底文字', colors[key], onFill[key], 4.5]),
  ].map(([variable, usage, color, adjacent, minimum, required = true]) => {
    const ratio = contrast(color, adjacent);
    if (required && ratio < minimum) throw new Error(`Pele ${mode} ${variable} / ${usage}: ${ratio.toFixed(2)} < ${minimum}`);
    return { variable, usage, ratio: Number(ratio.toFixed(2)), minimum, required, passes: ratio >= minimum };
  });
}

for (const [mode, c] of Object.entries(themes)) {
  const pairs = [
    ['正文 / 画布', c.foreground, c.background, 4.5],
    ['正文 / 浅层底色', c.foreground, c.surface, 4.5],
    ['正文 / 悬浮与分组', c.foreground, c.surfaceHover, 4.5],
    ['次要文字 / 画布', c.textMuted, c.background, 4.5],
    ['次要文字 / 悬浮底色', c.textMuted, c.surfaceHover, 4.5],
    ['辅助文字 / 画布', c.textSubtle, c.background, 4.5],
    ['辅助文字 / 代码底色', c.textSubtle, c.surface, 4.5],
    ['注释 / 代码底色', c.textMuted, c.surface, 4.5],
    ['链接 / 画布', c.link, c.background, 4.5, false],
    ['链接 / 代码底色', c.link, c.surface, 4.5, false],
    ['链接 / 选中底色', c.link, c.selectedBackground, 4.5, false],
    ['交互文字 / 画布', c.interaction, c.background, 4.5, false],
    ['按钮文字 / 中性实底', c.background, c.foreground, 4.5],
    ['文字选区正文 / 淡主题色底', c.foreground, c.selection, 4.5],
    ['文字选区说明 / 淡主题色底', c.textMuted, c.selection, 4.5],
    ['文字选区链接 / 淡主题色底', c.link, c.selection, 4.5, false],
    ['控件选中文字 / 实底', c.controlSelectedForeground, c.controlSelectedBackground, 4.5],
    // 品牌实底保留原色；记录它与邻近背景的差异，文字与控件边界仍做必要检查。
    ['控件选中底色 / 画布', c.controlSelectedBackground, c.background, 3, false],
    ['控件选中底色 / 悬浮层', c.controlSelectedBackground, c.surfaceHover, 3, false],
    ['控件边界 / 画布', c.controlBorder, c.background, 3],
    ['控件边界 / 悬浮底色', c.controlBorder, c.surfaceHover, 3],
    ['图表描边 / 画布', c.diagramStroke, c.background, 3, false],
    ['图表描边 / 分组底色', c.diagramStroke, c.surfaceHover, 3, false],
    ...Object.entries(syntaxRoles).map(([key, role]) => [
      `语法 ${key} / 代码底色`, c[role.color], c.surface, 4.5,
      !['link', 'diagramStroke'].includes(role.color),
    ]),
  ];
  checks[mode] = pairs.map(([usage, foreground, background, minimum, required = true]) => {
    const ratio = contrast(foreground, background);
    const passes = ratio >= minimum;
    // 主题色保留已确认的明度步长，不为达到阈值改变色阶；数值仍完整报告。
    if (required && !passes) throw new Error(`${mode} ${usage}: ${ratio.toFixed(2)} < ${minimum}`);
    return { usage, foreground, background, ratio: Number(ratio.toFixed(2)), minimum, passes, required };
  });
}

const header = '/* 由 Cinderfolio 配色源生成；请修改来源后运行 node cinderfolio/build.mjs。 */';
const artifacts = {
  'colors.json': `${JSON.stringify({ name: 'cinderfolio', neutralColorSpace: 'srgb', accentColorSpace: 'hsl', seeds, grayDivisions, grayScale, accentSteps, accentScale, recipes, themes, syntaxRoles, checks, pele: { seriesRecipe, roles: peleRoles, themes: peleThemes, checks: peleChecks } }, null, 2)}\n`,
  'colors.css': `${header}\n${createColorCss()}`,
  'cf-pele.css': `${header}\n${createPeleCss()}`,
  // 原生主题选择器只存在于 Rspress 产物；Pele 与通用 CSS 不知道 rp-dark。
  'cf-rspress.css': `${header}\n${createRspressCss()}`,
};

// --check 只核对产物与来源一致，并重新检查实际使用组合的对比度。
if (!values.check) {
  // 默认 dist 完全由本生成器维护；重建时移除旧文件名。
  if (!values['out-dir']) await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
}
for (const [name, content] of Object.entries(artifacts)) {
  const target = path.join(output, name);
  if (values.check) {
    if (await fs.readFile(target, 'utf8') !== content) throw new Error(`产物需要更新：${target}`);
  } else await fs.writeFile(target, content);
}

console.log(`Cinderfolio：${Object.keys(seeds).length} 个输入色，${Object.keys(recipes).length} 个语义色，亮暗各 ${checks.light.length} 组对比度已记录。`);
console.log(`灰阶固定 ${grayDivisions} 等分，共 ${Object.keys(grayScale).length} 档；职责按亮暗镜像引用。`);
console.log(`主题色五档：${Object.values(accentScale).join(' / ')}。文字选区采用主题色 25% + 画布 75%，保留原字色。`);
console.log(`Pele：${Object.keys(peleRoles).length} 个基础颜色变量；亮暗共用八色，与深色文字 ≥ ${seriesRecipe.textContrast}:1；甘特实底与文字 ≥ 4.5:1，亮暗共 ${Object.values(peleChecks).flat().filter(check => check.required).length} 项必要检查通过，画布对比度另行记录。`);
for (const [mode, { vision }] of Object.entries(peleThemes)) {
  const remaining = Object.values(vision.after.models).reduce((sum, model) => sum + model.conflicts.length, 0);
  console.log(`Pele ${mode}：OKLCH 品牌衍生八色；色觉检查短缺平方和 ${vision.before.loss} → ${vision.after.loss}，剩余 ${remaining} 对低于工程参考值，详情写入 colors.json。`);
}
for (const [mode, colors] of Object.entries(themes)) {
  console.log(`${mode}: 正文 ${contrast(colors.foreground, colors.background).toFixed(2)}:1；链接 ${contrast(colors.link, colors.background).toFixed(2)}:1；对比度达到参考值 ${checks[mode].filter(check => check.passes).length}/${checks[mode].length}。中性文字与控件必需检查均通过。`);
}
