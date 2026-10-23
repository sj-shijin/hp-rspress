/** Shiki 以通用 scope 定义阅读层级；网站与独立 TextMate JSON 共用配置。 */
import { seeds, createGrayScale, grayIndex, createAccentScale } from './palette.mjs';

export const shikiRoles = {
  background: { label: '代码底色', gray: 16 },
  navigation: {
    label: '流程导航', accent: { light: 'darker', dark: 'light' }, fontStyle: 'bold', usage: '分支、循环、声明与指令',
    scope: [
      'keyword', 'punctuation.definition.directive',
      'storage.type.class', 'storage.type.struct', 'storage.type.enum', 'storage.type.interface', 'storage.type.record',
      'storage.type.function', 'storage.type.template', 'storage.type.namespace', 'storage.modifier.async',
      // 声明使用具体类别或声明上下文；普通存储类型与绑定声明由 auxiliary 接管。
      'storage.type.type', 'keyword.declaration storage.type',
      'meta.class.identifier storage.modifier', 'meta.record.identifier storage.modifier',
      // PowerShell 的声明词与普通类型共用 storage.type，只在声明上下文中提升。
      'meta.function.powershell storage.type.powershell',
      'keyword.operator.expression', 'keyword.operator.wordlike', 'keyword.operator.new', 'keyword.operator.delete',
      'keyword.operator.ternary', 'keyword.operator.arrow.cs',
      'keyword.control punctuation.definition.function', 'keyword.control punctuation.definition.keyword',
      'storage.type.function punctuation.definition.function',
      // 原生 Vue 的 HTML 回退仍保留属性名上下文；无需注入语法即可识别流程指令。
      ...['v-if', 'v-else-if', 'v-else', 'v-for'].map(name =>
        `text.html.vue meta.attribute.unrecognized.${name} entity.other.attribute-name`),
      'markup.changed', 'punctuation.definition.changed',
    ],
  },
  execution: {
    label: '阅读主体', gray: 0, fontStyle: 'bold', usage: '标识符、表达式、模板属性、规则与标题',
    scope: [
      // source 兜底覆盖未细分的代码标识符；类型、字面量和标点由更具体的规则接管。
      'source', 'variable', 'constant.other.caps', 'entity.name.function', 'support.function',
      'entity.name.type.class', 'entity.name.class', 'support.class', 'entity.other.inherited-class',
      'entity.other.inherited-class support.type',
      'entity.other.attribute-name', 'entity.name.other.preprocessor.macro', 'support.type.property-name',
      // Rust 的结果与选项变体表达返回值和匹配分支；Result / Option 类型仍为辅助信息。
      'entity.name.type.result.rust', 'entity.name.type.option.rust',
      // 样式选择器和映射键表达规则目标；不改变 HTML 标签和属性的层级。
      'entity.name.tag.css', 'entity.name.tag.reference.scss', 'support.type.map.key.scss',
      'entity.other.attribute-name.parent-selector-suffix.css punctuation.definition.entity.css',
      // YAML 普通键、锚点与合并键使用阅读主体；别名已由 variable 规则覆盖。
      'entity.name.tag.yaml', 'entity.name.type.anchor.yaml', 'constant.language.merge.yaml',
      // SQL 限定名虽被语法归入 constant，实际承担标识符职责。
      'constant.other.database-name.sql', 'constant.other.table-name.sql',
      'source.sql text.variable', 'source.sql text.bracketed',
      // CMake 平台变量参与条件判断；命令与布尔值共用的 keyword.cmake 保持原样。
      'constant.source.cmake',
      // Make 的目标、依赖、配方和条件保留强调，赋值符与模式符号也参与构建关系。
      'meta.scope.target.makefile', 'meta.scope.recipe.makefile', 'meta.scope.condition.makefile',
      'punctuation.separator.key-value.makefile', 'constant.other.placeholder.makefile',
      // Bash 的选项、分支模式与执行关系参与阅读主线；普通参数值和分号保持原层级。
      'source.shell constant.other.option', 'meta.case.entry.pattern.shell string',
      'punctuation.separator.statement.and.shell', 'punctuation.separator.statement.background.shell',
      'punctuation.separator.regex.alternation.shell', 'punctuation.terminator.statement.case.shell',
      // PowerShell 的 @ 属于数据构造边界，与数组、哈希表括号使用同一层级。
      'keyword.other.hashtable.begin.powershell', 'keyword.other.array.begin.powershell',
      // JSX/TSX 与 Svelte 属性统一强调；其他静态标签属性由 auxiliary 弱化。
      'meta.tag.attributes entity.other.attribute-name',
      'source.svelte meta.tag entity.other.attribute-name',
      // 动态指令与事件复用相同层级。
      'meta.attribute.directive entity.other.attribute-name',
      'meta.attribute.event-handler entity.other.attribute-name', 'punctuation.attribute-shorthand.event',
      // Vue 的 HTML 回退将动态属性与自定义属性统一标为 unrecognized。
      // 名称和取值整体强调；限定模板 HTML，避免提升 script setup / style scoped。
      'text.html.vue text.html.derivative meta.attribute.unrecognized entity.other.attribute-name',
      'text.html.vue text.html.derivative meta.attribute.unrecognized string.quoted',
      'meta.directive keyword.control', 'meta.directive entity.name.type',
      'meta.directive.on punctuation.definition.keyword',
      'meta.special entity.name.type',
      'meta.embedded', 'meta.interpolation', 'meta.template.expression', 'keyword.operator',
      'punctuation.accessor', 'punctuation.separator.dot-access', 'punctuation.separator.pointer-access',
      'punctuation.separator.period', 'punctuation.other.period', 'punctuation.separator.namespace',
      // 表达式括号与定义边界统一强调；明确的类型括号与尖括号由 auxiliary 接管。
      'meta.brace', 'punctuation.bracket', 'punctuation.brackets', 'punctuation.parenthesis',
      'punctuation.curlybrace', 'punctuation.squarebracket',
      'punctuation.group', 'punctuation.section', 'punctuation.definition', 'punctuation.math',
      // f-string 占位边界使用格式标记，数学命令使用常量标记。
      'meta.fstring constant.character.format.placeholder', 'constant.other.general.math', 'constant.character.math',
      'markup.heading', 'entity.name.section', 'markup.bold', 'markup.inserted',
      // 正则中的普通字符与符号共同定义匹配行为；在该上下文覆盖通用文字层级。
      ...['string', 'constant', 'constant.character.escape', 'constant.character.format',
        'entity.name.tag', 'storage.modifier', 'keyword', 'punctuation']
        .map(scope => `source.regexp ${scope}`),
    ],
  },
  comment: {
    label: '注释说明', gray: 0, fontStyle: 'italic', usage: '注释、文档说明与斜体文本',
    scope: ['comment', 'punctuation.definition.comment', 'comment.regexp punctuation', 'string.quoted.docstring', 'string.quoted.docstring punctuation.definition.string', 'markup.italic'],
  },
  content: {
    label: '数据正文', gray: 0, usage: '字面量、参数值、标签与普通正文',
    scope: [
      'string', 'constant', 'support.constant', 'string storage.type.string', 'support.class.math',
      'keyword.other.unit', 'keyword.other.suffix.literal',
      // $true / $false / $null 的前缀随字面量，普通变量仍使用端点粗体。
      'constant.language.powershell punctuation.definition.variable.powershell',
      // text 与 JSX 正文覆盖外层 source 的粗体；嵌入表达式仍复用代码规则。
      'text', 'meta.jsx.children', 'entity.name.tag', 'support.class.component',
      // Diff 普通上下文不继承 source 粗体；增删行仍由各自的 markup 规则接管。
      'source.diff',
      // Dockerfile 的未细分参数、Make 赋值的普通取值与 CMake 原始文本使用常规字重。
      // 指令、变量及 Make 的构建上下文由更具体的规则接管，不额外解析 Shell。
      'source.dockerfile', 'source.makefile', 'argument.source.cmake',
      // 公式中实际显示的圆括号随正文；命令分组花括号属于结构细节。
      'punctuation.math.begin.bracket.round.tex', 'punctuation.math.end.bracket.round.tex',
    ],
  },
  auxiliary: {
    label: '辅助信息', gray: 3, usage: '类型约束、修饰符、声明附注与参数标签',
    scope: [
      'entity.name.type', 'entity.name.namespace', 'entity.name.scope-resolution',
      'support.type', 'storage.type', 'storage.modifier', 'storage.type.template.argument', 'keyword.operator.type',
      'keyword.other.declaration-specifier',
      // C# 的基础类型与 Go 的 type 声明共享 keyword.type 前缀，需要限定语法上下文。
      'source.cs keyword.type',
      // 类型箭头、可选属性和 satisfies 不承担运行时流程；可选链与实际函数箭头保持强调。
      'meta.type storage.type.function.arrow', 'keyword.control.satisfies', 'keyword.operator.optional',
      // Go / Lua 的绑定声明与 const / let / var 使用同一层级。
      'keyword.var.go', 'keyword.const.go', 'keyword.local.lua',
      // C++ 属性属于声明附注，属性边界不继承表达式括号的粗体。
      'support.other.attribute', 'support.other.attribute entity.other.attribute',
      'support.other.attribute punctuation.section.attribute',
      // SQL 的 AS 与 CMake 的 PRIVATE / VERSION 等参数标签不承担流程导航。
      'keyword.other.alias.sql', 'entity.source.cmake',
      // 类型上下文优先于通用括号规则；调用、下标和代码块保持原有层级。
      'meta.type meta.brace', 'meta.type punctuation.definition',
      'meta.object.type punctuation.definition', 'meta.interface punctuation.definition.block',
      'meta.interface meta.method.declaration punctuation.definition.parameters',
      'meta.declaration.type.alias punctuation.definition.begin.bracket.square',
      'meta.declaration.type.alias punctuation.definition.end.bracket.square',
      'meta.declaration.type.alias punctuation.section.parens',
      'meta.declaration.type.alias punctuation.section.arguments.begin.bracket.round.initializer',
      'meta.declaration.type.alias punctuation.section.arguments.end.bracket.round.initializer',
      'punctuation.section.collection-type', 'punctuation.section.tuple-type',
      'punctuation.definition.begin.bracket.square.array.type', 'punctuation.definition.end.bracket.square.array.type',
      'punctuation.section.arguments.begin.bracket.round.decltype', 'punctuation.section.arguments.end.bracket.round.decltype',
      'punctuation.section.parens.begin.bracket.round.function.pointer', 'punctuation.section.parens.end.bracket.round.function.pointer',
      'punctuation.section.parameters.begin.bracket.round.function.pointer', 'punctuation.section.parameters.end.bracket.round.function.pointer',
      'meta.method.return-type punctuation.bracket.square',
      // Java 的类型方括号与下标共用标记，按声明位置区分。
      'meta.definition.variable.java punctuation.bracket.square', 'meta.method.identifier.java punctuation.bracket.square',
      // 只匹配语法识别的尖括号；比较、移位等 keyword.operator 仍由 execution 强调。
      'punctuation.section.angle-brackets', 'punctuation.bracket.angle', 'punctuation.brackets.angle',
      'punctuation.definition.typeparameters', 'punctuation.definition.tag',
      'string.quoted.other.lt-gt.include punctuation.definition.string',
      'punctuation.separator.generic-parameter-clause.begin', 'punctuation.separator.generic-parameter-clause.end',
      'punctuation.separator.generic-argument-clause.begin', 'punctuation.separator.generic-argument-clause.end',
      'meta.tag entity.other.attribute-name', 'meta.tag-stuff entity.other.attribute-name',
      // 文档排版不是控制流；宏定义仍沿用声明规则。
      ...['support.function.section', 'support.function.be',
        'support.function.textbf', 'support.function.textit', 'support.function.texttt', 'support.function.emph',
        'support.function.footnote', 'support.function.marginpar', 'support.function.url', 'support.function.verb',
        'keyword.control.preamble', 'keyword.control.ref', 'keyword.control.label', 'keyword.other.item']
        .flatMap(scope => [scope, `${scope} punctuation.definition.function`, `${scope} punctuation.definition.keyword`]),
      'support.class.latex', 'variable.parameter.function.latex',
      'keyword.control.equation', 'keyword.control.flow.block-scalar',
      'constant.character.escape', 'constant.character.format', 'constant.other.placeholder',
      'constant.character.entity', 'punctuation.definition.entity',
      'meta.diff.header', 'meta.diff.range', 'meta.separator.diff',
      'punctuation.definition.from-file', 'punctuation.definition.to-file', 'punctuation.definition.range',
    ],
  },
  structure: {
    label: '结构细节', gray: 6, usage: '分隔符、引号、排版边界与引用',
    scope: [
      'keyword.operator.key-value', 'punctuation',
      // 引号、排版符号和列表标记保持次级；其余定义边界使用 execution。
      'punctuation.definition.string', 'punctuation.definition.char', 'punctuation.definition.bold', 'punctuation.definition.italic',
      'punctuation.definition.raw', 'punctuation.definition.quote', 'punctuation.definition.table',
      'punctuation.definition.heading',
      'punctuation.definition.keyword', 'punctuation.definition.lifetime', 'markup.list punctuation.definition.list',
      'markup.underline.link', 'constant.other.reference.label', 'variable.parameter.definition.label',
      // 只弱化 Markdown 自身的链接、图片与围栏边界，嵌入代码沿用原语言规则。
      'text.html.markdown punctuation.definition.link', 'text.html.markdown punctuation.definition.constant',
      'punctuation.definition.metadata.markdown', 'punctuation.definition.markdown',
      'constant.other.reference.link.markdown',
      // 使用 TeX / LaTeX 自身的边界标记，避免影响程序语言及正则中的括号。
      ...['arguments', 'arguments.optional', 'textbf', 'textit', 'texttt', 'emph', 'footnote', 'marginpar']
        .flatMap(kind => ['begin', 'end'].map(edge => `punctuation.definition.${kind}.${edge}.latex`)),
      'punctuation.definition.begin.latex', 'punctuation.definition.end.latex', 'punctuation.definition.verb.latex',
      'punctuation.group.begin.latex', 'punctuation.group.end.latex',
      'punctuation.definition.arguments.begin.tex', 'punctuation.definition.arguments.end.tex',
      'punctuation.definition.brackets.tex', 'punctuation.group.begin.tex', 'punctuation.group.end.tex',
      'punctuation.math.begin.bracket.curly.tex', 'punctuation.math.end.bracket.curly.tex',
    ],
  },
  deleted: { label: '删除', gray: 6, fontStyle: 'strikethrough', scope: ['markup.deleted', 'punctuation.definition.deleted'] },
};

export const shikiDisplayRoles = ['navigation', 'execution', 'comment', 'content', 'auxiliary', 'structure'];

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
