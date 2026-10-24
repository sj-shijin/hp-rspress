import { useEffect, useState } from 'react';
import { createPeleCss } from 'cinderfolio/css';
import { createRspressCss } from 'cinderfolio/rspress';
import { createMarpCss } from 'cinderfolio/marp';
import { createShikiTheme } from 'cinderfolio/shiki';
import { createMermaidTheme } from 'cinderfolio/mermaid';
import { useCinderfolio } from './CinderfolioTheme';
import './cinderfolio.css';

/** 无 JavaScript 时下载默认文件；交互就绪后下载本次浏览的实时配色。 */
export default function CinderfolioDownload({ target }: { target: 'rspress' | 'pele' | 'marp' | 'shiki-light' | 'shiki-dark' | 'mermaid-light' | 'mermaid-dark' }) {
  const { input } = useCinderfolio();
  const [interactive, setInteractive] = useState(false);
  useEffect(() => { setInteractive(true); }, []);
  const isShiki = target.startsWith('shiki-');
  const isJson = isShiki || target.startsWith('mermaid-');
  const filename = `cf-${target}.${isJson ? 'json' : 'css'}`;
  const content = isJson
    ? JSON.stringify((isShiki ? createShikiTheme : createMermaidTheme)(input, target.endsWith('-light') ? 'light' : 'dark'), null, 2) + '\n'
    : target === 'pele' ? createPeleCss(input) : target === 'marp' ? createMarpCss(input) : createRspressCss(input);
  const mime = isJson ? 'application/json' : 'text/css';
  const href = interactive ? `data:${mime};charset=utf-8,${encodeURIComponent(content)}` : `/cinderfolio/${filename}`;
  // 保留原生 a 的 download 属性，复用 Rspress 中号按钮的尺寸与圆角。
  return <a className="rp-button rp-button--alt rp-button--medium rp-not-doc cf-download" href={href} download={filename}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m-5-5 5 5 5-5M5 15v5h14v-5" />
    </svg>
    下载 {filename}
  </a>;
}
