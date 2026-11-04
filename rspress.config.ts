import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig } from '@rspress/core';
import { transformerNotationHighlight } from '@shikijs/transformers';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkMermaid from './scripts/remark_mermaid.mjs';
import remarkPseudocode from './scripts/remark_pseudocode.mjs';
import remarkTypst from './scripts/remark_typst.mjs';
import { renderLlmsTxt } from './scripts/render_llms.mjs';
import { createShikiTheme } from 'cinderfolio/shiki';

const generated = path.resolve('.generated');
const require = createRequire(import.meta.url);
const siteOrigin = process.env.SITE_ORIGIN || '';
const navigation = JSON.parse(
  fs.readFileSync(path.join(generated, 'theme-config.json'), 'utf-8'),
);

const knowledgeIndex = JSON.parse(
  fs.readFileSync(path.join(generated, 'docs/public/knowledge/index.json'), 'utf-8'),
);
const typstIndex = path.join(generated, 'typst.json');

// Shiki 先于自定义 rehype 插件运行。
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
  title: 'ShiJin',
  description: '记录思考，整理知识。从问题出发，在阅读与实践中积累理解。',
  lang: 'zh',
  logo: {
    light: '/brand/sj-light.svg',
    dark: '/brand/sj-dark.svg',
  },
  logoText: 'ShiJin',
  logoHref: '/',
  icon: './theme/brand/sj-favicon.svg',
  base: '/',
  siteOrigin,
  sitemap: { siteUrl: siteOrigin || 'http://127.0.0.1:1320' },
  route: { cleanUrls: true },
  llms: {
    llmsTxt: context => renderLlmsTxt(context, knowledgeIndex),
  },
  builderConfig: {
    dev: {
      // 预编译开发模块，避免 Pele 多层动态导入的懒编译兼容问题。
      // 浏览器仍按需下载图表模块，生产构建不受影响。
      lazyCompilation: false,
    },
    performance: {
      // 正式域名与本地预览的虚拟页面数据不能复用同一份缓存。
      buildCache: {
        cacheDigest: [siteOrigin],
        // 配色或 Typst 图变化后，正文需要重新编译。
        buildDependencies: [require.resolve('cinderfolio/shiki'), require.resolve('cinderfolio/pseudocode-render'),
          path.resolve('scripts/remark_typst.mjs'), typstIndex],
      },
    },
    output: {
      copy: [
        {
          from: path.resolve('theme/fonts/lxgw-wenkai-mono-gb/OFL.txt'),
          to: 'fonts/lxgw-wenkai-mono-gb/OFL.txt',
        },
        { from: path.resolve('theme/brand'), to: 'brand' },
        // 下载产物原样分发，保留 Marp 的 @theme / @size 指令与许可注释。
        { from: path.join(generated, 'cinderfolio'), to: 'cinderfolio', info: { minimized: true } },
        { from: path.join(generated, 'slides'), to: 'slides', noErrorOnMissing: true },
      ],
    },
  },
  markdown: {
    globalComponents: [
      path.resolve('theme/Mermaid.tsx'),
      path.resolve('theme/CinderfolioPreview.tsx'),
      path.resolve('theme/CinderfolioDownload.tsx'),
      path.resolve('theme/CinderfolioTypstPrompt.tsx'),
      path.resolve('theme/MarpPreview.tsx'),
      path.resolve('theme/CinderfolioMermaid.tsx'),
    ],
    shiki: {
      themes: {
        light: createShikiTheme(undefined, 'light', { variables: true }),
        dark: createShikiTheme(undefined, 'dark', { variables: true }),
      },
      defaultColor: false,
      transformers: [transformerNotationHighlight()],
    },
    remarkPlugins: [remarkMath, remarkMathBlocks, remarkMermaid, remarkPseudocode,
      [remarkTypst, { docs: path.join(generated, 'docs'), figures: JSON.parse(fs.readFileSync(typstIndex, 'utf-8')) }]],
    rehypePlugins: [[rehypeKatex, { strict: 'ignore', throwOnError: true }]],
    link: {
      checkDeadLinks: true,
      // 内置检查只登记标题锚点；Pandoc 书目 div 的锚点由 check_build 核验。
      checkAnchors: { excludes: (href: string) => href.startsWith('#ref-') },
    },
  },
  themeConfig: {
    ...navigation,
    lastUpdated: false,
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/sj-shijin/hp-rspress',
      },
    ],
  },
});
