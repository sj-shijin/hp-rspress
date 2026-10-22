import assert from 'node:assert/strict';
import test from 'node:test';
import { seeds, recipes, createGrayScale, adjustLightness, createAccentScale, createPalette, contrast } from '../cinderfolio/palette.mjs';
import { themeVariables, createColorCss, createPeleCss, peleRoles } from '../cinderfolio/css.mjs';
import { createRspressCss } from '../cinderfolio/rspress.mjs';

test('ink 到 paper 十六等分，两个端点和十五个中间灰保持固定步长', () => {
  assert.deepEqual(createGrayScale(), {
    g0: '#121212', g1: '#212120', g2: '#2f2f2f', g3: '#3e3e3d',
    g4: '#4c4c4c', g5: '#5b5b5a', g6: '#696968', g7: '#787877',
    g8: '#868685', g9: '#959593', g10: '#a3a3a2', g11: '#b2b2b0',
    g12: '#c0c0bf', g13: '#cfcfcd', g14: '#dddddb', g15: '#ececea', g16: '#fafaf8',
  });
});

test('中性职责引用固定灰阶，暗色使用对应镜像档位', () => {
  const gray = createGrayScale();
  const { light, dark } = createPalette();
  for (const [key, recipe] of Object.entries(recipes)) {
    if (recipe.gray === undefined) continue;
    assert.equal(light[key], gray[`g${recipe.gray}`], `light.${key}`);
    assert.equal(dark[key], gray[`g${16 - recipe.gray}`], `dark.${key}`);
  }
});

test('单一橙色种子保持已确认的五档色阶', () => {
  assert.deepEqual(createAccentScale(), {
    darker: '#d65b06', dark: '#ef6606', brand: '#f97316', light: '#fa9148', lighter: '#fcaf79',
  });
});

test('文字选区保持淡橙，控件选中使用品牌实底与深色文字', () => {
  const { light, dark } = createPalette();
  assert.equal(light.selection, '#fad8c0');
  assert.equal(dark.selection, '#4c2a13');
  assert.equal(light.controlSelectedBackground, '#f97316');
  assert.equal(light.controlSelectedForeground, '#121212');
  assert.equal(dark.controlSelectedBackground, '#f97316');
  assert.equal(dark.controlSelectedForeground, '#121212');
});

test('更换品牌色后，控件选中文字从自定义端点中自动选择深色或浅色', () => {
  for (const [accent, expected] of [['#000080', '#f3f5f7'], ['#eab308', '#102030']]) {
    const input = { ink: '#102030', paper: '#f3f5f7', accent };
    for (const colors of Object.values(createPalette(input))) {
      assert.equal(colors.controlSelectedBackground, accent);
      assert.equal(colors.controlSelectedForeground, expected);
      assert.ok(contrast(colors.controlSelectedForeground, colors.controlSelectedBackground) >= 4.5);
    }
    assert.ok(createRspressCss(input).includes(`--cf-control-selected-foreground: ${expected};`));
  }
});

test('更换黑白种子不会改变橙色链接、交互和描边，避免再次混成棕色', () => {
  const original = createPalette();
  const changed = createPalette({ ...seeds, ink: '#001f3f', paper: '#fffcf0' });
  for (const mode of ['light', 'dark']) {
    for (const role of ['interaction', 'link', 'diagramStroke']) assert.equal(changed[mode][role], original[mode][role]);
    assert.notEqual(changed[mode].selectedBackground, original[mode].selectedBackground);
    assert.notEqual(changed[mode].selection, original[mode].selection);
  }
});

test('原站用途分工：主橙交互、亮色深橙链接和更深描边、暗色浅橙', () => {
  const { light, dark } = createPalette();
  const scale = createAccentScale();
  assert.equal(light.interaction, scale.brand);
  assert.equal(dark.interaction, scale.brand);
  assert.equal(light.link, scale.dark);
  assert.equal(light.diagramStroke, scale.darker);
  assert.equal(dark.link, scale.light);
  assert.equal(dark.diagramStroke, scale.light);
});

test('更换主题色种子后整组色阶随之改变，灰色与明度端点也能生成', () => {
  assert.deepEqual(createAccentScale('#0000ff'), {
    darker: '#0000cc', dark: '#0000e6', brand: '#0000ff', light: '#3333ff', lighter: '#6666ff',
  });
  assert.equal(adjustLightness('#808080', 10), '#9a9a9a');
  assert.equal(adjustLightness(seeds.accent, 100), '#ffffff');
  assert.equal(adjustLightness(seeds.accent, -100), '#000000');
});

test('独立 Pele CSS 自带亮暗颜色，无需 Rspress 或站内 Mermaid 组件', () => {
  const css = createPeleCss();
  assert.doesNotMatch(css, /@import|rp-dark|--rp-|sj-mermaid/);
  assert.match(css, /\[data-cinderfolio="light"\]/);
  assert.match(css, /\[data-cinderfolio="dark"\]/);
  assert.match(css, /\.cinderfolio-pele \{/);
  assert.match(css, /\.pele-cluster > rect \{\n  fill-opacity: 1;/);
  for (const role of Object.values(peleRoles)) assert.ok(role in recipes, role);
  assert.match(css, /--pele-border: var\(--cf-diagram-stroke\)/);
});

test('实时预览和独立 CSS 导出使用同一组计算值，自定义种子覆盖全部色阶', () => {
  const input = { ink: '#102030', paper: '#f3f5f7', accent: '#3478cc' };
  const css = createPeleCss(input);
  for (const mode of ['light', 'dark']) {
    const variables = themeVariables(input, mode);
    assert.equal(variables['--cf-background'], mode === 'light' ? input.paper : input.ink);
    assert.equal(variables['--cf-accent-brand'], input.accent);
    for (const [key, value] of Object.entries(variables)) assert.ok(css.includes(`${key}: ${value};`), `${mode}.${key}`);
  }
  assert.equal(createColorCss(input, { light: 'html.light', dark: 'html.dark' })
    .includes('[data-cinderfolio='), false);
});

test('Rspress 下载包含完整的亮暗映射，主题色命名不限定具体色相', () => {
  const input = { ink: '#102030', paper: '#f3f5f7', accent: '#3478cc' };
  const css = createRspressCss(input);
  assert.match(css, /html:not\(\.rp-dark\)/);
  assert.match(css, /html\.rp-dark/);
  assert.match(css, /--rp-c-brand: var\(--cf-accent-brand\)/);
  assert.match(css, /--cf-accent-brand: #3478cc/);
  assert.match(css, /--cf-background: #102030/);
  assert.match(css, /--cf-background: #f3f5f7/);
  assert.doesNotMatch(css, /ember|--cf-orange-|--pele-|cinderfolio-sample/);
  assert.equal(recipes.interaction.accent, 'brand');
});
