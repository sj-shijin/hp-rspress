import assert from 'node:assert/strict';
import test from 'node:test';
import { seeds, contrast } from '../cinderfolio/palette.mjs';
import { toOklch, fromOklch, simulateColorVision, checkColorVision, createCategoricalPalette, seriesRecipe } from '../cinderfolio/oklch.mjs';

test('OKLCH 转换核对标准红色，并保持 sRGB 往返与色域内输出', () => {
  const red = toOklch('#ff0000');
  assert.ok(Math.abs(red.l - 0.628) < 0.001);
  assert.ok(Math.abs(red.c - 0.258) < 0.001);
  assert.ok(Math.abs(red.h - 29.23) < 0.05);
  for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#f97316', '#15f9ad']) {
    assert.equal(fromOklch(toOklch(hex)), hex);
  }
  const fitted = toOklch(fromOklch({ l: 0.7, c: 0.4, h: 240 }));
  assert.ok(Math.abs(fitted.l - 0.7) < 0.003);
  assert.ok(Math.abs(fitted.h - 240) < 1);
  assert.ok(fitted.c < 0.4);
});

test('Machado 严重度 100 矩阵在线性 RGB 中模拟，保持黑白中性', () => {
  const red = { protanopia: '#6d5f00', deuteranopia: '#a39000', tritanopia: '#ff000f' };
  for (const [model, expected] of Object.entries(red)) {
    assert.equal(simulateColorVision('#ff0000', model), expected);
    assert.equal(simulateColorVision('#000000', model), '#000000');
    assert.equal(simulateColorVision('#ffffff', model), '#ffffff');
  }
  // 八色必须检查所有 28 对，不能只比较相邻色。
  for (const report of Object.values(checkColorVision(Array(8).fill('#f97316')).models)) {
    assert.equal(report.conflicts.length, 28);
    assert.equal(report.minimum, 0);
  }
});

test('色觉校正有界、确定，并降低多种品牌色共用八色的冲突损失', () => {
  for (const accent of ['#f97316', '#0095ff', '#15f9ad', '#8b5cf6']) {
    const input = { ...seeds, accent };
    const result = createCategoricalPalette(input);
    assert.deepEqual(createCategoricalPalette(input), result);
    assert.equal(new Set(Object.values(result.colors)).size, 8);
    assert.ok(result.vision.after.loss < result.vision.before.loss, accent);
    assert.ok(result.vision.after.models.normal.minimum >= seriesRecipe.distance.normal);
    assert.equal(result.series['series-1'].correction.h, 0);
    for (const [key, value] of Object.entries(result.series)) {
      assert.ok(Math.abs(value.correction.h) <= 12);
      assert.ok(Math.abs(value.correction.l) <= 0.06);
      assert.ok(value.correction.c >= -0.02 && value.correction.c <= 0);
      const fill = result.colors[key];
      assert.ok(contrast(fill, input.ink) >= seriesRecipe.textContrast);
    }
  }
});

test('保持固定色相槽位，中性品牌色采用已说明的默认色相', () => {
  const original = createCategoricalPalette(seeds);
  assert.deepEqual(Object.values(original.series).map(s => s.hueOffset), seriesRecipe.hueOffsets);
  const neutral = createCategoricalPalette({ ...seeds, accent: '#808080' });
  assert.equal(neutral.vision.neutralBrand, true);
  assert.equal(neutral.vision.anchor, original.vision.anchor);
  assert.deepEqual(neutral.colors, original.colors);
});
