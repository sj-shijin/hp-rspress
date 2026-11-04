import { createPeleCss } from 'cinderfolio/css';
import type { CinderfolioSeeds } from './CinderfolioTheme';

const svgNS = 'http://www.w3.org/2000/svg';
export const peleZoomId = 'sj-pele-zoom-target';
export const emptySvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';

/** 独立图片不能继承正文的 CSS 变量，随图带上当前种子的亮暗配色与 Pele 样式。 */
function previewSource(svg: SVGSVGElement, input: CinderfolioSeeds) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(createPeleCss(input));
  const style = document.createElementNS(svgNS, 'style');
  style.textContent = Array.from(sheet.cssRules, rule => {
    if (rule instanceof CSSStyleRule) {
      if (rule.selectorText === '[data-cinderfolio="light"]') return `:root { ${rule.style.cssText} }`;
      if (rule.selectorText === '[data-cinderfolio="dark"]') {
        return `@media (prefers-color-scheme: dark) { :root { ${rule.style.cssText} } }`;
      }
    }
    return rule.cssText;
  }).join('\n');

  const image = document.createElementNS(svgNS, 'svg');
  const { width, height } = svg.viewBox.baseVal;
  image.setAttribute('width', String(width));
  image.setAttribute('height', String(height));
  image.setAttribute('viewBox', `0 0 ${width} ${height}`);
  image.classList.add('cinderfolio-pele');
  const fonts = getComputedStyle(svg);
  image.style.setProperty('--pele-font', fonts.fontFamily);
  image.style.setProperty('--pele-font-mono', fonts.getPropertyValue('--pele-font-mono'));
  image.append(style, svg.cloneNode(true));
  // medium-zoom 根据 URL 的 .svg 后缀识别矢量图，小图也可以放大到视口。
  return `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(image))}#pele.svg`;
}

export async function openPeleZoom(svg: SVGSVGElement, input: CinderfolioSeeds, trigger: HTMLElement) {
  const image = document.getElementById(peleZoomId) as HTMLImageElement;
  const { left, top, width, height } = svg.getBoundingClientRect();
  Object.assign(image.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  const source = previewSource(svg, input);
  image.src = source;
  image.alt = svg.querySelector('title')?.textContent || 'Mermaid 图表';
  // mediumZoom 按 currentSrc 判断是否可按矢量图放大，要等浏览器切换到这份 SVG。
  try {
    await image.decode();
  } catch (error) {
    if (image.getAttribute('src') === source) console.warn('[Mermaid] 预览图片未能加载', error);
    return;
  }
  if (!trigger.isConnected || image.getAttribute('src') !== source) return;
  image.addEventListener('medium-zoom:closed', () => {
    image.src = emptySvg;
    image.alt = '';
    if (document.activeElement === document.body) trigger.focus({ preventScroll: true });
  }, { once: true });
  image.click();
}
