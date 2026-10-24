/** 独立 Rspress CSS 导出；Node.js 与网页下载使用同一个入口。 */
import { seeds } from './palette.mjs';
import { createColorCss } from './css.mjs';
import { licenseComment } from './license.mjs';

export const rspressSelectors = {
  light: ':where(html:not(.rp-dark))',
  dark: ':where(html.rp-dark)',
};

const rules = `/* 只映射 Rspress 职责，不包含 Pele 规则。 */
html:not(.rp-dark), html.rp-dark {
  --rp-c-brand: var(--cf-accent-brand);
  --rp-c-brand-dark: var(--cf-accent-dark);
  --rp-c-brand-darker: var(--cf-accent-darker);
  --rp-c-brand-light: var(--cf-accent-light);
  --rp-c-brand-lighter: var(--cf-accent-lighter);
  --rp-c-brand-tint: var(--cf-selected-background);
  --rp-c-link: var(--cf-link);

  --rp-c-bg: var(--cf-background);
  --rp-c-bg-alt: var(--cf-background);
  --rp-c-bg-soft: var(--cf-surface);
  --rp-c-bg-mute: var(--cf-surface-hover);
  /* 保留卡片的 135° 半透明渐变，亮暗统一复用浅层底色。 */
  --rp-home-feature-bg: linear-gradient(135deg, transparent, color-mix(in srgb, var(--cf-surface) 50%, transparent));
  --rp-c-text-0: var(--cf-foreground);
  --rp-c-text-1: var(--cf-foreground);
  --rp-c-text-2: var(--cf-text-muted);
  --rp-c-text-3: var(--cf-text-subtle);
  --rp-c-text-4: var(--cf-text-subtle);
  --rp-c-divider: var(--cf-border-strong);
  --rp-c-divider-light: var(--cf-border);

  --rp-c-gray: var(--cf-text-subtle);         /* 搜索快捷键文字。 */
  --rp-c-gray-light-1: var(--cf-text-muted); /* 搜索路径与图标。 */
  --rp-c-gray-light-3: var(--cf-control-border); /* 次要按钮边界。 */
  --rp-c-text-code: var(--cf-foreground);
  --rp-c-text-code-bg: var(--cf-surface);
  --rp-c-text-code-border: var(--cf-border);

  /* 提示容器已有浅层底色，行内代码回到画布色；details 悬停时仍能区分。 */
  --rp-container-note-code-bg: var(--cf-background);
  --rp-container-details-code-bg: var(--cf-background);

  /* 阴影始终取深色端点，透明度按十六等分选取，保留原生位移与模糊半径。 */
  --cf-shadow-soft: color-mix(in srgb, var(--cf-g0) 6.25%, transparent);
  --cf-shadow-medium: color-mix(in srgb, var(--cf-g0) 12.5%, transparent);
  --cf-shadow-strong: color-mix(in srgb, var(--cf-g0) 18.75%, transparent);
  --rp-shadow-1: 0 1px 2px var(--cf-shadow-soft), 0 1px 0 var(--cf-shadow-soft);
  --rp-shadow-2: 0 3px 12px var(--cf-shadow-soft), 0 1px 4px var(--cf-shadow-soft);
  --rp-shadow-3: 0 12px 32px var(--cf-shadow-medium), 0 2px 6px var(--cf-shadow-soft);
  --rp-shadow-4: 0 14px 44px var(--cf-shadow-medium), 0 3px 9px var(--cf-shadow-medium);
  --rp-shadow-5: 0 18px 56px var(--cf-shadow-strong), 0 4px 12px var(--cf-shadow-strong);
}

html ::selection {
  color: currentColor;
  background: var(--cf-selection);
}

/* 页面与内容滚动条共用灰阶；保留原生宽度和透明轨道。 */
html,
html:root .rp-scrollbar {
  scrollbar-color: var(--cf-border) transparent;
}

html:root .rp-scrollbar:hover {
  scrollbar-color: var(--cf-border-strong) transparent;
}

html::-webkit-scrollbar-thumb,
html:root .rp-scrollbar::-webkit-scrollbar-thumb {
  background: var(--cf-border);
}

html::-webkit-scrollbar-thumb:hover,
html:root .rp-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--cf-border-strong);
}

html .rp-search-panel__mask {
  background: color-mix(in srgb, var(--cf-g0) 37.5%, transparent);
}

/* 代码容器复用网页职责；Shiki token 通过同一色阶变量实时更新。 */
html .rp-codeblock {
  --rp-code-block-bg: var(--cf-background);
  --rp-code-title-bg: var(--cf-background);
  --rp-code-block-color: var(--cf-foreground);
  --rp-code-block-border: 1px solid var(--cf-border);
  --rp-c-text-1: var(--cf-foreground);
  --rp-c-text-2: var(--cf-text-muted);
  --rp-c-text-3: var(--cf-text-subtle);
}

html .rp-codeblock__content--line-numbers code .line::before {
  color: var(--cf-text-subtle);
}

/* 普通行高亮复用淡品牌色底与交互强调，错误和警告保留各自的语义色。 */
html .shiki.has-highlighted .line.highlighted:not(.error):not(.warning) {
  background-color: var(--cf-selected-background);
  box-shadow: inset 2px 0 var(--cf-interaction);
}

html .rp-button--brand {
  color: var(--cf-background);
  background: var(--cf-foreground);
}

html .rp-button--brand:hover {
  background: var(--cf-text-muted);
  opacity: 1;
}

html .rp-button--alt, html.rp-dark .rp-button--alt {
  color: var(--cf-foreground);
  background: var(--cf-background);
  border-color: var(--cf-control-border);
}

html .rp-button--alt:hover {
  background: var(--cf-surface-hover);
  opacity: 1;
}

/* 复制完成作为品牌色反馈，不改变警告、错误等语义状态。 */
html .rp-code-copy-button--copied .rp-code-copy-button__icon--success,
html .rp-llms-copy-button--success .rp-llms-copy-button__icon-success {
  color: var(--cf-interaction);
}

html .rp-llms-copy-button--success.rp-llms-copy-button {
  color: var(--cf-interaction);
  border-color: currentColor;
}

/* 补齐原生组件中未使用 --rp-shadow-* 的中性阴影。 */
html .rp-llms-button:hover:not(:active) {
  box-shadow: 0 2px 6px var(--cf-shadow-soft);
}

html .rp-llms-view-options__menu {
  box-shadow: 0 4px 20px -4px var(--cf-shadow-strong), 0 0 2px var(--cf-shadow-soft);
}

html .rp-overview-group__item:hover,
html .rp-overview-group__grid-item:hover {
  box-shadow: 0 4px 6px var(--cf-shadow-soft);
}

/* 搜索当前项使用控件选中职责；侧栏当前项使用淡品牌色底。 */
html .rp-suggest-item .rp-suggest-item__link {
  box-shadow: var(--rp-shadow-1);
}

html .rp-suggest-item--current .rp-suggest-item__link {
  color: var(--cf-control-selected-foreground);
  background: var(--cf-control-selected-background);
}

html .rp-suggest-item--current .rp-suggest-item__container .rp-suggest-item__icon,
html .rp-suggest-item--current .rp-suggest-item__container .rp-suggest-item__content :is(.rp-suggest-item__statement, .rp-suggest-item__mark, .rp-suggest-item__title) {
  color: var(--cf-control-selected-foreground);
}

`;

export function createRspressCss(input = seeds) {
  return licenseComment + createColorCss(input, rspressSelectors) + '\n' + rules;
}
