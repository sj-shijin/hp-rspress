import assert from 'node:assert/strict';
import test from 'node:test';
import { render } from 'pele';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import { withPeleHitAreas } from '../pele.mjs';

const parser = unified().use(rehypeParse, { fragment: true });
const elements = node => [node, ...(node.children ?? []).flatMap(elements)].filter(n => n.type === 'element');
const hasClass = (node, name) => node.properties.className?.includes(name);

test('透明命中层覆盖分组连线、独立路径与折线，保留原图形、箭头和全部 ID', () => {
  const sources = [
    'flowchart LR\n A[起点] -->|关系| B[终点]\n B -.-> C[虚线]',
    'sequenceDiagram\n A->>B: 请求\n B-->>A: 返回',
    'classDiagram\n A <|-- B',
    'erDiagram\n A ||--o{ B : 包含',
    'gitGraph\n commit\n branch feature\n checkout feature\n commit',
    'mindmap\n root((主题))\n  分支一\n  分支二',
    'xychart-beta\n x-axis [A, B, C]\n line [1, 3, 2]',
  ];
  for (const source of sources) {
    const { svg, type } = render(source);
    const before = elements(parser.parse(svg));
    const enhanced = withPeleHitAreas(svg);
    const after = elements(parser.parse(enhanced));
    const hits = after.filter(n => hasClass(n, 'cf-pele-edge-hit'));
    assert.ok(hits.length > 0, type);
    // 新增节点只有分组和命中层；所有原图形及其显示属性原样保留。
    const graphics = nodes => nodes.filter(n => ['path', 'line', 'polyline', 'circle', 'rect', 'polygon'].includes(n.tagName)
      && !hasClass(n, 'cf-pele-edge-hit')).map(n => [n.tagName, n.properties]);
    assert.deepEqual(graphics(after), graphics(before), type);
    assert.deepEqual(after.filter(n => n.properties.id).map(n => n.properties.id),
      before.filter(n => n.properties.id).map(n => n.properties.id), type);
    assert.deepEqual(after.filter(n => hasClass(n, 'pele-marker')).map(n => n.properties),
      before.filter(n => hasClass(n, 'pele-marker')).map(n => n.properties), type);
    for (const hit of hits) {
      assert.equal(hit.properties.opacity, '0');
      assert.equal(hit.properties.pointerEvents, 'none');
      assert.equal(hit.properties.ariaHidden, 'true');
      assert.equal(hit.properties.fill, 'none');
      assert.equal(hit.properties.strokeDashArray, undefined);
      assert.equal(hit.properties.id, undefined);
      const parent = after.find(n => n.children?.includes(hit));
      const visible = parent.children.find(n => n.type === 'element' && !hasClass(n, 'cf-pele-edge-hit')
        && n.tagName === hit.tagName);
      for (const key of ['d', 'points', 'x1', 'x2', 'y1', 'y2', 'transform']) {
        assert.equal(hit.properties[key], visible.properties[key], `${type}.${key}`);
      }
    }
    assert.equal(withPeleHitAreas(enhanced), enhanced, type);
  }
});

test('没有连线的图表保持原样，节点边框与饼图扇区不新增命中层', () => {
  for (const source of ['flowchart LR\n A[单个节点]', 'pie\n "A": 1\n "B": 2']) {
    const { svg } = render(source);
    assert.equal(withPeleHitAreas(svg), svg);
  }
});
