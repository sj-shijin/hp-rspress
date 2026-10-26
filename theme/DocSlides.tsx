import { useFrontmatter } from '@rspress/core/runtime';
import MarpPreview from './MarpPreview';

type Slide = { title: string; src: string; size: string; sources?: Record<string, string> };

/** 关联由公开清单或网站展示页提供，不把演示语法写入知识笔记正文。 */
export default function DocSlides() {
  const { frontmatter } = useFrontmatter();
  const slides = frontmatter.slides as Slide[] | undefined;
  if (!slides?.length) return null;
  return <section className="rp-doc cf-doc-slides" aria-label="配套演示">
    <h2>配套演示</h2>
    {slides.map(slide => <div key={slide.src}>
      <h3>{slide.title}</h3>
      <MarpPreview key={slide.src} title={slide.title} sources={slide.sources ?? { [slide.size]: slide.src }} />
    </div>)}
  </section>;
}
