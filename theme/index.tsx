import 'katex/dist/katex.min.css';
import './index.css';

export * from '@rspress/core/theme-original';

// 首页与知识库使用正文页相同的纯色背景，保留原生导航和领域卡片。
export function HomeBackground() {
  return null;
}
