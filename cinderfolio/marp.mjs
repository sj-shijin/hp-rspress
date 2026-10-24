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

section {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 1280px;
  height: 720px;
  padding: 32px 80px 64px;
  color: var(--cf-foreground);
  background: var(--cf-background);
  font: 32px/1.5 ${marpFonts.text};
  overflow-wrap: anywhere;
}

/* 每页以一个一级标题开头，页题与正文共用固定的起点。 */
h1, h2, h3, h4, h5, h6 { margin: 0 0 0.65em; line-height: 1.25; font-weight: 700; }
h1 { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid var(--cf-accent-brand); font-size: 1.5em; letter-spacing: -0.025em; }
h2 { font-size: 1.25em; }
h3 { font-size: 1.1em; }
h4 { font-size: 1em; }
h5 { font-size: 0.9em; }
h6 { font-size: 0.8em; }
p, ul, ol, blockquote, pre, table { margin: 0 0 0.75em; }
ul, ol { padding-left: 1.25em; }
li + li { margin-top: 0.25em; }
section > :last-child { margin-bottom: 0; }
a { color: var(--cf-link); text-underline-offset: 0.15em; }
a:hover { color: var(--cf-accent-brand); }
strong { font-weight: 700; }
em { color: var(--cf-text-muted); }
blockquote { padding: 0.4em 0.75em; border-left: 4px solid var(--cf-accent-brand); color: var(--cf-text-muted); background: var(--cf-surface); }
blockquote > :last-child { margin-bottom: 0; }
hr { width: 100%; border: 0; border-top: 2px solid var(--cf-border-strong); }
img, svg { max-width: 100%; max-height: 480px; object-fit: contain; }
code { font-family: ${marpFonts.code}; font-size: 0.85em; }
:not(pre) > code { padding: 0.1em 0.25em; background: var(--cf-surface); border-radius: 0.15em; }
pre { padding: 0.75em 1em; border: 1px solid var(--cf-border); border-radius: 0.25em; background: var(--cf-background); line-height: 1.4; overflow: visible; }
pre code { display: block; }
pre::part(auto-scaling) { max-height: 460px; }
/* Shiki 的颜色由 light-dark() 跟随 color-scheme；亮暗主题共用同一套字形。 */
pre.shiki span {
  font-weight: var(--shiki-light-font-weight, normal);
  font-style: var(--shiki-light-font-style, normal);
  text-decoration: var(--shiki-light-text-decoration, none);
}
figure.cinderfolio-pele { margin: 0 0 0.75em; --pele-font: ${marpFonts.text}; --pele-font-mono: ${marpFonts.code}; }
figure.cinderfolio-pele > svg { display: block; width: 100%; max-height: 360px; margin-inline: auto; }
table { border-collapse: collapse; font-size: 0.85em; }
th, td { padding: 0.4em 0.75em; border-bottom: 1px solid var(--cf-border-strong); text-align: left; }
th { font-weight: 600; background: var(--cf-surface); }
tr:nth-child(even) { background: var(--cf-surface); }
/* 原生 header / footer 收到同一页脚：左侧演示名，右侧短说明与页码。 */
section::before { content: ''; position: absolute; left: 80px; right: 80px; bottom: 48px; border-top: 1px solid var(--cf-border); }
header, footer, section::after { position: absolute; bottom: 16px; color: var(--cf-text-subtle); font-size: 16px; line-height: 1.5; }
header { left: 80px; }
footer { right: 144px; text-align: right; }
section::after { right: 80px; padding: 0; }

/* 默认 16:9 压缩纵向留白；4:3 按原生 size 标记使用较舒展的间距。 */
section[data-size='4:3'] { padding: 48px 56px 72px; font-size: 28px; }
section[data-size='4:3'] h1 { margin-bottom: 28px; padding-bottom: 16px; }
section[data-size='4:3']::before { left: 56px; right: 56px; bottom: 56px; }
section[data-size='4:3'] :is(header, footer), section[data-size='4:3']::after { bottom: 20px; }
section[data-size='4:3'] header { left: 56px; }
section[data-size='4:3'] footer { right: 120px; }
section[data-size='4:3']::after { right: 56px; }
::selection { color: currentColor; background: var(--cf-selection); }

${createPeleAdapterCss()}
`;
}
