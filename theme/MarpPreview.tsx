import { useContext, useEffect, useRef, useState } from 'react';
import { ThemeContext, withBase } from '@rspress/core/runtime';
import { marpThemeVariables } from 'cinderfolio/marp';
import { marpThemeStorageKey } from '../scripts/marp_theme_sync.mjs';
import { useCinderfolio } from './CinderfolioTheme';
import './cinderfolio.css';

type MarpPreviewProps = { title: string; sources: Record<string, string> };

function ControlIcon({ path }: { path: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>;
}

/** 展示任意已构建的同源 Marp HTML；仅提供实际存在的比例。 */
export default function MarpPreview({ title, sources }: MarpPreviewProps) {
  const { input } = useCinderfolio();
  const { theme } = useContext(ThemeContext);
  const frame = useRef<HTMLIFrameElement>(null);
  const ratios = Object.keys(sources);
  const [{ ratio, hash }, setView] = useState({ ratio: ratios[0], hash: '' });
  const source = withBase(sources[ratio]);

  // 同源 iframe 的锚点由 Marp 维护；切换比例与独立打开共用当前页。
  const currentHash = () => frame.current?.contentWindow?.location.hash || hash;
  function changeRatio(next: string) {
    if (next !== ratio) setView({ ratio: next, hash: currentHash() });
  }

  useEffect(() => {
    const mode = theme === 'dark' ? 'dark' : 'light';
    try {
      localStorage.setItem(marpThemeStorageKey, JSON.stringify({ mode, variables: marpThemeVariables(input, mode) }));
    } catch {
      // 与 Marp 原生演讲者模式一样，同源窗口同步需要可用的本地存储。
    }
  }, [input, theme]);

  return <figure className="cf-marp">
    <iframe ref={frame} src={`${source}${hash}`} style={{ aspectRatio: ratio.replace(':', ' / ') }} title={title} loading="lazy" allow="fullscreen" allowFullScreen />
    <figcaption>
      <div className="cf-marp__controls">
        <button type="button" className="cf-marp__button cf-marp__action" aria-label="独立打开当前页" title="独立打开当前页"
          onClick={() => window.open(`${source}${currentHash()}`, '_blank', 'noopener,noreferrer')}>
          <ControlIcon path="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM3 9h18M6 6.5h.01M9 6.5h.01" />
        </button>
        {ratios.length > 1 && <div className="cf-marp__controls" role="group" aria-label="幻灯片比例">
          {ratios.map(value => <button key={value} type="button"
            className="cf-marp__button cf-marp__ratio" aria-pressed={ratio === value} onClick={() => changeRatio(value)}>{value}</button>)}
        </div>}
      </div>
      {/* Marp 自带分页与打印样式，浏览器可将当前比例和配色保存为 PDF。 */}
      <button type="button" className="cf-marp__button cf-marp__action" aria-label="导出 PDF" title="导出 PDF · 在打印窗口选择存储为 PDF"
        onClick={() => frame.current?.contentWindow?.print()}>
        <ControlIcon path="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </button>
    </figcaption>
  </figure>;
}
