import { Children, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { enhanceMermaid } from './mermaid_lifecycle.mjs';

function MermaidDialog({ source, onClose }: { source: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const hintId = useId();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const modal = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    // 先展开弹窗再测量；正文与弹窗各自拥有图表和监听。
    const dispose = enhanceMermaid(canvas.current!, source, undefined, {
      zoom: {
        always: true,
        labels: { zoomIn: '放大', zoomOut: '缩小', reset: '重置视图' },
      },
      onRender() { setLoading(false); setFailed(false); },
      onError() { setLoading(false); setFailed(true); },
    });
    return () => {
      dispose();
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [source]);

  return (
    <dialog
      ref={dialog}
      className="sj-mermaid__modal rp-not-doc"
      aria-labelledby={titleId}
      aria-describedby={hintId}
      onClose={onClose}
      onKeyDownCapture={event => {
        // Pele 也使用 Esc 重置缩放；弹窗内统一优先关闭。
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          dialog.current!.close();
        }
      }}
      onClick={event => {
        if (event.target === event.currentTarget) dialog.current!.close();
      }}
    >
      <div className="sj-mermaid__modal-header">
        <span id={titleId}>图表预览</span>
        <button type="button" className="sj-mermaid__icon-button" aria-label="关闭图表预览"
          title="关闭（Esc）" autoFocus onClick={() => dialog.current!.close()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="sj-mermaid__viewport">
        <div ref={canvas} className="sj-mermaid__canvas" aria-busy={loading} />
        {loading && <p className="sj-mermaid__status" role="status">正在绘制图表…</p>}
        {failed && <p className="sj-mermaid__status" role="alert">图表预览未能加载，请关闭后重试。</p>}
      </div>
      <p className="sj-mermaid__hint" id={hintId}>
        使用缩放按钮、双指或 Ctrl/⌘＋滚轮缩放；放大后可拖动。
      </p>
    </dialog>
  );
}

/** 保留预生成 SVG；完成 hydration 后再按实际容器宽度接管。 */
export default function Mermaid({ source, children }: { source: string; children: ReactNode }) {
  const figure = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [diagram, code] = Children.toArray(children);

  useEffect(() => {
    const container = figure.current!.querySelector<HTMLElement>('.sj-mermaid__diagram')!;
    return enhanceMermaid(container, source);
  }, [source]);

  return (
    <figure className="sj-mermaid cinderfolio-pele" ref={figure}>
      <button type="button" className="sj-mermaid__expand sj-mermaid__icon-button rp-not-doc"
        aria-label="放大 Mermaid 图表" aria-haspopup="dialog" title="放大图表"
        onClick={() => setExpanded(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
        </svg>
      </button>
      {diagram}
      <details className="sj-mermaid__source rp-not-doc">
        <summary>查看 Mermaid 源码</summary>
        {code}
      </details>
      {expanded && <MermaidDialog source={source} onClose={() => setExpanded(false)} />}
    </figure>
  );
}
