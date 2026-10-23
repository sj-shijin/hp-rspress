/** 独立 Rspress CSS 导出；Node.js 与网页下载使用同一个入口。 */
import { seeds } from './palette.mjs';
import { createColorCss } from './css.mjs';

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
}

html ::selection {
  color: currentColor;
  background: var(--cf-selection);
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
  return createColorCss(input, rspressSelectors) + '\n' + rules;
}
