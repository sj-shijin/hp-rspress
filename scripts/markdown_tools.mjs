/** 解析而不重排 Markdown；链接按源位置替换，LaTeX 和代码保持原样。 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkCjkFriendlyGfmStrikethrough from 'remark-cjk-friendly-gfm-strikethrough';

const markdownParser = unified().use(remarkParse).use(remarkGfm)
  .use(remarkCjkFriendly).use(remarkCjkFriendlyGfmStrikethrough).use(remarkMath);

function visit(node, callback) {
  callback(node);
  node.children?.forEach(child => visit(child, callback));
}

function htmlLinks(source) {
  const links = [];
  for (const match of source.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gis)) {
    links.push({ url: match[2], start: match.index + match[0].indexOf(match[1]) + 1,
      end: match.index + match[0].length - 1 });
  }
  return links;
}

function destinations(markdown) {
  const links = [];
  visit(markdownParser.parse(markdown), node => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (node.type === 'html') {
      for (const link of htmlLinks(node.value)) {
        links.push({ ...link, start: start + link.start, end: start + link.end });
      }
    } else if (['link', 'image', 'definition'].includes(node.type)) {
      const source = markdown.slice(start, end);
      const marker = node.type === 'definition' ? ']:' : '](';
      if (!source.includes(marker)) {
        const angled = source.startsWith('<');
        links.push({ url: node.url, start: start + (angled ? 1 : 0), end: end - (angled ? 1 : 0) });
        return;
      }
      let from = source.lastIndexOf(marker) + marker.length;
      while (/\s/.test(source[from] || '') && from < source.length) from++;
      const angled = source[from] === '<';
      if (angled) from++;
      let to = from, depth = 0;
      for (; to < source.length; to++) {
        const char = source[to];
        if (char === '\\') { to++; continue; }
        if (angled ? char === '>' : (/\s/.test(char) || (char === ')' && depth === 0))) break;
        if (char === '(') depth++;
        if (char === ')') depth--;
      }
      links.push({ url: node.url, start: start + from, end: start + to });
    }
  });
  return links;
}

function prepareMarkdown(markdown, route, origin, routes) {
  const localOrigin = origin || 'https://rspress.local';
  function target(href) {
    if (/^[a-z][\w+.-]*:/i.test(href) && !/^https?:/i.test(href)) return href;
    const url = new URL(href, localOrigin + route);
    if (url.origin !== localOrigin) return href.startsWith('//') ? url.href : href;
    url.pathname = routes[url.pathname] || url.pathname;
    return origin ? url.href : url.pathname + url.search + url.hash;
  }
  let text = markdown.replace(/^> For AI agents:[^\n]*\n\s*\n?/, '');
  for (const link of destinations(text).sort((a, b) => b.start - a.start)) {
    text = text.slice(0, link.start) + target(link.url) + text.slice(link.end);
  }
  const hint = `> For AI agents: the complete documentation index is available at ${origin}/llms.txt, the full documentation bundle is available at ${origin}/llms-full.txt.`;
  return `${hint}\n\n${text.trim()}\n`;
}

function citationSource(markdown, slug) {
  const matches = [];
  visit(markdownParser.parse(markdown), node => {
    // 只读取普通文本；公式、围栏代码和行内代码不会进入转换。
    if (node.type !== 'text') return;
    const offset = node.position.start.offset;
    const source = markdown.slice(offset, node.position.end.offset);
    for (const match of source.matchAll(/(?<!\\)\[@[^\]\n]+\]/g)) {
      matches.push({ start: offset + match.index, end: offset + match.index + match[0].length,
        citation: match[0] });
    }
  });
  matches.sort((a, b) => a.start - b.start);
  let text = markdown;
  for (let i = matches.length - 1; i >= 0; i--) {
    const { start, end } = matches[i];
    text = text.slice(0, start) + `@@cite-${slug}-${i + 1}@@` + text.slice(end);
  }
  return { markdown: text, citations: matches.map(match => match.citation) };
}

let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
const result = request.action === 'prepare'
  ? request.pages.map(page => prepareMarkdown(page.markdown, page.route, request.origin, request.routes))
  : request.action === 'citations'
    ? request.pages.map(page => citationSource(page.markdown, page.slug))
    : request.pages.map(page => destinations(page.markdown).map(link => link.url));
process.stdout.write(JSON.stringify(result));
