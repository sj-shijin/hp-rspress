import assert from 'node:assert/strict';
import test from 'node:test';
import { seeds, createGrayScale, createAccentScale, contrast } from '../palette.mjs';
import { createPeleTheme } from '../pele.mjs';
import { createMermaidTheme } from '../mermaid.mjs';

for (const mode of ['light', 'dark']) {
  test(`Mermaid ${mode} 复用固定灰阶、品牌档位和同序八色，不派生新颜色`, () => {
    const before = { gray: createGrayScale(), brand: createAccentScale() };
    const { colors: c, onFill } = createPeleTheme(seeds, mode);
    const config = createMermaidTheme(seeds, mode);
    const v = config.themeVariables;
    assert.equal(config.theme, 'base');
    assert.equal(config.look, 'classic');
    assert.equal(v.darkMode, mode === 'dark');
    assert.equal(v.pieOpacity, 1);
    assert.equal(v.background, c.bg);
    assert.equal(v.primaryColor, c.surface);
    assert.equal(v.primaryBorderColor, c.border);
    assert.equal(v.clusterBkg, c['surface-alt']);
    assert.equal(v.taskBkgColor, c.accent);
    assert.equal(v.critBkgColor, c.critical);
    assert.equal(v.taskTextColor, onFill.accent);
    assert.ok(contrast(v.taskTextColor, v.taskBkgColor) >= 4.5);
    assert.ok(contrast(v.taskTextLightColor, v.critBkgColor) >= 4.5);
    // Mermaid 对 active / done 共用字色，二者底色均使用对应灰阶。
    for (const key of ['doneTaskBkgColor', 'activeTaskBkgColor']) {
      assert.ok(contrast(v.taskTextDarkColor, v[key]) >= 4.5);
    }
    for (let i = 0; i < 12; i++) {
      const key = `series-${i % 8 + 1}`;
      assert.equal(v[`pie${i + 1}`], c[key]);
      assert.equal(v[`cScale${i}`], c[key]);
      assert.equal(v[`cScaleLabel${i}`], onFill[key]);
      if (i < 8) {
        assert.equal(v[`git${i}`], c[key]);
        assert.equal(v[`gitBranchLabel${i}`], onFill[key]);
        assert.equal(v.xyChart.plotColorPalette.split(',')[i], c[key]);
      }
    }
    assert.doesNotMatch(JSON.stringify(config), /var\(|--rp-|rp-dark|sj-mermaid/);
    assert.deepEqual({ gray: createGrayScale(), brand: createAccentScale() }, before);
  });
}

test('自定义种子完整更新主题，配置可序列化且相互独立', () => {
  const input = { ink: '#17151e', paper: '#f4f4ff', accent: '#8b5cf6' };
  for (const mode of ['light', 'dark']) {
    const config = createMermaidTheme(input, mode);
    const { colors: c } = createPeleTheme(input, mode);
    assert.equal(config.themeVariables.background, mode === 'light' ? input.paper : input.ink);
    assert.equal(config.themeVariables.taskBkgColor, c.accent);
    assert.equal(config.themeVariables.git0, c['series-1']);
    assert.deepEqual(JSON.parse(JSON.stringify(config)), config);
    config.themeVariables.xyChart.titleColor = '#000000';
    assert.equal(createMermaidTheme(input, mode).themeVariables.xyChart.titleColor, c.fg);
  }
});
