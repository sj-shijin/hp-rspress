import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@rspress/core';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const generated = path.resolve('.generated');
const navigation = JSON.parse(
  fs.readFileSync(path.join(generated, 'theme-config.json'), 'utf-8'),
);

// Rspress 2.0 的 Shiki 先于自定义 rehype 插件运行。
// 块公式改用 div 传给 KaTeX，避免被识别为 language-math 代码块。
function remarkMathBlocks() {
  return (tree: any) => {
    function visit(node: any) {
      if (node.type === 'math') {
        node.data = {
          hName: 'div',
          hProperties: { className: ['math-display'] },
          hChildren: [{ type: 'text', value: node.value }],
        };
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}

export default defineConfig({
  root: path.join(generated, 'docs'),
  outDir: path.join(generated, 'site'),
  title: 'ShiJin 科研知识库',
  description: '基础知识、研究增量与它们之间的关联。',
  lang: 'zh',
  logoText: 'ShiJin',
  base: '/',
  siteOrigin: process.env.SITE_ORIGIN || '',
  route: { cleanUrls: true },
  llms: true,
  markdown: {
    remarkPlugins: [remarkMath, remarkMathBlocks],
    rehypePlugins: [[rehypeKatex, { strict: 'ignore', throwOnError: true }]],
    link: { checkDeadLinks: true, checkAnchors: true },
  },
  themeConfig: {
    ...navigation,
    lastUpdated: false,
    footer: { message: 'ShiJin · 科研知识库' },
  },
});
