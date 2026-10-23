/** Shiki 以通用 scope 定义阅读层级；网站与独立 TextMate JSON 共用配置。 */
import { seeds, createGrayScale, grayIndex, createAccentScale } from './palette.mjs';

export const shikiRoles = {
  background: { label: '代码底色', gray: 16 },
  navigation: {
    label: '流程导航', accent: { light: 'darker', dark: 'light' }, fontStyle: 'bold', usage: '关键字、声明、预处理与标题',
    scope: [
      'keyword', 'punctuation.definition.directive',
      'storage.type.class', 'storage.type.struct', 'storage.type.enum', 'storage.type.interface',
      'storage.type.function', 'storage.type.template', 'storage.type.namespace', 'storage.modifier.async',
      // 这些语法没有通用的声明子类；不能提升整个 storage.type，否则普通类型也会变成品牌色。
      'storage.type.js', 'storage.type.ts', 'storage.type.rust', 'storage.type.local.java',
      'meta.class.identifier storage.modifier', 'meta.record.identifier storage.modifier',
      'keyword.operator.expression', 'keyword.operator.wordlike', 'keyword.operator.new', 'keyword.operator.delete',
      'markup.heading', 'entity.name.section', 'entity.name.tag', 'punctuation.definition.heading',
      'keyword.control punctuation.definition.function', 'keyword.control punctuation.definition.keyword',
      'storage.type.function punctuation.definition.function',
      // 章节与环境命令使用通用命名，不绑定 tex / latex 后缀。
      ...['support.function.section', 'support.function.be']
        .flatMap(scope => [scope, `${scope} punctuation.definition.function`]),
      'markup.changed', 'punctuation.definition.changed',
    ],
  },
  execution: {
    label: '执行主体', gray: 0, fontStyle: 'bold', usage: '函数、变量、运算与结构边界',
    scope: [
      // source 兜底覆盖未细分的代码标识符；类型、字面量和标点由更具体的规则接管。
      'source', 'variable', 'constant.other.caps', 'entity.name.function', 'support.function',
      'entity.other.attribute-name', 'entity.name.other.preprocessor.macro', 'support.type.property-name',
      'meta.embedded', 'meta.interpolation', 'meta.template.expression', 'keyword.operator',
      'punctuation.accessor', 'punctuation.separator.dot-access', 'punctuation.separator.pointer-access',
      'punctuation.separator.period', 'punctuation.other.period', 'punctuation.separator.namespace',
      // 括号与定义边界统一强调；不再区分调用、定义、分组、数组和捕获。
      'meta.brace', 'punctuation.bracket', 'punctuation.brackets', 'punctuation.parenthesis',
      'punctuation.group', 'punctuation.section', 'punctuation.definition', 'punctuation.math',
      'string.quoted.other.lt-gt punctuation.definition.string',
      // f-string 占位边界使用格式标记，数学命令使用常量标记。
      'meta.fstring constant.character.format.placeholder', 'constant.other.general.math', 'constant.character.math',
      'markup.bold', 'markup.inserted',
    ],
  },
  comment: {
    label: '注释说明', gray: 0, fontStyle: 'italic', usage: '注释、文档说明与斜体文本',
    scope: ['comment', 'punctuation.definition.comment', 'string.quoted.docstring', 'string.quoted.docstring punctuation.definition.string', 'markup.italic'],
  },
  content: {
    label: '数据正文', gray: 0, usage: '字符串、数字与正文',
    scope: ['string', 'constant', 'support.constant', 'string storage.type.string', 'support.class.math', 'keyword.other.unit', 'keyword.other.suffix.literal'],
  },
  auxiliary: {
    label: '辅助信息', gray: 3, usage: '转义、格式与差异标题',
    scope: [
      'constant.character.escape', 'constant.character.format', 'constant.other.placeholder', 'storage.type.format',
      'constant.character.entity', 'punctuation.definition.entity',
      'meta.diff.header', 'meta.diff.range', 'meta.separator.diff',
      'punctuation.definition.from-file', 'punctuation.definition.to-file', 'punctuation.definition.range',
    ],
  },
  structure: {
    label: '结构细节', gray: 6, usage: '类型、分隔符与引用',
    scope: [
      'entity.name.type', 'entity.name.class', 'entity.name.namespace', 'entity.name.scope-resolution',
      'support.type', 'support.class', 'storage.type', 'storage.modifier', 'storage.type.template.argument',
      'keyword.operator.type', 'keyword.operator.key-value', 'punctuation',
      // 引号、排版符号和列表标记保持次级；其余定义边界使用 execution。
      'punctuation.definition.string', 'punctuation.definition.bold', 'punctuation.definition.italic',
      'punctuation.definition.raw', 'punctuation.definition.quote', 'punctuation.definition.table',
      'punctuation.definition.keyword', 'punctuation.definition.lifetime', 'markup.list punctuation.definition.list',
      'markup.underline.link', 'constant.other.reference.label', 'variable.parameter.definition.label',
    ],
  },
  deleted: { label: '删除', gray: 6, fontStyle: 'strikethrough', scope: ['markup.deleted', 'punctuation.definition.deleted'] },
};

export const shikiRoleGroups = ['navigation', 'execution', 'comment', 'content', 'auxiliary', 'structure']
  .map(key => [shikiRoles[key].label, [key], shikiRoles[key].usage]);

/** 每个阅读层级保留色阶名称，显示职责与主题导出均从这里取值。 */
export function createShikiPalette(input = seeds, mode = 'light') {
  const gray = createGrayScale(input), accent = createAccentScale(input.accent);
  return Object.fromEntries(Object.entries(shikiRoles).map(([key, role]) => {
    const step = 'gray' in role ? `g${grayIndex(role.gray, mode)}` : role.accent[mode];
    return [key, { step, color: gray[step] ?? accent[step] }];
  }));
}

/** 网站使用已有色阶变量实时预览；下载和构建默认输出不依赖 CSS 的 HEX。 */
export function createShikiTheme(input = seeds, mode = 'light', { variables = false } = {}) {
  const palette = createShikiPalette(input, mode);
  const color = key => {
    const { step, color } = palette[key];
    return variables ? `var(--cf-${step.startsWith('g') ? step : `accent-${step}`})` : color;
  };
  return {
    name: `cinderfolio-${mode}`,
    displayName: `Cinderfolio ${mode === 'light' ? 'Light' : 'Dark'}`,
    type: mode,
    colors: { 'editor.foreground': color('execution'), 'editor.background': color('background') },
    tokenColors: Object.entries(shikiRoles).filter(([, role]) => role.scope).map(([key, role]) => ({
      name: role.label,
      scope: role.scope,
      // 清空未指定的字形，避免类型、取值和标点继承外层的粗体或斜体。
      settings: { foreground: color(key), fontStyle: role.fontStyle ?? '' },
    })),
  };
}
