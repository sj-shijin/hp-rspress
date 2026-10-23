/** 独立 Marp 主题：只复用配色源，不依赖 Rspress 或 Marp 运行时。 */
import { seeds } from './palette.mjs';
import { themeVariables, createPeleAdapterCss } from './css.mjs';
import { createPeleTheme } from './pele.mjs';

export const marpThemeStorageKey = 'cinderfolio-marp-theme';

/** 静态 CSS 与网页实时同步共用全部变量，图表也随调色一起更新。 */
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

  return `/*
 * @theme cinderfolio
 * @size 16:9 1280px 720px
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
  justify-content: center;
  width: 1280px;
  height: 720px;
  padding: 64px 80px;
  color: var(--cf-foreground);
  background: var(--cf-background);
  font: 32px/1.5 system-ui, -apple-system, "Segoe UI", "Noto Sans CJK SC", sans-serif;
  overflow-wrap: anywhere;
}

h1, h2, h3 { margin: 0 0 0.65em; line-height: 1.2; font-weight: 700; }
h1 { font-size: 2.2em; letter-spacing: -0.04em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.15em; }
p, ul, ol, blockquote, pre, table { margin: 0 0 0.75em; }
ul, ol { padding-left: 1.25em; }
li + li { margin-top: 0.25em; }
section > :last-child { margin-bottom: 0; }
a { color: var(--cf-link); text-underline-offset: 0.15em; }
a:hover { color: var(--cf-accent-brand); }
strong { color: var(--cf-link); font-weight: 700; }
em { color: var(--cf-text-muted); }
blockquote { padding: 0.4em 0.75em; border-left: 4px solid var(--cf-accent-brand); color: var(--cf-text-muted); background: var(--cf-surface); }
blockquote > :last-child { margin-bottom: 0; }
hr { width: 100%; border: 0; border-top: 2px solid var(--cf-border-strong); }
img, svg { max-width: 100%; max-height: 480px; object-fit: contain; }
code { font-family: ui-monospace, "SFMono-Regular", Consolas, monospace; font-size: 0.85em; }
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
figure.cinderfolio-pele { margin: 0 0 0.75em; }
figure.cinderfolio-pele > svg { display: block; width: 100%; max-height: 360px; margin-inline: auto; }
table { border-collapse: collapse; font-size: 0.85em; }
th, td { padding: 0.4em 0.75em; border-bottom: 1px solid var(--cf-border-strong); text-align: left; }
th { font-weight: 600; background: var(--cf-surface); }
tr:nth-child(even) { background: var(--cf-surface); }
header, footer { position: absolute; left: 80px; color: var(--cf-text-subtle); font-size: 18px; }
header { top: 28px; }
footer { bottom: 28px; }
section::after { position: absolute; right: 48px; bottom: 28px; color: var(--cf-text-subtle); font-size: 18px; }
::selection { color: currentColor; background: var(--cf-selection); }

${createPeleAdapterCss()}
`;
}
