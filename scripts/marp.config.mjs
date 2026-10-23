import { render } from 'pele';
import { bundledLanguagesInfo, createHighlighter } from 'shiki';
import { createShikiTheme } from '../cinderfolio/shiki.mjs';
import { marpFonts } from '../cinderfolio/marp.mjs';

export default {
  lang: 'zh-CN',
  template: 'bespoke',
  async engine({ marp }) {
    const highlighter = await createHighlighter({
      themes: ['light', 'dark'].map(mode => createShikiTheme(undefined, mode, { variables: true })),
      // 仅在构建期加载内置语法，与网站和独立主题 JSON 一致。
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
      return `<figure class="cinderfolio-pele">${svg}</figure>`;
    };
    return marp;
  },
};
