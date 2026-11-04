import { useDark } from '@rspress/core/runtime';
import type { CSSProperties, ReactNode } from 'react';

type SvgPage = { src: string; width: number; height: number };
type Variants = Record<'light' | 'dark', SvgPage[]>;

/** 图片点击交给 Rspress 的 mediumZoom，按钮让键盘也能触发同一次点击。 */
export default function TypstFigure({ pages, heading, children }: { pages: string; heading: string; children: ReactNode }) {
  const variants: Variants = JSON.parse(pages);
  const current = useDark() ? 'dark' : 'light';
  const count = Math.max(variants.light.length, variants.dark.length);

  return (
    <figure className="sj-typst">
      {Array.from({ length: count }, (_, i) => {
        const modes = (['light', 'dark'] as const).filter(mode => variants[mode][i]);
        const title = [heading, 'Typst 图', count > 1 && `第 ${i + 1} 页`].filter(Boolean).join(' · ');
        return (
          <button key={i} type="button" className="sj-typst__open" aria-label={`放大${title}`}
            title="放大图表" data-typst-mode={modes.length === 1 ? modes[0] : undefined}
            onClick={event => {
              const button = event.currentTarget;
              if (event.target === button) {
                button.querySelector<HTMLImageElement>(`img[data-typst-mode="${current}"]`)?.click();
              } else if (event.target instanceof HTMLImageElement) {
                event.target.addEventListener('medium-zoom:closed', () => {
                  if (document.activeElement === document.body) button.focus({ preventScroll: true });
                }, { once: true });
              }
            }}>
            {modes.map(mode => {
              const image = variants[mode][i];
              const other = variants[mode === 'light' ? 'dark' : 'light'];
              const alternate = other[Math.min(i, other.length - 1)];
              return <img key={mode} className="sj-typst__thumbnail" data-typst-mode={mode}
                src={image.src} width={image.width} height={image.height} loading="lazy" alt={title}
                style={{ '--sj-typst-alternate': `url("${alternate.src}")` } as CSSProperties} />;
            })}
          </button>
        );
      })}
      <details><summary>查看 Typst 源码</summary>{children}</details>
    </figure>
  );
}
