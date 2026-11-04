import { Children, useEffect, useRef, type ReactNode } from 'react';
import { useCinderfolio } from './CinderfolioTheme';
import { enhanceMermaid } from './mermaid_lifecycle.mjs';
import { openPeleZoom } from './pele_zoom';

/** 保留可交互的正文 SVG，放大时复用当前布局和 Rspress 的图片预览。 */
export default function Mermaid({ source, children }: { source: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const { input } = useCinderfolio();
  const [diagram, code] = Children.toArray(children);

  useEffect(() => {
    const container = frame.current!.querySelector<HTMLElement>('.sj-mermaid__diagram')!;
    return enhanceMermaid(container, source);
  }, [source]);

  function open(trigger: HTMLDivElement) {
    const svg = trigger.querySelector<SVGSVGElement>('.sj-mermaid__diagram > svg');
    if (svg) void openPeleZoom(svg, input, trigger);
  }

  return (
    <figure className="sj-mermaid cinderfolio-pele">
      <div ref={frame} className="sj-mermaid__preview" role="group" tabIndex={0}
        aria-label="Mermaid 图表，按回车或空格放大" aria-keyshortcuts="Enter Space"
        onClick={event => {
          const target = event.target;
          if (target instanceof Element && target.closest('svg') && !target.closest('a')
              && !window.getSelection()?.toString()) open(event.currentTarget);
        }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          if (!event.repeat) open(event.currentTarget);
        }}>
        {diagram}
      </div>
      <details className="sj-mermaid__source rp-not-doc">
        <summary>查看 Mermaid 源码</summary>
        {code}
      </details>
    </figure>
  );
}
