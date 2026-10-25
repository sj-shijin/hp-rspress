import { render } from 'pele';
import { alert } from '@mdit/plugin-alert';
import mark from 'markdown-it-mark';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import { bundledLanguagesInfo, createHighlighter } from 'shiki';
import { createShikiTheme } from './shiki.mjs';
import { marpFonts } from './marp.mjs';
import { withPeleHitAreas } from './pele-svg.mjs';

export default {
  lang: 'zh-CN',
  template: 'bespoke',
  async engine({ marp }) {
    marp.markdown.use(mark).use(sub).use(sup);
    marp.markdown.use(alert, {
      deep: true,
      titleRender(tokens, index) {
        // 结论只显示正文，其他类型使用简短中文标签，不添加图标。
        const title = { note: '说明', tip: '提示', warning: '注意', caution: '警告' }[tokens[index].markup];
        return title ? `<p class="markdown-alert-title">${title}</p>\n` : '';
      },
    });

    const highlighter = await createHighlighter({
      themes: ['light', 'dark'].map(mode => createShikiTheme(undefined, mode, { variables: true })),
      // 仅在构建期加载内置语法，与独立主题 JSON 一致。
      langs: bundledLanguagesInfo.map(lang => lang.id),
    });
    const languages = new Set(highlighter.getLoadedLanguages());
    marp.markdown.set({
      highlight(code, language) {
        const lang = language.toLowerCase();
        return highlighter.codeToHtml(code.replace(/\n$/, ''), {
          lang: languages.has(lang) ? lang : 'text',
          themes: { light: 'cinderfolio-light', dark: 'cinderfolio-dark' },
          defaultColor: 'light-dark()',
        });
      },
    });

    // 将封面的 h1 与紧随的可选 h6 组成一组；作者仍使用普通 Markdown。
    marp.markdown.core.ruler.before('marpit_collect', 'cinderfolio_cover_title', state => {
      const grouped = [];
      let cover = false;
      for (let index = 0; index < state.tokens.length; index += 1) {
        const token = state.tokens[index];
        if (token.type === 'marpit_slide_open') {
          cover = (token.attrGet('class') || '').split(/\s+/).includes('cover');
        }
        if (cover && token.type === 'heading_open' && token.tag === 'h1') {
          const open = new state.Token('cinderfolio_cover_title_open', 'div', 1);
          open.attrSet('class', 'cf-marp-cover-title');
          open.block = true;
          open.level = token.level;
          grouped.push(open);
          do {
            const heading = state.tokens[index++];
            heading.level += 1;
            grouped.push(heading);
          } while (state.tokens[index - 1].type !== 'heading_close'
            || (state.tokens[index]?.type === 'heading_open' && state.tokens[index].tag === 'h6'));
          const close = new state.Token('cinderfolio_cover_title_close', 'div', -1);
          close.block = true;
          close.level = open.level;
          grouped.push(close);
          index -= 1;
          cover = false;
        } else {
          grouped.push(token);
        }
      }
      state.tokens = grouped;
    });

    // 其余围栏保留 Marp 原生渲染流程，包括代码块的自动缩放。
    const fence = marp.markdown.renderer.rules.fence;
    marp.markdown.renderer.rules.fence = (tokens, position, options, env, renderer) => {
      const token = tokens[position];
      if (token.info.trim().split(/\s+/)[0].toLowerCase() !== 'mermaid') {
        return fence(tokens, position, options, env, renderer);
      }
      const { svg } = render(token.content, {
        // token 的行号在一份文档内唯一，多次构建也稳定；Pele 同步处理 ID 与引用。
        idPrefix: `cf-marp-${token.map[0]}`,
        fontFamily: marpFonts.text,
        fontFamilyMono: marpFonts.code,
        fontSize: 24,
        maxWidth: 1120,
        autoDirection: false,
      });
      return `<figure class="cinderfolio-pele">${withPeleHitAreas(svg)}</figure>`;
    };
    return marp;
  },
};
