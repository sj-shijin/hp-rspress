/** OKLCH 八色生成与有限校正；纯计算，可在 Node.js 和浏览器中复用。 */
import { seeds, contrast } from './palette.mjs';

export const seriesRecipe = {
  space: 'oklch',
  // 色相环九等分；0° 留给品牌强调，其余八个槽位用于分类。
  hueOffsets: [40, 80, 120, 160, 200, 240, 280, 320],
  lightness: 0.74,
  darkLightnessOffset: -0.04,
  textContrast: 7,
  darkTextContrast: 4.5,
  chroma: 0.16,
  lightnessStep: 0.01,
  correction: { hue: [0, -6, 6, -12, 12], lightness: [0, -0.03, 0.03, -0.06, 0.06], chroma: [0, -0.02], passes: 3 },
  // ΔE_OK × 100 的工程检查参考值，并非通用的可访问性合格线。
  distance: { normal: 8, protanopia: 4.5, deuteranopia: 4.5, tritanopia: 4.5 },
};

/** Machado, Oliveira & Fernandes (2009)，严重度 100；矩阵作用于线性 RGB。
 * DOI: 10.1109/TVCG.2009.113；系数核对 colorspacious/cvd.py 中的原始补充数据。
 */
export const visionMatrices = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};

const clamp = value => Math.max(0, Math.min(1, value));
const wrapHue = value => (value % 360 + 360) % 360;
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const encoded = value => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
const linearRgb = hex => [1, 3, 5].map(index => linear(parseInt(hex.slice(index, index + 2), 16) / 255));
const rgbHex = rgb => `#${rgb.map(value => Math.round(clamp(encoded(clamp(value))) * 255).toString(16).padStart(2, '0')).join('')}`;

// Oklab 转换矩阵：Björn Ottosson，https://bottosson.github.io/posts/oklab/ 。
function linearToLab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}

export function toOklch(hex) {
  const [l, a, b] = linearToLab(linearRgb(hex));
  return { l, c: Math.hypot(a, b), h: wrapHue(Math.atan2(b, a) * 180 / Math.PI) };
}

function oklchToLinear({ l: L, c: C, h: H }) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}

/** 保持 L / h，以二分法降低 C，直到落入 sRGB；最终输出不透明 HEX。 */
export function fromOklch(color) {
  const inGamut = rgb => rgb.every(value => value >= -1e-7 && value <= 1 + 1e-7);
  let rgb = oklchToLinear(color);
  if (!inGamut(rgb)) {
    let low = 0, high = color.c;
    for (let step = 0; step < 18; step++) {
      const middle = (low + high) / 2;
      if (inGamut(oklchToLinear({ ...color, c: middle }))) low = middle;
      else high = middle;
    }
    rgb = oklchToLinear({ ...color, c: low });
  }
  return rgbHex(rgb);
}

function simulateLinear(rgb, model) {
  return model === 'normal' ? rgb : visionMatrices[model].map(row => clamp(row.reduce((sum, value, index) => sum + value * rgb[index], 0)));
}

export function simulateColorVision(hex, model) {
  return rgbHex(simulateLinear(linearRgb(hex), model));
}

function features(hex) {
  const rgb = linearRgb(hex);
  return Object.fromEntries(Object.keys(seriesRecipe.distance).map(model => [model, linearToLab(simulateLinear(rgb, model))]));
}

const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index])) * 100;

function pairLoss(a, b) {
  return Object.entries(seriesRecipe.distance).reduce((sum, [model, minimum]) => sum + Math.max(0, minimum - distance(a[model], b[model])) ** 2, 0);
}

/** 记录各模型最接近的一对和全部低于参考值的组合，保留剩余冲突。 */
export function checkColorVision(colors) {
  const samples = colors.map(features);
  let loss = 0;
  const models = Object.fromEntries(Object.entries(seriesRecipe.distance).map(([model, threshold]) => {
    let minimum = Infinity, closest;
    const conflicts = [];
    for (let a = 0; a < colors.length; a++) for (let b = a + 1; b < colors.length; b++) {
      const value = distance(samples[a][model], samples[b][model]);
      if (value < minimum) { minimum = value; closest = [a + 1, b + 1]; }
      if (value < threshold) conflicts.push({ pair: [a + 1, b + 1], distance: Number(value.toFixed(3)) });
      loss += Math.max(0, threshold - value) ** 2;
    }
    return [model, { threshold, minimum: Number(minimum.toFixed(3)), closest, conflicts }];
  }));
  return { loss: Number(loss.toFixed(6)), models };
}

export function createCategoricalPalette(input = seeds, mode = 'light') {
  const brand = toOklch(input.accent);
  // 中性品牌色缺少稳定色相，沿用默认品牌色的色相作为确定的起点。
  const anchor = brand.c < 0.01 ? toOklch(seeds.accent).h : brand.h;
  const quality = hex => contrast(hex, input.ink) / seriesRecipe.textContrast;
  const sample = point => {
    const hex = fromOklch(point);
    return { ...point, hex, features: features(hex) };
  };
  const initial = seriesRecipe.hueOffsets.map(offset => {
    const point = { l: seriesRecipe.lightness, c: seriesRecipe.chroma, h: wrapHue(anchor + offset) };
    let best = sample(point);
    // 先生成亮色基准八色，以深色文字为参照；只沿 L 向上适配。
    for (let step = 0; step <= 100; step++) {
      const l = clamp(point.l + step * seriesRecipe.lightnessStep);
      const current = sample({ ...point, l });
      if (quality(current.hex) > quality(best.hex)) best = current;
      if (quality(current.hex) >= 1) return current;
      if (l === 0 || l === 1) break;
    }
    return best;
  });
  const before = checkColorVision(initial.map(value => value.hex));
  const floor = Math.min(seriesRecipe.distance.normal, before.models.normal.minimum);
  const options = initial.map(point => {
    const candidates = new Map();
    // 每个槽位最多偏移 12°，与品牌色相仍至少间隔 28°，不交换类别顺序。
    for (const dh of seriesRecipe.correction.hue) {
      for (const dl of seriesRecipe.correction.lightness) for (const dc of seriesRecipe.correction.chroma) {
        const current = sample({ l: clamp(point.l + dl), c: point.c + dc, h: wrapHue(point.h + dh) });
        if (quality(current.hex) >= 1) candidates.set(current.hex, current);
      }
    }
    return [...candidates.values()];
  });
  const selected = [...initial];
  for (let pass = 0; pass < seriesRecipe.correction.passes; pass++) {
    let changed = false;
    for (let index = 0; index < selected.length; index++) {
      const others = selected.filter((_, other) => other !== index);
      const loss = value => others.reduce((sum, other) => sum + pairLoss(value.features, other.features), 0);
      let best = selected[index], bestLoss = loss(best);
      for (const candidate of options[index]) {
        if (others.some(other => distance(candidate.features.normal, other.features.normal) + 1e-9 < floor)) continue;
        const value = loss(candidate);
        if (value < bestLoss - 1e-9) { best = candidate; bestLoss = value; }
      }
      if (best.hex !== selected[index].hex) { selected[index] = best; changed = true; }
    }
    if (!changed) break;
  }
  // 暗色只降低已校正颜色的明度，保留类别顺序、色相与彩度；超出色域时仍按原规则降低 C。
  const display = value => {
    if (mode !== 'dark') return value;
    const color = toOklch(value.hex);
    return sample({ ...color, l: clamp(color.l + seriesRecipe.darkLightnessOffset) });
  };
  const colors = {}, series = {};
  selected.map(display).forEach((value, index) => {
    const key = `series-${index + 1}`;
    const actual = toOklch(value.hex);
    colors[key] = value.hex;
    series[key] = {
      hueOffset: seriesRecipe.hueOffsets[index],
      l: Number(actual.l.toFixed(5)), c: Number(actual.c.toFixed(5)), h: Number(actual.h.toFixed(3)),
      // 校正量记录基准八色的有限校正，暗色明度偏移单独维护在 seriesRecipe。
      correction: { l: Number((selected[index].l - initial[index].l).toFixed(3)), c: Number((selected[index].c - initial[index].c).toFixed(3)), h: Number((wrapHue(selected[index].h - initial[index].h + 180) - 180).toFixed(3)) },
    };
  });
  const displayedBefore = mode === 'dark' ? checkColorVision(initial.map(display).map(value => value.hex)) : before;
  return { colors, series, vision: { model: 'Machado 2009 / severity 100', anchor: Number(anchor.toFixed(3)), neutralBrand: brand.c < 0.01, before: displayedBefore, after: checkColorVision(Object.values(colors)) } };
}
