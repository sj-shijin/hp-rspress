import 'katex/dist/katex.min.css';
import './index.css';
import 'cinderfolio/themes/cf-rspress.css';
import 'cinderfolio/themes/cf-pele.css';
import { Layout as OriginalLayout } from '@rspress/core/theme-original';
import { CinderfolioProvider } from './CinderfolioTheme';
import type { ComponentProps } from 'react';

export * from '@rspress/core/theme-original';

export function Layout(props: ComponentProps<typeof OriginalLayout>) {
  return <CinderfolioProvider><OriginalLayout {...props} /></CinderfolioProvider>;
}

// 首页与知识库使用正文页相同的纯色背景，保留原生导航和领域卡片。
export function HomeBackground() {
  return null;
}

export { languageLabel } from './CinderfolioLanguageLabel';
