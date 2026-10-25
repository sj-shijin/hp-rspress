import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Marp } from '@marp-team/marp-core';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import { createMarpCss, marpFonts } from '../marp.mjs';
import { createShikiTheme } from '../shiki.mjs';
import { createPeleTheme } from '../pele.mjs';
import config from '../marp-engine.mjs';

const parser = unified().use(rehypeParse, { fragment: true });
let marp;
before(async () => {
  // 与 CLI 一致，保留 Marp 默认的安全 HTML 允许列表。
  marp = await config.engine({ marp: new Marp() });
  marp.themeSet.add(createMarpCss());
});

function elements(node, match) {
  return [node, ...(node.children || []).flatMap(child => elements(child, match))].filter(match);
}

test('正式引擎编译使用演示，保留 Pele、Shiki 高亮、代码缩放与自动亮暗', async () => {
  const css = createMarpCss();
  assert.doesNotMatch(css, /@import|--rp-|rp-dark|\.hljs-/);
  const result = marp.render(await fs.readFile(new URL('../examples/marp.md', import.meta.url), 'utf8'));
  const tree = parser.parse(result.html);
  const slides = elements(tree, node => node.tagName === 'section' && node.properties?.id);
  assert.equal(slides.length, result.comments.length);
  assert.ok(result.comments.every(notes => notes.length > 0));
  assert.equal(elements(tree, node => node.properties?.className?.includes('pele')).length, 1);
  const code = elements(tree, node => node.tagName === 'pre' && node.properties?.className?.includes('shiki'))
    .filter(block => elements(block, node => node.type === 'text' && node.value.includes('slideTitle')).length);
  assert.equal(code.length, 1);
  assert.equal(code[0].properties.dataAutoScaling, 'downscale-only');
  assert.ok(elements(code[0], node => node.properties?.style?.includes('var(--cf-accent-darker)')).length > 0);
  assert.ok(elements(code[0], node => node.properties?.style?.includes('--shiki-light-font-style:italic')).length > 0);
  assert.match(result.css, /prefers-color-scheme:\s*dark/);
  assert.match(result.css, /--cf-background:\s*#fafaf8/);
  assert.match(result.css, /--cf-background:\s*#121212/);
  assert.match(result.css, /--cf-accent-lighter:\s*#fcaf79/);
  assert.match(result.html, /data-marpit-svg/);
  assert.match(result.css, /--shiki-light-font-weight/);
  assert.ok(result.css.includes(marpFonts.text));
  assert.ok(result.css.includes(marpFonts.code));
  const diagrams = elements(tree, node => node.tagName === 'svg' && node.properties?.className?.includes('pele'));
  assert.ok(diagrams.every(svg => svg.properties.style.includes(marpFonts.text)
    && svg.properties.style.includes(marpFonts.code)));
  const flowchart = diagrams.find(svg => svg.properties.className.includes('pele-flowchart'));
  assert.ok(elements(flowchart, node => node.properties?.className?.includes('cf-pele-edge-hit')).length > 0);
  for (const mode of ['light', 'dark']) {
    const { colors, onFill } = createPeleTheme(undefined, mode);
    for (const [key, value] of Object.entries(colors)) assert.ok(css.includes(`--pele-${key}: ${value};`));
    for (const [key, value] of Object.entries(onFill)) assert.ok(css.includes(`--cf-pele-on-${key}: ${value};`));
  }
  // 当前亮暗主题共用字形，CSS 只需读取一套字形变量；颜色仍分别计算。
  const styles = mode => createShikiTheme(undefined, mode).tokenColors.map(rule => rule.settings.fontStyle);
  assert.deepEqual(styles('light'), styles('dark'));
});

test('两种 size 共用封面与过渡页预设，正文分页与章节跳转保持对应', async () => {
  const source = await fs.readFile(new URL('../examples/marp.md', import.meta.url), 'utf8');
  for (const [size, width] of [['16:9', 1280], ['4:3', 960]]) {
    const { html } = marp.render(source.replace(/^size: 16:9$/m, `size: ${size}`));
    const tree = parser.parse(html);
    const slides = elements(tree, node => node.tagName === 'section' && node.properties?.id);
    const canvases = elements(tree, node => node.tagName === 'svg' && node.properties?.dataMarpitSvg !== undefined);
    assert.equal(slides.length, 16);
    assert.equal(canvases.length, slides.length);
    assert.ok(slides.every(slide => slide.properties.dataSize === size));
    assert.ok(canvases.every(svg => svg.properties.viewBox === `0 0 ${width} 720`));
    const [cover, ...body] = slides;
    assert.ok(cover.properties.className.includes('cover'));
    assert.equal(cover.properties.dataPaginate, 'skip');
    assert.equal(elements(cover, node => ['header', 'footer'].includes(node.tagName)).length, 0);
    assert.equal(elements(tree, node => node.tagName === 'h1').length, 1);
    const coverTitle = cover.children.find(node => node.tagName === 'h1');
    assert.deepEqual(coverTitle.children.filter(node => node.tagName).map(node => node.tagName), ['small']);
    assert.ok(body.every(slide => !slide.properties.className?.includes('cover')));
    assert.ok(body.every(slide => slide.children.filter(node => node.tagName === 'h2').length === 1));
    assert.deepEqual(body.map(slide => slide.properties.dataMarpitPagination), Array.from({ length: 15 }, (_, i) => String(i + 1)));
    assert.ok(body.every(slide => slide.properties.dataMarpitPaginationTotal === '15'));
    // compact 只作用于指定页，不泄漏到相邻的普通正文和过渡页。
    assert.deepEqual(slides.filter(slide => slide.properties.className?.includes('compact'))
      .map(slide => slide.properties.id), ['7', '13']);
    const compact = slides[6];
    assert.equal(elements(compact, node => node.properties?.className?.includes('cf-cols')).length, 1);
    assert.equal(elements(compact, node => node.properties?.className?.includes('cf-col')).length, 2);
    const transitions = slides.filter(slide => slide.properties.className?.includes('transition'));
    assert.deepEqual(transitions.map(slide => slide.properties.id), ['2', '5', '11']);
    for (const transition of transitions) {
      assert.deepEqual(transition.children.filter(node => node.tagName && !['header', 'footer'].includes(node.tagName))
        .map(node => node.tagName), ['p', 'h2', 'p']);
    }
    const chapters = { '#2': '快速开始', '#5': '特性展示', '#11': '高级 Marp' };
    for (const header of elements(tree, node => node.tagName === 'header')) {
      const links = elements(header, node => node.tagName === 'a');
      assert.deepEqual(links.map(link => link.properties.href), Object.keys(chapters));
      for (const link of links) {
        const slide = slides.find(item => `#${item.properties.id}` === link.properties.href);
        const title = elements(slide, node => node.tagName === 'h2')[0];
        assert.equal(elements(title, node => node.type === 'text').map(node => node.value).join(''), chapters[link.properties.href]);
      }
    }
  }
});

test('使用演示保留分栏、原生内容和分步列表，图片资源可独立分发', async () => {
  const { html } = marp.render(await fs.readFile(new URL('../examples/marp.md', import.meta.url), 'utf8'));
  const tree = parser.parse(html);
  for (const tag of [
    'h1', 'h2', 'h3', 'small', 'p', 'strong', 'a', 'code',
    'ul', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'pre', 'mjx-container', 'figure', 'figcaption', 'svg', 'header', 'footer',
  ]) {
    assert.ok(elements(tree, node => node.tagName === tag).length, tag);
  }
  assert.equal(elements(tree, node => node.properties?.dataMarpitFragment !== undefined).length, 3);

  // 原生 HTML 容器内仍解析 Markdown，上下单栏与中间双栏保持同级。
  const slide = elements(tree, node => node.tagName === 'section' && node.properties.id === '8')[0];
  const columns = elements(slide, node => node.properties?.className?.includes('cf-cols'));
  assert.deepEqual(slide.children.filter(node => node.tagName && !['header', 'footer'].includes(node.tagName))
    .map(node => node.tagName), ['h2', 'div', 'div', 'div']);
  const singleColumns = slide.children.filter(node => node.properties?.className?.includes('cf-col'));
  assert.deepEqual(singleColumns.map(node => node.properties.className), [['cf-col', 'cf-align-tc'], ['cf-col', 'cf-align-tr']]);
  const cells = columns[0].children.filter(node => node.properties?.className?.includes('cf-col'));
  assert.equal(cells.length, 2);
  assert.deepEqual(cells[0].properties.className, ['cf-col']);
  assert.deepEqual(cells[1].properties.className, ['cf-col', 'cf-align-tc']);
  assert.ok(elements(cells[0], node => node.tagName === 'pre').length > 0);
  assert.equal(elements(cells[1], node => node.tagName === 'img').length, 1);
  assert.equal(elements(cells[1], node => node.tagName === 'figcaption').length, 1);

  const weighted = elements(tree, node => node.tagName === 'section' && node.properties.id === '9')[0];
  assert.deepEqual(elements(weighted, node => node.properties?.className?.includes('cf-col'))
    .map(node => node.properties.className), [
    ['cf-col', 'cf-w3', 'cf-align-ml'], ['cf-col', 'cf-w2', 'cf-align-tc'],
  ]);

  const directory = new URL('../examples/assets/', import.meta.url);
  const assets = JSON.parse(await fs.readFile(new URL('SOURCE.json', directory), 'utf8'));
  for (const asset of assets) {
    assert.ok(html.includes(`./assets/${asset.file}`));
    const bytes = await fs.readFile(new URL(asset.file, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.ok(asset.author && asset.source && asset.license);
  }
});

test('封面沿用原生 h1 / small，纯主题也保留可选副标题、手动换行与信息段落', () => {
  const native = new Marp();
  native.themeSet.add(createMarpCss());
  for (const size of ['16:9', '4:3']) {
    for (const title of ['# 简洁标题', '# 面向异构计算的<br>算法设计与性能优化']) {
      for (const subtitle of ['', ' <small>从研究问题到清晰结论</small>']) {
        const source = `---\ntheme: cinderfolio\nsize: ${size}\n---\n\n<!-- _class: cover -->\n\n${title}${subtitle}\n\n作者\n\n日期\n\n---\n\n## 正文\n\n### 页内小标题`;
        for (const engine of [native, marp]) {
          const tree = parser.parse(engine.render(source).html);
          const slides = elements(tree, node => node.tagName === 'section' && node.properties?.id);
          const heading = slides[0].children.find(node => node.tagName === 'h1');
          assert.ok(heading);
          assert.equal(elements(heading, node => node.tagName === 'small').length, subtitle ? 1 : 0);
          assert.equal(elements(heading, node => node.tagName === 'br').length, title.includes('<br>') ? 1 : 0);
          assert.equal(slides[0].children.filter(node => node.tagName === 'p').length, 2);
          assert.deepEqual(slides[1].children.filter(node => /^h[1-6]$/.test(node.tagName)).map(node => node.tagName), ['h2', 'h3']);
        }
      }
    }
  }
});

test('行内高亮与上下标保留删除线、数学公式、转义与代码原文', () => {
  const source = [
    '==高亮 **重点**==，x^2^ 与 H~2~O，~~旧结论~~。',
    '> [!IMPORTANT]\n> ==结论==：x^2^ 与 H~2~O。',
    '$x^2 + H_2O$',
    String.raw`\=\=原样\=\= \^上标\^ \~下标\~`,
    '`==原样== x^2^ H~2~O`',
    '```text\n==原样== x^2^ H~2~O\n```',
  ].join('\n\n');
  const tree = parser.parse(marp.render(source).html);
  const text = node => elements(node, child => child.type === 'text').map(child => child.value).join('');
  const marks = elements(tree, node => node.tagName === 'mark');
  assert.deepEqual(marks.map(text), ['高亮 重点', '结论']);
  assert.equal(elements(marks[0], node => node.tagName === 'strong').length, 1);
  assert.deepEqual(elements(tree, node => node.tagName === 'sup').map(text), ['2', '2']);
  assert.deepEqual(elements(tree, node => node.tagName === 'sub').map(text), ['2', '2']);
  assert.equal(elements(tree, node => node.tagName === 's').length, 1);
  assert.equal(elements(tree, node => node.tagName === 'mjx-container').length, 1);
  assert.ok(text(tree).includes('==原样== ^上标^ ~下标~'));
  const code = elements(tree, node => node.tagName === 'code');
  assert.equal(code.length, 2);
  assert.ok(code.every(node => text(node).includes('==原样== x^2^ H~2~O')));
  assert.ok(code.every(node => elements(node, child => ['mark', 'sup', 'sub'].includes(child.tagName)).length === 0));
});

test('五种标注块可用于分栏，结论省略标题，正文保留 Markdown 结构', () => {
  const types = { note: '说明', tip: '提示', important: '', warning: '注意', caution: '警告' };
  const source = Object.keys(types).map(type => `<div class="cf-col">\n\n> [!${type.toUpperCase()}]\n> **结论**与*说明*。\n>\n> - 证据一\n> - 证据二\n\n</div>`).join('\n\n');
  const tree = parser.parse(marp.render(`<div class="cf-cols">\n\n${source}\n\n</div>`).html);
  const columns = elements(tree, node => node.properties?.className?.includes('cf-col'));
  assert.equal(columns.length, 5);
  Object.entries(types).forEach(([type, title], index) => {
    const blocks = columns[index].children.filter(node => node.properties?.className?.includes('markdown-alert'));
    assert.equal(blocks.length, 1);
    assert.ok(blocks[0].properties.className.includes(`markdown-alert-${type}`));
    const titles = elements(blocks[0], node => node.properties?.className?.includes('markdown-alert-title'));
    assert.equal(titles.length, title ? 1 : 0);
    if (title) assert.equal(titles[0].children[0].value, title);
    assert.equal(elements(blocks[0], node => node.tagName === 'strong').length, 1);
    assert.equal(elements(blocks[0], node => node.tagName === 'em').length, 1);
    assert.equal(elements(blocks[0], node => node.tagName === 'li').length, 2);
  });
});

test('标注块内嵌套引用正确闭合，普通引用、未知标记与围栏保持原样', () => {
  const source = `> [!NOTE]
> 正文。
>
> > 引用内容。
>
> 引用之后。

> 普通引用。

---

> [!UNKNOWN]
> 保留普通引用。

\`\`\`markdown
> [!IMPORTANT]
> 仅为源码。
\`\`\``;
  const { html } = marp.render(source);
  const tree = parser.parse(html);
  const slides = elements(tree, node => node.tagName === 'section' && node.properties?.id);
  assert.equal(slides.length, 2);
  const alerts = elements(tree, node => node.properties?.className?.includes('markdown-alert'));
  assert.equal(alerts.length, 1);
  assert.deepEqual(alerts[0].children.filter(node => node.tagName).map(node => node.tagName), ['p', 'p', 'blockquote', 'p']);
  assert.equal(elements(alerts[0], node => node.tagName === 'blockquote')[0].children.find(node => node.tagName === 'p').children[0].value, '引用内容。');
  assert.equal(alerts[0].children.filter(node => node.tagName).at(-1).children[0].value, '引用之后。');
  assert.equal(slides[0].children.filter(node => node.tagName === 'blockquote').length, 1);
  assert.equal(slides[1].children.filter(node => node.tagName === 'blockquote').length, 1);
  assert.equal(elements(slides[1], node => node.tagName === 'pre').length, 1);
  assert.ok(elements(slides[1], node => node.type === 'text').some(node => node.value.includes('[!UNKNOWN]')));
});

test('Marp 本地字库与来源记录一致，样式仅引用随包 WOFF2', async () => {
  const directory = new URL('../fonts/marp/', import.meta.url);
  const css = await fs.readFile(new URL('font.css', directory), 'utf8');
  const { fonts } = JSON.parse(await fs.readFile(new URL('SOURCE.json', directory), 'utf8'));
  assert.doesNotMatch(css, /https?:|local\(/);
  for (const font of fonts) {
    const bytes = await fs.readFile(new URL(font.file, directory));
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', font.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), font.sha256, font.file);
    assert.ok(css.includes(`url("./${font.file}")`), font.file);
  }
  for (const license of ['NotoSansSC-OFL.txt', 'Inter-OFL.txt', 'SarasaMonoSC-OFL.txt']) {
    assert.match(await fs.readFile(new URL(license, directory), 'utf8'), /SIL OPEN FONT LICENSE|SIL Open Font License/);
  }
});

test('重复图表的真实 ID 唯一、引用归属正确，多次渲染输出稳定', () => {
  const source = '```mermaid\nflowchart LR\n accTitle: 阅读路线\n accDescr: 从输入到输出。\n A[输入] --> B[输出]\n```';
  const markdown = source + '\n\n---\n\n' + source;
  const { html } = marp.render(markdown);
  const tree = parser.parse(html);
  const diagrams = elements(tree, node => node.tagName === 'svg' && node.properties?.className?.includes('pele'));
  assert.equal(diagrams.length, 2);
  const allIds = elements(tree, node => node.properties?.id).map(node => node.properties.id);
  assert.equal(new Set(allIds).size, allIds.length);
  for (const svg of diagrams) {
    const ids = elements(svg, node => node.properties?.id).map(node => node.properties.id);
    assert.equal(ids.length, 2);
    for (const key of ['ariaLabelledBy', 'ariaDescribedBy']) {
      assert.ok(svg.properties[key].length > 0);
      for (const id of svg.properties[key]) assert.ok(ids.includes(id), `${key}: ${id}`);
    }
  }
  // data-id 不是 DOM ID，节点名可以在两张图中复用。
  assert.equal(elements(tree, node => node.properties?.dataId === 'A').length, 2);
  assert.equal(marp.render(markdown).html, html);
});

test('常用语言和别名共用 Shiki，未知语言保留为转义后的纯文本', () => {
  const examples = [
    ['ts', 'function read(value: number) { return value; }'],
    ['cpp', 'int read(int value) { return value; }'],
    ['python', 'def read(value):\n    return value'],
    ['vue', '<p v-if="ready">{{ title }}</p>'],
    ['html', '<h1>Hello</h1>'],
    ['latex', '\\section{Hello}'],
    ['unknown-language', '<script>alert("plain text")</script>'],
  ];
  const markdown = examples.map(([lang, code]) => `\`\`\`${lang}\n${code}\n\`\`\``).join('\n\n');
  const tree = parser.parse(marp.render(markdown).html);
  const blocks = elements(tree, node => node.tagName === 'pre' && node.properties?.className?.includes('shiki'));
  assert.equal(blocks.length, examples.length);
  assert.equal(elements(blocks.at(-1), node => node.tagName === 'script').length, 0);
  assert.ok(elements(tree, node => node.type === 'text').some(node => node.value.includes(examples.at(-1)[1])));
  assert.throws(() => marp.render('```mermaid\nnot-a-diagram\n```'));
});
