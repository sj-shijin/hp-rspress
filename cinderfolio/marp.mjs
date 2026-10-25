/** 独立 Marp 主题：只复用配色源，不依赖 Rspress 或 Marp 运行时。 */
import { seeds } from './palette.mjs';
import { themeVariables, createPeleAdapterCss } from './css.mjs';
import { createPeleTheme } from './pele.mjs';
import { licenseComment } from './license.mjs';

// 图表与正文共用同一字体栈；字体资源由使用方随 Marp 文档加载。
export const marpFonts = {
  text: '"Inter", "Noto Sans SC", sans-serif',
  code: '"Sarasa Mono SC", monospace',
};

/** 静态 CSS 与动态主题共用全部变量，图表也随调色一起更新。 */
export function marpThemeVariables(input = seeds, mode = 'light') {
  const { colors, onFill } = createPeleTheme(input, mode);
  return {
    ...themeVariables(input, mode),
    ...Object.fromEntries(Object.entries(colors).map(([key, value]) => [`--pele-${key}`, value])),
    ...Object.fromEntries(Object.entries(onFill).map(([key, value]) => [`--cf-pele-on-${key}`, value])),
  };
}

export function createMarpCss(input = seeds) {
  const variables = mode => Object.entries(marpThemeVariables(input, mode))
    .map(([key, value]) => `  ${key}: ${value};`).join('\n');

  return licenseComment + `/*
 * @theme cinderfolio
 * @size 16:9 1280px 720px
 * @size 4:3 960px 720px
 * @auto-scaling true
 */

/* 颜色变量：亮暗共享同一套职责。 */
section {
  color-scheme: light;
${variables('light')}
}

/* iframe 跟随外层的 color-scheme；独立打开时跟随系统。 */
@media (prefers-color-scheme: dark) {
  section {
    color-scheme: dark;
${variables('dark')}
  }
}

/* 画布、字体与基础间距。 */
section {
  --cf-marp-bar-height: 32px;
  --cf-marp-inline-space: 80px;
  --cf-marp-block-space: 24px;
  --cf-marp-body-space: 24px;
  --cf-marp-column-gap: 24px;
  --cf-marp-divider-width: 2px;
  --cf-marp-divider-top: 400px; /* 封面与过渡页共用的品牌线位置。 */
  --cf-marp-column-media-height: none; /* 需要限高时，由 Markdown 局部样式指定。 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 1280px;
  height: 720px;
  padding: calc(var(--cf-marp-bar-height) + var(--cf-marp-block-space)) var(--cf-marp-inline-space);
  color: var(--cf-foreground);
  background: var(--cf-background);
  font: 32px/1.5 ${marpFonts.text};
  overflow-wrap: anywhere;
}

section[data-size='4:3'] {
  --cf-marp-inline-space: 56px;
  --cf-marp-block-space: 20px;
  --cf-marp-body-space: 20px;
  --cf-marp-column-gap: 20px;
  font-size: 28px;
}

/* 基础内容：封面 h1、页题 h2、页内标题 h3 起。 */
h1, h2, h3, h4, h5, h6 { margin: 0 0 0.65em; line-height: 1.25; font-weight: 700; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1.1em; }
h5 { font-size: 1em; }
h6 { font-size: 0.9em; }
p, ul, ol, blockquote, pre, table { margin: 0 0 var(--cf-marp-body-space); }
ul, ol { padding-left: 1.25em; }
li + li { margin-top: calc(var(--cf-marp-body-space) / 3); }
section > :last-child, section > .cf-col:has(+ footer) { margin-bottom: 0; }
a { color: var(--cf-link); text-underline-offset: 0.15em; }
a:hover { color: var(--cf-accent-brand); }
strong { font-weight: 700; }
mark { color: inherit; background: var(--cf-selection); padding: 0.05em 0.15em; border-radius: 0.1em; }
blockquote { padding: 0.4em 0.75em; border-left: 4px solid var(--cf-accent-brand); background: var(--cf-surface); }
blockquote > :last-child { margin-bottom: 0; }
hr { width: 100%; border: 0; border-top: 2px solid var(--cf-border-strong); }
table { border-collapse: collapse; font-size: 0.85em; }
th, td { padding: 0.4em 0.75em; border-bottom: 1px solid var(--cf-border-strong); text-align: left; }
th { font-weight: 600; background: var(--cf-surface); }
tr:nth-child(even) { background: var(--cf-surface); }
::selection { color: currentColor; background: var(--cf-selection); }

/* 标注块复用 GitHub 的类名；解析由引擎负责，CSS 可独立分享。 */
.markdown-alert {
  margin: 0 0 var(--cf-marp-body-space);
  padding: 0.5em 0.75em;
  border: 1px solid var(--cf-border-strong);
  border-radius: 0.2em;
  background: var(--cf-surface);
}
.markdown-alert > :last-child { margin-bottom: 0; }
/* 小号提示标题用端点色与字重；品牌色交给边框和底色。 */
.markdown-alert-title { margin-bottom: 0.35em; color: var(--cf-foreground); font-size: 0.8em; font-weight: 600; line-height: 1.25; }
.markdown-alert-important { border: 2px solid var(--cf-accent-brand); background: var(--cf-selected-background); }
.markdown-alert-tip, .markdown-alert-warning { border-left: 4px solid var(--cf-accent-brand); }
.markdown-alert-caution { border: 2px solid var(--cf-accent-brand); }

/* 媒体内容：只限制宽度，高度由内容比例或 Markdown 局部尺寸决定。 */
img, svg { max-width: 100%; object-fit: contain; }
code { font-family: ${marpFonts.code}; font-size: 0.85em; }
:not(pre) > code { padding: 0.1em 0.25em; background: var(--cf-surface-hover); border-radius: 0.15em; }
pre { padding: 0.75em 1em; border: 1px solid var(--cf-border); border-radius: 0.25em; background: var(--cf-background); line-height: 1.4; overflow: visible; }
pre code { display: block; }
/* Shiki 的颜色由 light-dark() 跟随 color-scheme；亮暗主题共用同一套字形。 */
pre.shiki span {
  font-weight: var(--shiki-light-font-weight, normal);
  font-style: var(--shiki-light-font-style, normal);
  text-decoration: var(--shiki-light-text-decoration, none);
}
figure.cinderfolio-pele { margin: 0 0 var(--cf-marp-body-space); --pele-font: ${marpFonts.text}; --pele-font-mono: ${marpFonts.code}; }
figure.cinderfolio-pele > svg { display: block; width: 100%; margin-inline: auto; }

/* 布局工具：默认等宽；cf-w1…cf-w5 按权重分配列宽，空列隐藏后其余列自动铺满。 */
.cf-cols {
  display: flex;
  align-items: stretch;
  gap: var(--cf-marp-column-gap);
  margin: 0 0 var(--cf-marp-body-space);
}
.cf-col {
  --cf-col-media-start: 0;
  --cf-col-media-end: auto;
  /* 独立使用时是一组全宽内容，不自动瓜分页面的剩余高度。 */
  flex: 0 0 auto;
  margin: 0 0 var(--cf-marp-body-space);
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  text-align: left;
}
.cf-cols > .cf-col { flex: 1 1 0; margin: 0; }
.cf-cols > .cf-col.cf-w1 { flex-grow: 1; }
.cf-cols > .cf-col.cf-w2 { flex-grow: 2; }
.cf-cols > .cf-col.cf-w3 { flex-grow: 3; }
.cf-cols > .cf-col.cf-w4 { flex-grow: 4; }
.cf-cols > .cf-col.cf-w5 { flex-grow: 5; }
/* 九宫格：先纵向 t/m/b，再横向 l/c/r；默认 tl。文字、图片和图注共用位置。 */
.cf-col:is(.cf-align-tl, .cf-align-ml, .cf-align-bl) { text-align: left; --cf-col-media-start: 0; --cf-col-media-end: auto; }
.cf-col:is(.cf-align-tc, .cf-align-mc, .cf-align-bc) { text-align: center; --cf-col-media-start: auto; --cf-col-media-end: auto; }
.cf-col:is(.cf-align-tr, .cf-align-mr, .cf-align-br) { text-align: right; --cf-col-media-start: auto; --cf-col-media-end: 0; }
.cf-col:is(.cf-align-tl, .cf-align-tc, .cf-align-tr) { justify-content: flex-start; }
.cf-col:is(.cf-align-ml, .cf-align-mc, .cf-align-mr) { justify-content: center; }
.cf-col:is(.cf-align-bl, .cf-align-bc, .cf-align-br) { justify-content: flex-end; }
.cf-col > :last-child { margin-bottom: 0; }
/* Markdown 内容会生成元素；空白和注释不算内容，也不留下组间距。 */
.cf-col:not(:has(> *)), .cf-cols:not(:has(> .cf-col > *)) { display: none; }
.cf-col img, .cf-col > figure.cinderfolio-pele > svg {
  display: block;
  width: auto;
  margin-inline: var(--cf-col-media-start) var(--cf-col-media-end);
}
.cf-col > figure:not(.cinderfolio-pele) { margin: 0; }
.cf-col > figure:not(.cinderfolio-pele) > p { margin: 0; }
.cf-col figcaption { margin-top: 0.5em; font-size: 0.75em; color: var(--cf-text-muted); }
.cf-cols > .cf-col > figure.cinderfolio-pele > svg { max-height: var(--cf-marp-column-media-height); }
.cf-cols > .cf-col pre::part(auto-scaling) { max-height: var(--cf-marp-column-media-height); }

/* 原生 header / footer：上下等高，20px 行框在 32px 灰栏中各留 6px。
 * 普通页眉居中；包含章节链接时按数量等分，strong 标出当前章。
 */
header, footer, section::after {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: var(--cf-marp-bar-height);
  color: var(--cf-text-subtle);
  font-size: 16px;
  line-height: 20px;
}
header, footer {
  left: 0;
  right: 0;
  justify-content: center;
  padding: 0 var(--cf-marp-inline-space);
  background: var(--cf-surface);
  text-align: center;
}
header { top: 0; box-shadow: inset 0 -1px var(--cf-border); }
header a { color: inherit; text-decoration: none; }
header:has(> a, > strong > a) {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  align-items: stretch;
  padding: 0;
  box-shadow: none;
}
header:has(> a, > strong > a) > * { min-width: 0; box-shadow: inset 0 -1px var(--cf-border); }
header:has(> a, > strong > a) a { display: flex; align-items: center; justify-content: center; box-sizing: border-box; height: 100%; padding: 0 12px; }
header > strong:has(> a) { background: var(--cf-background); box-shadow: none; font-weight: 600; }
header > strong a:hover { color: inherit; }
footer { bottom: 0; padding-inline: calc(var(--cf-marp-inline-space) + 80px); box-shadow: inset 0 1px var(--cf-border); }
section::after { bottom: 0; right: var(--cf-marp-inline-space); padding: 0; font-variant-numeric: tabular-nums; }
section[data-marpit-pagination]::after { content: attr(data-marpit-pagination) ' / ' attr(data-marpit-pagination-total); }

/* 页面预设：正文和过渡页的第一个顶层 h2 共用品牌线。 */
section:not(.cover) > h2:first-of-type {
  border-bottom: var(--cf-marp-divider-width) solid var(--cf-accent-brand);
  letter-spacing: -0.025em;
}

/* 正文页：标题区独立于正文密度；三处 16px 均按文字行框边缘计算。
 * inline-space 继续用于页眉页脚、封面和过渡页，不随正文边距调整。
 */
section:not(.cover, .transition) {
  --cf-marp-content-inset: 64px;
  --cf-marp-title-size: 40px;
  --cf-marp-title-gap: 16px;
  padding: calc(var(--cf-marp-bar-height) + var(--cf-marp-title-gap)) var(--cf-marp-content-inset);
}
section[data-size='4:3']:not(.cover, .transition) {
  --cf-marp-content-inset: 48px;
  --cf-marp-title-size: 36px;
}
section:not(.cover, .transition) > h2:first-of-type {
  flex-shrink: 0;
  margin: 0 calc(-1 * var(--cf-marp-content-inset)) var(--cf-marp-title-gap);
  padding: 0 var(--cf-marp-content-inset) var(--cf-marp-title-gap);
  font-size: var(--cf-marp-title-size);
  line-height: 1.25;
}
/* 正文小标题随密度缩放，避免与固定页题同大。 */
section:not(.cover, .transition) :is(h3, h4, h5, h6) {
  margin-bottom: calc(var(--cf-marp-body-space) / 2);
  line-height: 1.3;
  font-weight: 600;
}
section:not(.cover, .transition) h3 { font-size: 1em; }
section:not(.cover, .transition) h4 { font-size: 0.95em; }
section:not(.cover, .transition) h5 { font-size: 0.9em; }
section:not(.cover, .transition) h6 { font-size: 0.85em; }

/* 单页 _class: compact；只收紧正文，继续使用相同的 cf-cols / cf-col。 */
section.compact:not(.cover, .transition) {
  --cf-marp-body-space: 12px;
  --cf-marp-column-gap: 20px;
  font-size: 28px;
  line-height: 1.4;
}
section.compact[data-size='4:3']:not(.cover, .transition) {
  --cf-marp-body-space: 10px;
  --cf-marp-column-gap: 16px;
  font-size: 24px;
}

/* _class: transition；标题前的段落为可选章节编号，标题后为可选引导句。
 * 品牌线与封面共用固定基准，辅助段落不参与标题与品牌线的定位。
 */
section.transition {
  justify-content: flex-end;
  gap: var(--cf-marp-block-space);
  padding-bottom: calc(720px - var(--cf-marp-divider-top) - var(--cf-marp-divider-width));
  text-align: center;
}
section.transition > h2:first-of-type {
  margin: 0 calc(-1 * var(--cf-marp-inline-space));
  padding: 0 var(--cf-marp-inline-space) var(--cf-marp-block-space);
  font-size: 2em;
  line-height: 1.2;
  text-wrap: balance;
}
section.transition > p { margin: 0; color: var(--cf-text-muted); font-size: 0.875em; text-wrap: balance; }
section.transition > p:has(+ h2) { font-size: 0.75em; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; }
section.transition > h2:first-of-type + p {
  position: absolute;
  top: calc(var(--cf-marp-divider-top) + var(--cf-marp-divider-width) + var(--cf-marp-block-space));
  left: var(--cf-marp-inline-space);
  right: var(--cf-marp-inline-space);
}

/* _class: cover；h1 标题内可用 small 写副标题，无需引擎分组。
 * 主标题自身在品牌线上方居中，副标题跟在其下方，不参与主标题定位。
 * 作者、单位和日期仍作为一组在品牌线下方居中。
 */
section.cover {
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: var(--cf-marp-divider-top) var(--cf-marp-inline-space) 0;
  text-align: center;
}
section.cover::before { content: ''; position: absolute; top: var(--cf-marp-divider-top); left: 0; right: 0; height: var(--cf-marp-divider-width); background: var(--cf-accent-brand); }
section.cover > h1 {
  position: absolute;
  top: calc(var(--cf-marp-divider-top) / 2);
  left: var(--cf-marp-inline-space);
  right: var(--cf-marp-inline-space);
  transform: translateY(-50%);
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 2.5em;
  line-height: 1.2;
  letter-spacing: -0.025em;
  text-wrap: balance;
}
section.cover > h1 > small {
  position: absolute;
  top: calc(100% + 24px);
  left: 0;
  right: 0;
  margin: 0;
  color: var(--cf-text-muted);
  font-size: 0.4em;
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: normal;
}
section.cover > p { margin: 0; color: var(--cf-text-muted); font-size: 0.625em; line-height: 1.5; }
section.cover > p:nth-of-type(3) { color: var(--cf-text-subtle); }

/* Pele 共用适配规则：描边、悬停和实底字色。 */
${createPeleAdapterCss()}
`;
}
