/** 唯一手调的三个颜色。修改后在项目目录运行 npm run build。 */
export const seeds = {
  ink: '#121212',   // 炭黑：沿用原站暗色画布，兼作中性轴的深色端。
  paper: '#fafaf8', // 微暖白：中性轴的浅色端，兼作亮色画布。
  accent: '#f97316', // 可替换的主题色；默认沿用已确认的橙色。
};

/** 在编码后的 sRGB 通道内插值，对应 color-mix(in srgb, a p%, b)。
 * 输入和输出均为不透明 #rrggbb；输出四舍五入到 8 位，便于以后生成 Shiki JSON。
 */
export function mix(a, b, percent) {
  const channels = [1, 3, 5].map(index => {
    const x = parseInt(a.slice(index, index + 2), 16);
    const y = parseInt(b.slice(index, index + 2), 16);
    return Math.round((x * percent + y * (100 - percent)) / 100)
      .toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

/** ink → paper 固定十六等分：g0 / g16 为端点，g1…g15 为中间灰。
 * 第 i 档相当于 paper 以 i / 16 的透明度覆盖 ink；输出合成为不透明色。
 */
export const grayDivisions = 16;

export function createGrayScale(input = seeds) {
  return Object.fromEntries(Array.from({ length: grayDivisions + 1 }, (_, index) => [
    `g${index}`, mix(input.paper, input.ink, index * 100 / grayDivisions),
  ]));
}

/** 职责只设置亮色档位，暗色自动取镜像档位。 */
export function grayIndex(lightIndex, mode) {
  return mode === 'light' ? lightIndex : grayDivisions - lightIndex;
}

/** 只改变 HSL 明度，保留种子的色相和饱和度；delta 的单位是百分点。
 * 不混入 ink，保留主题色本身的色相和饱和度。
 */
export function adjustLightness(hex, delta) {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const chroma = max - min;
  const originalLightness = (max + min) / 2;
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * originalLightness - 1));
  let hue = 0;
  if (chroma !== 0) {
    if (max === r) hue = ((g - b) / chroma + 6) % 6;
    else if (max === g) hue = (b - r) / chroma + 2;
    else hue = (r - g) / chroma + 4;
  }
  const lightness = Math.max(0, Math.min(1, originalLightness + delta / 100));
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(hue % 2 - 1));
  const m = lightness - c / 2;
  const channels = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hue)];
  return `#${channels.map(value => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export const accentSteps = { darker: -10, dark: -5, brand: 0, light: 10, lighter: 20 };

export function createAccentScale(accent = seeds.accent) {
  return Object.fromEntries(Object.entries(accentSteps).map(([name, delta]) => [name, adjustLightness(accent, delta)]));
}

/** gray 只引用 g0…g16 的亮色档位，暗色自动镜像，不再单独手调混合比例。
 * 同一档可以服务多个职责，代码与图表继续复用这些职责色。
 * 主题色保留已确认的明度步长、用途与选中底色公式。
 */
export const recipes = {
  background: { label: '画布', gray: 16, usage: '页面、导航、侧栏、代码块、提示框内行内代码与图表节点' },
  surface: { label: '浅层底色', gray: 15, usage: '行内代码、提示区域、轻底色容器与卡片渐变' },
  surfaceHover: { label: '悬浮与分组底色', gray: 14, usage: '未选中项悬浮、图表分组' },
  foreground: { label: '正文与标题', gray: 0, usage: '正文、标题、主图标、图表文字与连线' },
  textMuted: { label: '次要文字', gray: 3, usage: '摘要、说明与侧栏目录' },
  textSubtle: { label: '辅助文字', gray: 5, usage: '时间、路径、行号与元信息' },
  border: { label: '淡分隔线', gray: 14, usage: '导航底线、表格、卡片、图表外框与滚动条' },
  borderStrong: { label: '强分隔线', gray: 12, usage: '弹窗外框、明确分组与滚动条悬停' },
  controlBorder: { label: '控件边界', gray: 5, usage: '次要按钮、切换按钮与搜索输入框的边界' },
  controlSelectedBackground: { label: '控件选中底色', accent: 'brand', usage: '切换按钮等控件的品牌色实底' },
  controlSelectedForeground: { label: '控件选中文字', contrast: 'controlSelectedBackground', usage: '品牌色实底上的文字与滑块，自动选择对比更高的端点' },
  interaction: { label: '交互提示', accent: 'brand', usage: '导航强调、悬浮提示、焦点、搜索当前项边框、代码高亮线与复制成功提示' },
  link: { label: '链接与当前项目文字', accent: { light: 'dark', dark: 'light' }, usage: '正文链接、当前项目文字与语法关键词' },
  diagramStroke: { label: '图表描边', accent: { light: 'darker', dark: 'light' }, usage: '图表节点与分组描边' },
  selection: { label: '文字选区底色', mix: ['accent', 'background', 25], usage: '鼠标或键盘选择文字；正文、说明与链接保留原字色' },
  selectedBackground: { label: '当前项目底色', mix: ['accent', 'background', 15], usage: '当前导航、项目与代码高亮行的淡品牌色底' },
};

export function createPalette(input = seeds) {
  const themes = {};
  const accent = createAccentScale(input.accent);
  const gray = createGrayScale(input);
  for (const mode of ['light', 'dark']) {
    const colors = {};
    for (const [key, recipe] of Object.entries(recipes)) {
      if (recipe.gray !== undefined) colors[key] = gray[`g${grayIndex(recipe.gray, mode)}`];
      else if (recipe.accent) colors[key] = accent[typeof recipe.accent === 'string' ? recipe.accent : recipe.accent[mode]];
      else if (recipe.contrast) {
        const background = colors[recipe.contrast];
        colors[key] = contrast(input.ink, background) >= contrast(input.paper, background) ? input.ink : input.paper;
      } else {
        const [a, b, percent] = recipe.mix;
        colors[key] = mix(colors[a] ?? input[a], colors[b] ?? input[b], percent);
      }
    }
    themes[mode] = colors;
  }
  return themes;
}

/** WCAG 的 sRGB 相对亮度；混色时不做此线性化，计算对比度时才做。 */
function luminance(hex) {
  const rgb = [1, 3, 5].map(index => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

export function contrast(a, b) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}

export function cssName(key) {
  return `--cf-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
}
