/** 仅处理 Pele 生成的 SVG：为连线路径添加透明、连续的鼠标命中层。
 * 不复制 ID、样式、箭头或事件；原路径的几何与显示属性保持不变。
 */
export function withPeleHitAreas(svg) {
  if (svg.includes('class="cf-pele-edge-hit"')) return svg;
  const groups = [];
  return svg.replace(/<\/?g\b[^>]*>|<(?:path|line|polyline)\b[^>]*\/>/g, tag => {
    if (tag.startsWith('</g')) {
      groups.pop();
      return tag;
    }
    const classes = (tag.match(/\bclass="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    if (tag.startsWith('<g')) {
      if (!tag.endsWith('/>')) groups.push(classes.includes('pele-edge')
        || (classes.includes('pele-series') && classes.includes('pele-line')));
      return tag;
    }
    if (classes.includes('pele-marker')) return tag;
    const standalone = classes.includes('pele-edge');
    if (!standalone && !groups.at(-1)) return tag;
    const name = tag.match(/^<(\w+)/)[1];
    const geometry = tag.match(/\s(?:d|x1|y1|x2|y2|points|transform)="[^"]*"/g)?.join('') ?? '';
    const hit = `<${name} class="cf-pele-edge-hit"${geometry} fill="none" stroke="transparent" opacity="0" pointer-events="none" aria-hidden="true"/>`;
    // 独立路径需要分组，使透明命中层与可见路径共用 :hover。
    return standalone ? `<g class="cf-pele-edge">${hit}${tag}</g>` : hit + tag;
  });
}
