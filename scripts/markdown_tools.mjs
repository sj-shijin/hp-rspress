/** 解析而不重排 Markdown；链接按源位置替换，LaTeX 和代码保持原样。 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkCjkFriendlyGfmStrikethrough from 'remark-cjk-friendly-gfm-strikethrough';
import rehypeParse from 'rehype-parse';

const markdownParser = unified().use(remarkParse).use(remarkGfm)
  .use(remarkCjkFriendly).use(remarkCjkFriendlyGfmStrikethrough).use(remarkMath);
const htmlParser = unified().use(rehypeParse, { fragment: true });
const classes = node => node.properties?.className || [];
const normalize = text => text.replace(/\s+/g, ' ').trim();

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

function markdownContent(markdown) {
  const math = [];
  function text(node) {
    if (['math', 'inlineMath'].includes(node.type)) {
      math.push({ tex: normalize(node.value), display: node.type === 'math' });
      return ' MATH ';
    }
    if (node.type === 'html') return htmlContent(node.value, false).text;
    if (node.type === 'image') return node.alt || '';
    if (node.type === 'definition') return '';
    if (node.type === 'break') return '\n';
    if (node.value !== undefined) return node.value;
    const block = ['root', 'heading', 'paragraph', 'list', 'listItem', 'blockquote', 'table', 'tableRow'];
    const separated = ['root', 'list', 'listItem', 'blockquote', 'table', 'tableRow'];
    const value = (node.children || []).map(text).join(separated.includes(node.type) ? '\n' : '');
    return block.includes(node.type) ? `\n${value}\n` : value;
  }
  const tree = markdownParser.parse(markdown.replace(/^> For AI agents:[^\n]*\n/, ''));
  return { text: text(tree), math };
}

function htmlContent(html, requireDocument = true) {
  const tree = htmlParser.parse(html);
  let document;
  visit(tree, node => { if (classes(node).includes('rspress-doc')) document = node; });
  if (requireDocument && !document) throw new Error('网页缺少 rspress-doc 正文容器');
  const math = [];
  function text(node, display = false) {
    const names = classes(node);
    if (names.includes('katex')) {
      let tex;
      visit(node, child => {
        if (child.tagName === 'annotation' && child.properties?.encoding === 'application/x-tex') {
          tex = (child.children || []).map(part => part.value || '').join('');
        }
      });
      if (tex === undefined) throw new Error('公式缺少 LaTeX 标注');
      math.push({ tex: normalize(tex), display });
      return ' MATH ';
    }
    if (['script', 'style', 'button', 'svg'].includes(node.tagName)
        || names.some(name => ['rp-not-doc', 'rp-header-anchor', 'rp-llms-hint'].includes(name))
        || node.properties?.ariaHidden === 'true') return '';
    if (node.type === 'text') return node.value;
    if (node.tagName === 'img') return node.properties?.alt || '';
    const value = (node.children || []).map(child => text(child, display || names.includes('katex-display'))).join('');
    const block = /^(?:p|div|h[1-6]|li|tr|td|th|blockquote|pre|section|article|br)$/.test(node.tagName);
    return block ? `\n${value}\n` : value;
  }
  return { text: text(document || tree), math };
}

function compareContent(html, markdown) {
  const actual = htmlContent(html);
  const source = markdownContent(markdown);
  const plain = normalize(source.text);
  const missing = [...new Set(actual.text.split('\n').map(normalize).filter(Boolean))]
    .filter(segment => !plain.includes(segment));
  const htmlPlain = normalize(actual.text);
  const missingHtml = [...new Set(source.text.split('\n').map(normalize).filter(Boolean))]
    .filter(segment => !htmlPlain.includes(segment));
  return { htmlFormulas: actual.math.length, markdownFormulas: source.math.length,
    formulasMatch: JSON.stringify(actual.math) === JSON.stringify(source.math), missing, missingHtml };
}

let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
const result = request.action === 'prepare'
  ? request.pages.map(page => prepareMarkdown(page.markdown, page.route, request.origin, request.routes))
  : request.action === 'compare'
    ? request.pages.map(page => compareContent(page.html, page.markdown))
    : request.pages.map(page => destinations(page.markdown).map(link => link.url));
process.stdout.write(JSON.stringify(result));
