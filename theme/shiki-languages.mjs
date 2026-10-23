import vue from '@shikijs/langs/vue';

// Shiki 4.5.0 的 Vue 注入仍指向 source.vue，主语法已改为 text.html.vue。
// 将上游现成注入随主语法注册，也避免懒加载 JSX / Markdown 后重载丢失注入。
// 不改分词规则；升级 Shiki 后复核是否仍需要。
const injections = Object.fromEntries(vue.filter(grammar => grammar.injectTo?.includes('source.vue'))
  .map(grammar => [grammar.injectionSelector, { patterns: grammar.patterns }]));

export const vueLanguages = vue.map(grammar => grammar.name === 'vue'
  ? { ...grammar, injections: { ...grammar.injections, ...injections } }
  : grammar);
