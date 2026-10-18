import { type ReactNode } from 'react';

/** 保留预生成图表和可展开的原始源码。 */
export default function Mermaid({ children }: { source: string; children: ReactNode }) {
  return <figure className="sj-mermaid">{children}</figure>;
}
