/** 在 Shiki 前将 pseudocode 围栏转换为算法 HTML；导出的 Markdown 保留原文。 */
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import { renderPseudocode, pseudocodeOptions } from 'cinderfolio/pseudocode-render';

const html = unified().use(rehypeParse, { fragment: true });

export default function remarkPseudocode({ math = 'katex' } = {}) {
  return (tree, file) => {
    let number = 0;
    function visit(parent) {
      parent.children?.forEach((node, position) => {
        if (node.type !== 'code' || node.lang !== 'pseudocode') {
          visit(node);
          return;
        }
        try {
          const rendered = html.parse(renderPseudocode(node.value, ++number,
            pseudocodeOptions(node.meta, math))).children[0];
          parent.children[position] = {
            type: 'paragraph', children: [], position: node.position,
            data: { hName: rendered.tagName, hProperties: rendered.properties, hChildren: rendered.children },
          };
        } catch (error) {
          file.fail(`Pseudocode: ${error.message}`, node);
        }
      });
    }
    visit(tree);
  };
}
