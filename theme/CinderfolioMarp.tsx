import { useContext, useEffect, useRef, useState } from 'react';
import { ThemeContext } from '@rspress/core/runtime';
import { marpThemeVariables } from 'cinderfolio/marp';
import { marpThemeStorageKey } from '../scripts/marp_theme_sync.mjs';
import { useCinderfolio } from './CinderfolioTheme';
import './cinderfolio.css';

const sources = {
  '16:9': '/cinderfolio/marp/example.html',
  '4:3': '/cinderfolio/marp/example-4-3.html',
};
type Ratio = keyof typeof sources;

function ControlIcon({ path }: { path: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>;
}

export default function CinderfolioMarp() {
  const { input } = useCinderfolio();
  const { theme } = useContext(ThemeContext);
  const frame = useRef<HTMLIFrameElement>(null);
  const [{ ratio, hash }, setView] = useState<{ ratio: Ratio; hash: string }>({ ratio: '16:9', hash: '' });
  const source = sources[ratio];

  // 同源 iframe 的锚点由 Marp 维护；切换比例与独立打开共用当前页。
  const currentHash = () => frame.current?.contentWindow?.location.hash || hash;
  function changeRatio(next: Ratio) {
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
    <iframe ref={frame} src={`${source}${hash}`} style={{ aspectRatio: ratio.replace(':', ' / ') }} title="Cinderfolio-Marp 示例" allow="fullscreen" allowFullScreen />
    <figcaption>
      <div className="cf-marp__controls">
        <button type="button" className="cf-marp__button cf-marp__action" aria-label="独立打开当前页" title="独立打开当前页"
          onClick={() => window.open(`${source}${currentHash()}`, '_blank', 'noopener,noreferrer')}>
          <ControlIcon path="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM3 9h18M6 6.5h.01M9 6.5h.01" />
        </button>
        <div className="cf-marp__controls" role="group" aria-label="幻灯片比例">
          {(Object.keys(sources) as Ratio[]).map(value => <button key={value} type="button"
            className="cf-marp__button cf-marp__ratio" aria-pressed={ratio === value} onClick={() => changeRatio(value)}>{value}</button>)}
        </div>
      </div>
      {/* Marp 自带分页与打印样式，浏览器可将当前比例和配色保存为 PDF。 */}
      <button type="button" className="cf-marp__button cf-marp__action" aria-label="导出 PDF" title="导出 PDF · 在打印窗口选择存储为 PDF"
        onClick={() => frame.current?.contentWindow?.print()}>
        <ControlIcon path="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </button>
    </figcaption>
  </figure>;
}
