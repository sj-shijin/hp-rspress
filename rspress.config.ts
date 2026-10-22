import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@rspress/core';
import { pluginSitemap } from '@rspress/plugin-sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkMermaid from './scripts/remark_mermaid.mjs';
import { renderLlmsTxt } from './scripts/render_llms.mjs';

const generated = path.resolve('.generated');
const siteOrigin = process.env.SITE_ORIGIN || '';
const navigation = JSON.parse(
  fs.readFileSync(path.join(generated, 'theme-config.json'), 'utf-8'),
);

const knowledgeIndex = JSON.parse(
  fs.readFileSync(path.join(generated, 'docs/public/knowledge/index.json'), 'utf-8'),
);

const sitemap = pluginSitemap({ siteUrl: siteOrigin || 'http://127.0.0.1:1320' });
const sitemapExcluded = new Set([
  '/404.html',
  ...knowledgeIndex.notes.flatMap((note: { aliases?: string[] }) => note.aliases || []),
]);

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
  plugins: [{
    ...sitemap,
    // 官方插件负责生成；仅过滤已由公开清单定义的兼容跳转页。
    extendPageData(page, isProd) {
      if (!sitemapExcluded.has(page.routePath)) return sitemap.extendPageData?.(page, isProd);
    },
  }],
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
      buildCache: { cacheDigest: [siteOrigin] },
    },
    output: {
      copy: [
        {
          from: path.resolve('theme/fonts/lxgw-wenkai-mono-gb/OFL.txt'),
          to: 'fonts/lxgw-wenkai-mono-gb/OFL.txt',
        },
        { from: path.resolve('theme/brand'), to: 'brand' },
        { from: path.resolve('cinderfolio/dist'), to: 'cinderfolio' },
      ],
    },
  },
  markdown: {
    globalComponents: [
      path.resolve('theme/Mermaid.tsx'),
      path.resolve('theme/CinderfolioPreview.tsx'),
      path.resolve('theme/CinderfolioDownload.tsx'),
    ],
    shiki: {
      themes: { light: 'one-light', dark: 'material-theme-darker' },
      defaultColor: false,
    },
    remarkPlugins: [remarkMath, remarkMathBlocks, remarkMermaid],
    rehypePlugins: [[rehypeKatex, { strict: 'ignore', throwOnError: true }]],
    link: {
      checkDeadLinks: true,
      // 2.0 的内置检查只登记标题锚点；Pandoc 书目 div 的锚点由 check_build 核验。
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
