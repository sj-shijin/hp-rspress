import { useContext, useEffect } from 'react';
import { ThemeContext } from '@rspress/core/runtime';
import { marpThemeVariables } from 'cinderfolio/marp';
import { marpThemeStorageKey } from '../scripts/marp_theme_sync.mjs';
import { useCinderfolio } from './CinderfolioTheme';
import './cinderfolio.css';

const source = '/cinderfolio/marp/example.html';

export default function CinderfolioMarp() {
  const { input } = useCinderfolio();
  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    const mode = theme === 'dark' ? 'dark' : 'light';
    try {
      localStorage.setItem(marpThemeStorageKey, JSON.stringify({ mode, variables: marpThemeVariables(input, mode) }));
    } catch {
      // 与 Marp 原生演讲者模式一样，同源窗口同步需要可用的本地存储。
    }
  }, [input, theme]);

  return <figure className="cf-marp">
    <iframe src={source} title="Cinderfolio-Marp 示例" allow="fullscreen" allowFullScreen />
    <figcaption>
      ← / → 翻页 · F 全屏 · P 演讲者 · <a href={source} target="_blank" rel="noreferrer">独立打开</a>
    </figcaption>
  </figure>;
}
