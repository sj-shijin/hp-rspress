import { useEffect, useRef, type ReactNode } from 'react';
import { enhanceMermaid } from './mermaid_lifecycle.mjs';

/** 保留预生成 SVG；完成 hydration 后再按实际容器宽度接管。 */
export default function Mermaid({ source, children }: { source: string; children: ReactNode }) {
  const figure = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = figure.current!.querySelector<HTMLElement>('.sj-mermaid__diagram')!;
    return enhanceMermaid(container, source);
  }, [source]);

  return <figure className="sj-mermaid" ref={figure}>{children}</figure>;
}
