import { useEffect, useState } from 'react';
import { createPeleCss } from '../cinderfolio/css.mjs';
import { createRspressCss } from '../cinderfolio/rspress.mjs';
import { useCinderfolio } from './CinderfolioTheme';
import './cinderfolio.css';

/** 无 JavaScript 时下载默认文件；交互就绪后下载本次浏览的实时配色。 */
export default function CinderfolioDownload({ target }: { target: 'rspress' | 'pele' }) {
  const { input } = useCinderfolio();
  const [interactive, setInteractive] = useState(false);
  useEffect(() => { setInteractive(true); }, []);
  const filename = target === 'pele' ? 'cf-pele.css' : 'cf-rspress.css';
  const css = target === 'pele' ? createPeleCss(input) : createRspressCss(input);
  const href = interactive ? `data:text/css;charset=utf-8,${encodeURIComponent(css)}` : `/cinderfolio/${filename}`;
  // 保留原生 a 的 download 属性，复用 Rspress 中号按钮的尺寸与圆角。
  return <a className="rp-button rp-button--alt rp-button--medium rp-not-doc cf-download" href={href} download={filename}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m-5-5 5 5 5-5M5 15v5h14v-5" />
    </svg>
    下载 {filename}
  </a>;
}
