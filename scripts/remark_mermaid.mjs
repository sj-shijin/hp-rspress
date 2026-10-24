/** 构建期渲染 Mermaid；Rspress 的 SSG-MD 不执行自定义 Remark 插件，保留原始代码。 */
import { createHash } from 'node:crypto';
import { render } from 'pele';
import { withPeleHitAreas } from 'cinderfolio/pele';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';

const html = unified().use(rehypeParse, { fragment: true });
const element = (tagName, className, children) => ({
  type: 'element', tagName, properties: { className: [className] }, children,
});

export default function remarkMermaid() {
  return (tree, file) => {
    let index = 0;
    function visit(parent) {
      parent.children?.forEach((node, position) => {
        if (node.type !== 'code' || node.lang !== 'mermaid') {
          visit(node);
          return;
        }
        const id = createHash('sha256').update(`${file.path || ''}:${index++}:${node.value}`)
          .digest('hex').slice(0, 12);
        let svg;
        try {
          svg = render(node.value, {
            idPrefix: `mermaid-${id}`,
            fontFamily: 'LXGW WenKai Mono GB, sans-serif',
            fontFamilyMono: 'LXGW WenKai Mono GB, monospace',
          }).svg;
        } catch (error) {
          file.fail(`Mermaid / Pele: ${error.message}`, node);
        }
        // 使用 MDX 节点，避免普通 .md 的 rehype-raw 将组件名转为小写 HTML 标签。
        // 图表与源码按顺序传给 Mermaid；源码由组件中的官方 Callout 包裹。
        const parts = [
          element('div', 'sj-mermaid__diagram', html.parse(withPeleHitAreas(svg)).children),
          { type: 'element', tagName: 'pre', properties: {}, children: [
            element('code', 'language-mermaid', [{ type: 'text', value: node.value + '\n' }]),
          ] },
        ];
        parent.children[position] = {
          type: 'mdxJsxFlowElement', name: 'Mermaid', position: node.position,
          attributes: [{ type: 'mdxJsxAttribute', name: 'source', value: node.value }],
          children: parts.map(part => ({
            type: 'paragraph', children: [],
            data: { hName: part.tagName, hProperties: part.properties, hChildren: part.children },
          })),
        };
      });
    }
    visit(tree);
  };
}
