import assert from 'node:assert/strict';
import test from 'node:test';
import mermaid from 'mermaid';
import { createMermaidTheme } from 'cinderfolio/mermaid';
import { createMermaidRenderer } from '../theme/cinderfolio_mermaid.mjs';

test('官方 Mermaid 接受导出的亮暗配置，保留分类色与嵌套图表覆盖', () => {
  for (const mode of ['light', 'dark']) {
    const config = createMermaidTheme(undefined, mode);
    mermaid.initialize(config);
    const resolved = mermaid.mermaidAPI.getConfig();
    const actual = resolved.themeVariables;
    for (const key of ['background', 'primaryBorderColor', 'git0', 'git7', 'cScale0', 'cScale11', 'pie8']) {
      assert.equal(actual[key], config.themeVariables[key], `${mode}.${key}`);
    }
    for (const [key, color] of Object.entries(config.themeVariables.xyChart)) {
      assert.equal(actual.xyChart[key], color, `${mode}.xyChart.${key}`);
    }
    for (let i = 0; i < 6; i++) assert.equal(actual[`actor${i}`], config.themeVariables[`actor${i}`]);
    assert.equal(resolved.themeCSS, config.themeCSS);
  }
});

test('并行请求串行应用各自主题，绘制失败不阻塞下一张图', async () => {
  const calls = [], ids = [];
  const container = {};
  let current, loaded = 0;
  const render = createMermaidRenderer(async () => {
    loaded++;
    return { default: {
      initialize(config) { current = config.theme; },
      async render(id, source, target) {
        assert.equal(target, container);
        await new Promise(resolve => setImmediate(resolve));
        calls.push([source, current]);
        ids.push(id);
        if (source === 'bad') throw new Error('invalid diagram');
        return { svg: `<svg>${source}</svg>` };
      },
    } };
  });
  const result = await Promise.allSettled([
    render('light', { theme: 'light' }, undefined, container),
    render('bad', { theme: 'dark' }, undefined, container),
    render('dark', { theme: 'dark' }, undefined, container),
  ]);
  assert.deepEqual(calls, [['light', 'light'], ['bad', 'dark'], ['dark', 'dark']]);
  assert.deepEqual(result.map(item => item.status), ['fulfilled', 'rejected', 'fulfilled']);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(loaded, 1);
});

test('调色后过期或卸载的请求，不再初始化或绘图', async () => {
  let current = true, release, initialized = 0;
  const loading = new Promise(resolve => { release = resolve; });
  const render = createMermaidRenderer(() => loading);
  const pending = render('old', {}, () => current);
  await new Promise(resolve => setImmediate(resolve));
  current = false;
  release({ default: { initialize() { initialized++; } } });
  assert.equal(await pending, undefined);
  assert.equal(initialized, 0);
});
