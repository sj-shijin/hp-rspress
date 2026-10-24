import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ThemeContext } from '@rspress/core/runtime';
import { createMermaidTheme } from 'cinderfolio/mermaid';
import { useCinderfolio } from './CinderfolioTheme';
import { renderMermaid } from './cinderfolio_mermaid.mjs';

/** 官方渲染器仅在本组件挂载后加载；源码继续使用 Rspress 的原生代码块。 */
export default function CinderfolioMermaid({ source, children }: { source: string; children: ReactNode }) {
  const { input } = useCinderfolio();
  const { theme } = useContext(ThemeContext);
  const canvas = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let current = true;
    setPending(true);
    setFailed(false);
    // 原生调色器连续触发输入时，只绘制最后一次选择。
    const timer = setTimeout(async () => {
      try {
        await document.fonts.ready;
        if (!current) return;
        const config = createMermaidTheme(input, theme === 'dark' ? 'dark' : 'light');
        // 网页预览沿用正文的字体；独立 JSON 使用通用字体，不依赖本站资源。
        config.fontFamily = config.themeVariables.fontFamily = getComputedStyle(canvas.current!).fontFamily;
        const result = await renderMermaid(source, config, () => current, canvas.current!);
        if (!current || !result) return;
        canvas.current!.innerHTML = result.svg;
        result.bindFunctions?.(canvas.current!);
        setReady(true);
      } catch (error) {
        if (!current) return;
        console.error('[Cinderfolio-Mermaid]', error);
        setFailed(true);
      } finally {
        if (current) setPending(false);
      }
    }, 120);
    return () => { current = false; clearTimeout(timer); };
  }, [source, input, theme]);

  return <figure className="sj-mermaid cf-mermaid" aria-label="Mermaid 官方图表">
    <div className="sj-mermaid__diagram" ref={canvas} aria-busy={pending} />
    {!ready && !failed && <p className="cf-mermaid__status" role="status">正在绘制图表…</p>}
    {failed && <p className="cf-mermaid__status" role="alert">图表未能绘制，请刷新页面重试。</p>}
    <noscript>启用 JavaScript 后可预览图表，下方保留完整源码。</noscript>
    <details className="sj-mermaid__source rp-not-doc">
      <summary>查看 Mermaid 源码</summary>
      {children}
    </details>
  </figure>;
}
