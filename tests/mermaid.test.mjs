import assert from 'node:assert/strict';
import test from 'node:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMermaid from '../scripts/remark_mermaid.mjs';

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

test('普通代码及行内代码保持原样', async () => {
  const tree = await compile('`mermaid`\n\n```python\nprint("hello")\n```');
  assert.equal(descendants(tree, node => node.tagName === 'svg').length, 0);
  assert.equal(tree.children[1].type, 'code');
  assert.equal(tree.children[1].value, 'print("hello")');
});

test('错误图在编译时失败并带出文件与行号', async () => {
  await assert.rejects(compile('# 标题\n\n```mermaid\nnot-a-diagram\n```'), error => {
    assert.match(error.message, /Mermaid \/ Pele/);
    assert.equal(error.file, 'diagram.md');
    assert.equal(error.line, 3);
    return true;
  });
});
