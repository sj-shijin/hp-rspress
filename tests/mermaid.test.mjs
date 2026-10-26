import assert from 'node:assert/strict';
import test from 'node:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMermaid from '../scripts/remark_mermaid.mjs';
import { enhanceMermaid } from '../theme/mermaid_lifecycle.mjs';

async function compile(source) {
  const processor = unified().use(remarkParse).use(remarkMermaid);
  return processor.run(processor.parse(source), { path: 'diagram.md' });
}

function descendants(node, match) {
  return [node, ...(node.data?.hChildren || node.children || []).flatMap(child => descendants(child, match))]
    .filter(match);
}

test('流程图、时序图和饼图产生实际 SVG，并保留中文与原始源码', async () => {
  const examples = [
    ['flowchart', 'flowchart LR\n  A[中文起点] --> B[English 终点]'],
    ['sequence', 'sequenceDiagram\n  Alice->>Bob: 中文消息'],
    ['pie', 'pie title 内容分布\n  "基础知识" : 2\n  "研究增量" : 1'],
  ];
  for (const [type, source] of examples) {
    const tree = await compile('```mermaid\n' + source + '\n```');
    const svg = descendants(tree, node => node.tagName === 'svg');
    assert.equal(svg.length, 1);
    assert.ok(svg[0].properties.className.includes(`pele-${type}`));
    assert.ok(descendants(svg[0], node => ['path', 'rect', 'circle'].includes(node.tagName)).length > 0);
    const code = descendants(tree, node => node.tagName === 'code');
    assert.equal(code[0].children[0].value, source + '\n');
    assert.ok(descendants(svg[0], node => node.type === 'text').some(node => /中文|基础知识/.test(node.value)));
  }
});

test('同页重复图的可访问性 ID 不冲突，输出可复现', async () => {
  const source = '```mermaid\nflowchart LR\n accTitle: 阅读路线\n A --> B\n```';
  const tree = await compile(source + '\n\n' + source);
  const ids = descendants(tree, node => node.properties?.id).map(node => node.properties.id);
  assert.ok(ids.length >= 2);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(await compile(source + '\n\n' + source), tree);
});

test('网站生成的 SVG 接入 Cinderfolio 连线命中层', async () => {
  const tree = await compile('```mermaid\nsequenceDiagram\n A-->>B: 返回\n```');
  // 透明度、几何、箭头与 ID 保留由 Cinderfolio 的 pele-svg 测试覆盖。
  assert.ok(descendants(tree, n => n.properties?.className?.includes('cf-pele-edge-hit')).length > 0);
});

test('普通代码及行内代码保持原样', async () => {
  const tree = await compile('`mermaid`\n\n```python\nprint("hello")\n```');
  assert.equal(descendants(tree, node => node.tagName === 'svg').length, 0);
  assert.equal(tree.children[1].type, 'code');
  assert.equal(tree.children[1].value, 'print("hello")');
});

test('显式官方渲染标记使用独立组件，默认 Mermaid 围栏仍由 Pele 渲染', async () => {
  const source = 'flowchart LR\n A[文稿] --> B[发布]';
  const tree = await compile('```mermaid renderer=mermaid\n' + source + '\n```\n\n```mermaid\n' + source + '\n```');
  assert.equal(tree.children[0].name, 'CinderfolioMermaid');
  assert.equal(descendants(tree.children[0], node => node.tagName === 'svg').length, 0);
  assert.equal(descendants(tree.children[0], node => node.tagName === 'code')[0].children[0].value, source + '\n');
  assert.equal(tree.children[1].name, 'Mermaid');
  assert.equal(descendants(tree.children[1], node => node.tagName === 'svg').length, 1);
});

test('错误图在编译时失败并带出文件与行号', async () => {
  await assert.rejects(compile('# 标题\n\n```mermaid\nnot-a-diagram\n```'), error => {
    assert.match(error.message, /Mermaid \/ Pele/);
    assert.equal(error.file, 'diagram.md');
    assert.equal(error.line, 3);
    return true;
  });
});

const turn = () => new Promise(resolve => setImmediate(resolve));

test('客户端接管使用容器宽度，卸载时销毁监听', async () => {
  const container = {};
  let destroyed = 0, received;
  const dispose = enhanceMermaid(container, 'flowchart LR\n A --> B', async () => ({
    mountAsync: async (...args) => {
      received = args;
      return { destroy() { destroyed++; } };
    },
  }));
  await turn();
  assert.equal(received[0], container);
  assert.equal(received[2].autoDirection, true);
  assert.equal(received[2].directionBreakpoint, 640);
  assert.equal(received[2].maxWidth, undefined);
  dispose();
  assert.equal(destroyed, 1);
});

test('页面在懒加载完成前离开，不再创建图表监听', async () => {
  let resolveLoad, mounted = 0;
  const loading = new Promise(resolve => { resolveLoad = resolve; });
  const dispose = enhanceMermaid({}, 'flowchart LR\n A --> B', () => loading);
  dispose();
  resolveLoad({ mountAsync: async () => { mounted++; } });
  await turn();
  assert.equal(mounted, 0);
});

test('页面在异步挂载期间离开，迟到的图表立即销毁', async () => {
  let resolveMount, destroyed = 0;
  const mounting = new Promise(resolve => { resolveMount = resolve; });
  const dispose = enhanceMermaid({}, 'flowchart LR\n A --> B', async () => ({
    mountAsync: () => mounting,
  }));
  await turn();
  dispose();
  resolveMount({ destroy() { destroyed++; } });
  await turn();
  assert.equal(destroyed, 1);
});

test('渲染器加载失败时保留原有静态 SVG', async context => {
  context.mock.method(console, 'warn', () => {});
  const container = { innerHTML: '<svg>预生成图表</svg>' };
  const dispose = enhanceMermaid(container, 'flowchart LR\n A --> B', async () => {
    throw new Error('模拟图表模块下载失败');
  });
  await turn();
  assert.equal(container.innerHTML, '<svg>预生成图表</svg>');
  assert.equal(console.warn.mock.callCount(), 1);
  dispose();
});


test('弹窗挂载启用缩放，关闭后不再回调已卸载的界面', async () => {
  let hooks, rendered = 0, errors = 0, destroyed = 0;
  const dispose = enhanceMermaid({}, 'flowchart LR\n A --> B', async () => ({
    mountAsync: async (_container, _source, options) => {
      hooks = options;
      options.onRender({});
      return { destroy() { destroyed++; } };
    },
  }), {
    zoom: { always: true, labels: { reset: '重置视图' } },
    onRender() { rendered++; },
    onError() { errors++; },
  });
  await turn();
  assert.equal(hooks.zoom.always, true);
  assert.equal(hooks.zoom.labels.reset, '重置视图');
  assert.equal(rendered, 1);
  dispose();
  hooks.onRender({});
  hooks.onError(new Error('关闭后才返回的错误'));
  assert.equal(rendered, 1);
  assert.equal(errors, 0);
  assert.equal(destroyed, 1);
});

test('弹窗模块加载失败时通知界面，允许显示重试提示', async () => {
  const failure = new Error('图表模块加载失败');
  let received;
  const dispose = enhanceMermaid({}, 'flowchart LR\n A --> B', async () => {
    throw failure;
  }, { onError(error) { received = error; } });
  await turn();
  assert.equal(received, failure);
  dispose();
});
