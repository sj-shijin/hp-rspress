import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Marp } from '@marp-team/marp-core';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import { createMarpCss, marpFonts, marpThemeStorageKey, marpThemeVariables } from '../cinderfolio/marp.mjs';
import { createPeleTheme } from '../cinderfolio/pele.mjs';
import { createShikiTheme } from '../cinderfolio/shiki.mjs';
import config from '../scripts/marp.config.mjs';
import { installMarpThemeSync } from '../scripts/marp_theme_sync.mjs';
import vm from 'node:vm';

const parser = unified().use(rehypeParse, { fragment: true });
let marp;
before(async () => {
  marp = await config.engine({ marp: new Marp({ html: false }) });
  marp.themeSet.add(createMarpCss());
});

function elements(node, match) {
  return [node, ...(node.children || []).flatMap(child => elements(child, match))].filter(match);
}

test('正式引擎编译四页示例，保留双图、Shiki 高亮、代码缩放与自动亮暗', async () => {
  const css = createMarpCss();
  assert.doesNotMatch(css, /@import|--rp-|rp-dark|\.hljs-/);
  const result = marp.render(await fs.readFile(new URL('../cinderfolio/examples/marp.md', import.meta.url), 'utf8'));
  assert.equal((result.html.match(/<section\b/g) || []).length, 4);
  assert.equal(result.comments.length, 4);
  assert.ok(result.comments.every(notes => notes.length > 0));
  const tree = parser.parse(result.html);
  assert.equal(elements(tree, node => node.properties?.className?.includes('pele')).length, 2);
  const code = elements(tree, node => node.tagName === 'pre' && node.properties?.className?.includes('shiki'));
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
  for (const mode of ['light', 'dark']) {
    const { colors, onFill } = createPeleTheme(undefined, mode);
    for (const [key, value] of Object.entries(colors)) assert.ok(css.includes(`--pele-${key}: ${value};`));
    for (const [key, value] of Object.entries(onFill)) assert.ok(css.includes(`--cf-pele-on-${key}: ${value};`));
  }
  // 当前亮暗主题共用字形，CSS 只需读取一套字形变量；颜色仍分别计算。
  const styles = mode => createShikiTheme(undefined, mode).tokenColors.map(rule => rule.settings.fontStyle);
  assert.deepEqual(styles('light'), styles('dark'));
});

test('Marp 本地字库与来源记录一致，样式仅引用随包 WOFF2', async () => {
  const directory = new URL('../cinderfolio/fonts/marp/', import.meta.url);
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

test('嵌入页同步通用与 Pele 配色，更新变量时保留播放位置', () => {
  const sections = Array.from({ length: 3 }, () => ({ style: { setProperty(key, value) { this[key] = value; } } }));
  const state = { mode: 'dark', variables: marpThemeVariables(undefined, 'dark') };
  const listeners = {};
  const document = { documentElement: { style: {} }, querySelectorAll: () => sections };
  const location = { hash: '#2' };
  const context = vm.createContext({
    document, location,
    localStorage: { getItem: key => key === marpThemeStorageKey ? JSON.stringify(state) : null },
    window: { addEventListener: (name, listener) => { listeners[name] = listener; } },
  });
  vm.runInContext(`(${installMarpThemeSync.toString()})(${JSON.stringify(marpThemeStorageKey)})`, context);
  assert.equal(document.documentElement.style.colorScheme, 'dark');
  assert.ok(sections.every(section => section.style['--cf-background'] === '#121212'));
  assert.ok(sections.every(section => section.style['--pele-bg'] === '#121212'
    && section.style['--pele-critical'] === '#fcaf79'));

  const input = { ink: '#000000', paper: '#ffffff', accent: '#0099ff' };
  listeners.storage({ key: marpThemeStorageKey, newValue: JSON.stringify({ mode: 'light', variables: marpThemeVariables(input, 'light') }) });
  assert.equal(document.documentElement.style.colorScheme, 'light');
  assert.ok(sections.every(section => section.style['--cf-background'] === '#ffffff'
    && section.style['--cf-accent-brand'] === '#0099ff'));
  const { colors, onFill } = createPeleTheme(input, 'light');
  for (const section of sections) {
    for (const [key, value] of Object.entries(colors)) assert.equal(section.style[`--pele-${key}`], value);
    for (const [key, value] of Object.entries(onFill)) assert.equal(section.style[`--cf-pele-on-${key}`], value);
  }
  assert.equal(location.hash, '#2');
});
