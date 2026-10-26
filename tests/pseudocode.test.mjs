import assert from 'node:assert/strict';
import test from 'node:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkPseudocode from '../scripts/remark_pseudocode.mjs';

const algorithm = String.raw`\begin{algorithm}
\caption{Conflict}
\begin{algorithmic}
\IF{$C \ne \mathrm{None}$}
  \RETURN $\bot$
\ENDIF
\end{algorithmic}
\end{algorithm}`;

async function compile(source) {
  const processor = unified().use(remarkParse).use(remarkPseudocode);
  return processor.run(processor.parse(source), { path: 'algorithm.md' });
}

function descendants(node) {
  return [node, ...(node.data?.hChildren || node.children || []).flatMap(descendants)];
}

test('算法块生成公式、行号与逐篇编号，Python 源码保持原样', async () => {
  const fence = '```pseudocode\n' + algorithm + '\n```';
  const source = fence + '\n\n```python\nreturn None\n```\n\n' + fence;
  const tree = await compile(source);
  const nodes = descendants(tree);
  assert.equal(nodes.filter(n => n.properties?.className?.includes('katex')).length, 4);
  assert.equal(nodes.filter(n => n.properties?.className?.includes('ps-linenum')).length, 4);
  const text = nodes.filter(n => n.type === 'text').map(n => n.value).join(' ');
  assert.match(text, /Algorithm 1/);
  assert.match(text, /Algorithm 2/);
  assert.equal(tree.children[1].lang, 'python');
  assert.equal(tree.children[1].value, 'return None');
  assert.deepEqual(await compile(source), tree);
});

test('算法语法错误携带文件与围栏所在行，避免静默变回普通代码', async () => {
  await assert.rejects(compile('# 标题\n\n```pseudocode\n\\IF{x}\n```'), error => {
    assert.match(error.message, /Pseudocode/);
    assert.equal(error.file, 'algorithm.md');
    assert.equal(error.line, 3);
    return true;
  });
});

test('同页显式选择 KaTeX 和 MathJax，生成不同公式结构', async () => {
  const tree = await compile(['katex', 'mathjax'].map(math => '```pseudocode math=' + math + '\n' + algorithm + '\n```').join('\n\n'));
  assert.deepEqual(tree.children.map(n => n.data.hProperties.dataMath), ['katex', 'mathjax']);
  assert.equal(descendants(tree.children[0]).filter(n => n.tagName === 'mjx-container').length, 0);
  assert.equal(descendants(tree.children[1]).filter(n => n.tagName === 'mjx-container').length, 2);
  assert.equal(descendants(tree.children[1]).filter(n => n.properties?.className?.includes('katex')).length, 0);
  await assert.rejects(compile('```pseudocode math=unknown\n' + algorithm + '\n```'), /不支持/);
});

test('网页围栏将排版开关传给伪代码渲染器', async () => {
  const tree = await compile('```pseudocode noEnd=false scopeLines=false\n' + algorithm + '\n```');
  const nodes = descendants(tree);
  assert.equal(nodes.some(n => n.properties?.className?.includes('with-scopelines')), false);
  assert.match(nodes.filter(n => n.type === 'text').map(n => n.value).join(' '), /end if/);
});
