/** 网页展示导出的 SVG；SSG-MD 不运行此插件，所以仍保留原始 Typst 围栏。 */
import path from 'node:path';

const element = (name, attrs, children = []) => ({
  type: 'mdxJsxFlowElement', name, children,
  attributes: Object.entries(attrs).map(([name, value]) => ({ type: 'mdxJsxAttribute', name, value })),
});

export default function remarkTypst({ docs, figures }) {
  return (tree, file) => {
    const page = figures[path.relative(docs, file.path).split(path.sep).join('/')];
    let heading = '';
    function visit(parent) {
      parent.children?.forEach((node, i) => {
        if (node.type === 'heading') {
          heading = node.children.map(child => child.value || '').join('').replace(/\s*\{#[^}]+\}$/, '');
        }
        if (node.type === 'code' && node.lang === 'typ') {
          node.lang = 'typst'; // Shiki 示例沿用 Typst 的语言标签和高亮。
          return;
        }
        if (node.type !== 'code' || node.lang !== 'typst') {
          visit(node);
          return;
        }
        const urls = page?.[node.value];
        if (!urls) file.fail('缺少 Typst 编译结果，请重新导出正文', node);
        const images = urls.map((url, index) => element('a', { href: url }, [
          element('img', { src: url, alt: [heading, 'Typst 图', urls.length > 1 && `第 ${index + 1} 页`]
            .filter(Boolean).join(' · ') }),
        ]));
        parent.children[i] = element('figure', { className: 'sj-typst' }, [
          ...images, element('details', {}, [
            element('summary', {}, [{ type: 'text', value: '查看 Typst 源码' }]), node,
          ]),
        ]);
      });
    }
    visit(tree);
  };
}
