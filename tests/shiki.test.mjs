import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createHighlighter } from 'shiki';
import { seeds } from '../cinderfolio/palette.mjs';
import { themeVariables } from '../cinderfolio/css.mjs';
import { shikiRoles, shikiDisplayRoles, createShikiPalette, createShikiTheme } from '../cinderfolio/shiki.mjs';

let highlighter;
before(async () => {
  highlighter = await createHighlighter({
    langs: ['vue', 'c', 'cpp', 'csharp', 'python', 'javascript', 'typescript', 'rust', 'go', 'java', 'bash', 'powershell', 'json', 'css', 'scss', 'markdown', 'html', 'xml', 'tex', 'latex', 'ruby', 'kotlin', 'swift', 'lua', 'yaml', 'toml', 'sql', 'cmake', 'dockerfile', 'make', 'mermaid', 'diff', 'regexp', 'jsx', 'tsx', 'svelte', 'twig', 'liquid'],
    themes: ['light', 'dark'].map(mode => createShikiTheme(seeds, mode)),
  });
});
after(() => highlighter.dispose());

function tokenAt(code, lang, mode, text) {
  const index = code.indexOf(text);
  assert.ok(index >= 0, text);
  const { tokens } = highlighter.codeToTokens(code, { lang, theme: `cinderfolio-${mode}` });
  return tokens.flat().find(token => token.offset <= index && token.offset + token.content.length > index);
}

function checkBrackets(code, lang, mode, cases) {
  const palette = createShikiPalette(seeds, mode);
  const tokens = highlighter.codeToTokens(code, { lang, theme: `cinderfolio-${mode}` }).tokens.flat();
  for (const [fragment, styles] of cases) {
    const start = code.indexOf(fragment);
    assert.ok(start >= 0, fragment);
    const brackets = [...fragment.matchAll(/[()[\]{}]/g)];
    const expected = Array.isArray(styles) ? styles : brackets.map(() => styles);
    assert.equal(brackets.length, expected.length, fragment);
    for (const [index, bracket] of brackets.entries()) {
      const offset = start + bracket.index;
      const token = tokens.find(token => token.offset <= offset && token.offset + token.content.length > offset);
      const label = `${mode}.${lang}.${fragment}.${index}`;
      assert.equal(token.fontStyle, expected[index], label);
      assert.equal(token.color.toLowerCase(), expected[index] === 2 ? palette.execution.color : palette.auxiliary.color, label);
    }
  }
}

test('实时变量主题与独立 HEX 主题取色一致，六个阅读层级与底色、Diff 删除样式完整覆盖', async () => {
  const keys = ['background', 'deleted', ...shikiDisplayRoles];
  assert.equal(new Set(keys).size, 8);
  assert.deepEqual([...keys].sort(), Object.keys(shikiRoles).sort());
  for (const input of [seeds, { ink: '#102030', paper: '#f3f5f7', accent: '#0095ff' }]) {
    for (const mode of ['light', 'dark']) {
      const theme = createShikiTheme(input, mode);
      const live = createShikiTheme(input, mode, { variables: true });
      const variables = themeVariables(input, mode);
      const resolve = value => variables[value.slice(4, -1)];
      assert.equal(theme.tokenColors.length, 7);
      assert.doesNotMatch(JSON.stringify(theme), /var\(|--cf-|--rp-/);
      for (const key of ['editor.foreground', 'editor.background']) assert.equal(resolve(live.colors[key]), theme.colors[key]);
      for (const [index, rule] of theme.tokenColors.entries()) {
        assert.match(rule.settings.foreground, /^#[0-9a-f]{6}$/);
        assert.equal(resolve(live.tokenColors[index].settings.foreground), rule.settings.foreground);
      }
    }
  }
  // 实际经过 Shiki 的占位颜色转换，HTML 仍须保留可实时更新的变量引用。
  const theme = { ...createShikiTheme(seeds, 'light', { variables: true }), name: 'cinderfolio-live-check' };
  await highlighter.loadTheme(theme);
  const html = highlighter.codeToHtml('return 1;', { lang: 'cpp', theme: theme.name });
  assert.ok(html.includes('var(--cf-accent-darker)'));
  assert.ok(html.includes('var(--cf-g0)'));
});

test('C++ 命名空间与类型使用辅助信息，函数和成员保持粗体，字面量使用常规端点色', () => {
  const code = '#include <span>\n#include "local.hpp"\n#define SCALE 2\n// explanation\nnamespace app {}\nnamespace math = app;\nusing namespace std;\nstruct Vector {};\ntemplate <std::floating_point T>\nT dot(T value) { const T result = value * 2.0f; std::cout << "result" << result; return result; }';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['#include', 'navigation', 2], ['#define', 'navigation', 2], ['<span', 'auxiliary', 0], ['>', 'auxiliary', 0], ['span', 'content', 0], ['SCALE', 'execution', 2],
      ['"local.hpp', 'structure', 0], ['local.hpp', 'content', 0],
      ['//', 'comment', 1], ['explanation', 'comment', 1], ['struct', 'navigation', 2],
      ['app {}', 'auxiliary', 0], ['math =', 'auxiliary', 0], ['app;', 'auxiliary', 0], ['std;', 'auxiliary', 0],
      ['std::floating_point', 'auxiliary', 0], ['std::cout', 'auxiliary', 0], ['cout', 'execution', 2],
      ['Vector', 'auxiliary', 0], ['template', 'navigation', 2], ['floating_point', 'auxiliary', 0], ['const', 'auxiliary', 0],
      ['T dot', 'auxiliary', 0], ['T value', 'auxiliary', 0],
      ['dot', 'execution', 2], ['value', 'execution', 2],
      ['return', 'navigation', 2], ['value *', 'execution', 2], ['*', 'execution', 2], ['2.0f', 'content', 0], ['f;', 'content', 0],
    ]) {
      const token = tokenAt(code, 'cpp', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
    // 实际字面量保留端点色，与变量用字重区分；限定名不会压低后面的成员。
    for (const text of ['2.0f', 'result"']) {
      const token = tokenAt(code, 'cpp', mode, text);
      assert.equal(token.color.toLowerCase(), mode === 'light' ? seeds.ink : seeds.paper, `${mode}.${text}`);
      assert.equal(token.fontStyle, 0, `${mode}.${text}`);
    }
  }
});

test('预处理指令统一使用流程色，连同 # 一起强调', () => {
  const code = '#include <span>\n#define LIMIT 8\n#if defined(USE_FLOAT)\nusing Scalar = float;\n#elif USE_DOUBLE\nusing Scalar = double;\n#else\nusing Scalar = int;\n#endif\n#ifdef DEBUG\n#endif\n#ifndef RELEASE\n#endif';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const directive of ['#include', '#define', '#if', '#ifdef', '#ifndef', '#elif', '#else', '#endif']) {
      // 分别检查 # 和指令名称，避免只覆盖其中一部分。
      for (const text of [directive, directive.slice(1)]) {
        const token = tokenAt(code, 'cpp', mode, text);
        assert.equal(token.color.toLowerCase(), palette.navigation.color, `${mode}.${text}`);
        assert.equal(token.fontStyle, 2, `${mode}.${text}`);
      }
    }
    const defined = tokenAt(code, 'cpp', mode, 'defined');
    assert.equal(defined.color.toLowerCase(), palette.navigation.color);
    assert.equal(defined.fontStyle, 2);
  }
});

test('成员与导入路径的连接符使用端点粗体，命名空间名称和小数保持层级', () => {
  const samples = [
    ['cpp', 'void run() { obj.method(); ptr->method(); std::cout << 1.5; }', ['.method', '->method'], ['::cout']],
    ['python', 'from collections.abc import Iterable\nresult = obj.child.method(1.5)', ['.child', '.method', '.abc'], []],
    ['javascript', 'const result = obj.child.method(); obj?.method(); const number = 1.5;', ['.child', '.method', '?.'], []],
    ['typescript', 'type Item = Model.Alias;\nfunction read(item: Model.Input): Model.Output { return item.child.method(); }\nconst value: Model.Value = obj?.child;\nconst number = 1.5;', ['.child', '.method', '?.', '.Alias', '.Input', '.Output', '.Value'], []],
    ['rust', 'fn main() { obj.method(); let number = 1.5; }', ['.method'], []],
    ['go', 'package main\nfunc main() { obj.Method(); fmt.Println(1.5) }', ['.Method', '.Println'], []],
    ['java', 'package com.example;\nclass A { void run() { obj.method(); double number = 1.5; } }', ['.method'], ['.example']],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [lang, code, accessors, qualifiers] of samples) {
      for (const text of accessors) {
        const token = tokenAt(code, lang, mode, text);
        assert.equal(token.color.toLowerCase(), palette.execution.color, `${mode}.${lang}.${text}`);
        assert.equal(token.fontStyle, 2, `${mode}.${lang}.${text}`);
      }
      for (const text of qualifiers) {
        const token = tokenAt(code, lang, mode, text);
        assert.equal(token.color.toLowerCase(), palette.structure.color, `${mode}.${lang}.${text}`);
        assert.equal(token.fontStyle, 0, `${mode}.${lang}.${text}`);
      }
      assert.equal(tokenAt(code, lang, mode, '.5').fontStyle, 0, `${mode}.${lang}.小数点`);
    }
  }
});

test('定义、调用、分组、捕获与代码块括号统一使用端点粗体', () => {
  const samples = [
    ['c', 'int run(int values[3]) { consume(values[0]); return consume((value + 1)); }', [
      ['run(int values[3])', 2], ['consume(values[0])', 2], ['consume((value + 1))', 2],
    ]],
    ['cpp', '[[nodiscard]] int run(int values[3]) { auto f = [&values](int i) { return values[i]; }; obj.method(values[0]); consume((value + 1)); if (ready) { work(); } }', [
      ['[[nodiscard]]', 0], ['run(int values[3])', [2, 0, 0, 2]], ['[&values](int i)', 2],
      ['obj.method(values[0])', 2], ['consume((value + 1))', 2], ['if (ready) { work(); }', 2],
    ]],
    ['python', 'def run(items: list[int]):\n    result = call((x + y), items[0])\n    return items[fn(0)]', [
      ['run(items: list[int])', 2], ['call((x + y), items[0])', 2], ['items[fn(0)]', 2],
    ]],
    ['java', 'class A { void run(int[] values) { obj.method(values[0]); consume((value + 1)); } }', [
      ['run(int[] values)', [2, 0, 0, 2]], ['obj.method(values[0])', 2], ['consume((value + 1))', 2],
    ]],
    ...['javascript', 'typescript'].map(lang => [lang, 'function run(value) { return value; }\nconst twice = (value) => value * 2;\nconst api = { method(item) { return item; } };', [
      ['run(value)', 2], ['(value) =>', 2], ['method(item)', 2],
    ]]),
    ['cpp', 'class Item { public: Item(int value) : value_(value) {} int read() const { return value_; } private: int value_; };', [
      ['Item(int value)', 2], ['read()', 2],
    ]],
    ['css', '.card { width: calc((100% - 1rem) / 2); grid-template-columns: repeat(2, minmax(0, 1fr)); }\n@media (min-width: 40rem) {}', [
      ['calc((100% - 1rem) / 2)', 2], ['repeat(2, minmax(0, 1fr))', 2], ['@media (min-width: 40rem) {}', 2],
    ]],
  ];
  for (const mode of ['light', 'dark']) for (const [lang, code, cases] of samples) checkBrackets(code, lang, mode, cases);
});

test('类型括号使用辅助信息，表达式、调用、捕获和代码块继续使用端点粗体', () => {
  const samples = [
    ['cpp', 'void run() { int values[3]; const int x[]{1, 2}; auto value = values[0]; }', [
      ['values[3]', 2], ['x[]{1, 2}', 2], ['values[0]', 2], ['run()', 2],
    ]],
    ['python', 'values: list[int] = [1, 2]\nvalue = values[0]\nif (value): pass', [
      ['list[int]', 2], ['[1, 2]', 2], ['values[0]', 2], ['(value)', 2],
    ]],
    ...['javascript', 'typescript'].map(lang => [lang, 'const values = [1, 2]; const [x, y] = values; const value = values[0]; fn((x + y));', [
      ['[1, 2]', 2], ['[x, y]', 2], ['values[0]', 2], ['fn((x + y))', 2],
    ]]),
    ['typescript', 'function run(values: number[]): number[] { return values; }\ntype Pair = [number, number];', [
      ['run(values: number[])', [2, 0, 0, 2]], ['[number, number]', 0],
    ]],
    ...['typescript', 'tsx'].map(lang => [lang, 'type Choice = (A | B)[]; type Reader = (x: number) => string; type Obj = { values: number[] }; interface API { read(x: number): string; } const fn: Reader = (x) => String(x);', [
      ['(A | B)[]', 0], ['(x: number)', 0], ['{ values: number[] }', 0], ['{ read(x: number): string; }', 0], ['(x) =>', 2], ['String(x)', 2],
    ]]),
    ['cpp', 'using Row = int[3]; using Callback = int (*)(int); using Value = decltype(read(0)); int (*callback)(int);', [
      ['int[3]', 0], ['int (*)(int)', 0], ['decltype(read(0))', [0, 2, 2, 0]], ['(*callback)(int)', 0],
    ]],
    ['rust', '#[derive(Debug)]\nfn run(values: &[i32]) { let list = [1, 2]; let value = values[0]; call((x + y)); }', [
      ['#[derive(Debug)]', 2], ['run(values: &[i32])', 2], ['[1, 2]', 2], ['values[0]', 2], ['call((x + y))', 2],
    ]],
    ['go', 'package main\nfunc run(values []int) { list := []int{1, 2}; value := values[0]; fn((value + 1)) }', [
      ['run(values []int)', 2], ['[]int{1, 2}', 2], ['values[0]', 2], ['fn((value + 1))', 2],
    ]],
    ['java', 'class A { void run() { int[] values = new int[]{1, 2}; int value = values[0]; } }', [
      ['int[] values', 0], ['new int[]{1, 2}', 2], ['values[0]', 2], ['run()', 2],
    ]],
    ['bash', 'run() {\n values=(a b c)\n echo "${values[0]}"\n if [[ $count -gt 0 ]]; then echo ok; fi\n}', [
      ['run()', 2], ['(a b c)', 2], ['${values[0]}', 2], ['[[ $count -gt 0 ]]', 2],
    ]],
    ['json', '{"values": [1, 2]}', [['{"values": [1, 2]}', 2]]],
    ['ruby', 'def run(values)\n values.map { |v| (v + 1) }\nend\nrun([1, 2])', [
      ['run(values)', 2], ['{ |v| (v + 1) }', 2], ['run([1, 2])', 2],
    ]],
    ['kotlin', 'fun run(values: List<Int>): Int { return values[0] + (1) }\nrun(listOf(1, 2))', [
      ['run(values: List<Int>)', 2], ['{ return values[0] + (1) }', 2], ['run(listOf(1, 2))', 2],
    ]],
    ['swift', 'func run(_ values: [Int]) -> Int { values.reduce(0) { $0 + $1 } }\nrun([1, 2])', [
      ['run(_ values: [Int])', [2, 0, 0, 2]], ['{ values.reduce(0) { $0 + $1 } }', 2], ['run([1, 2])', 2],
    ]],
    ['swift', 'typealias Pair = (Int, Int)\nlet callback: (Int) -> String\nlet values: [Int] = [1, 2]', [
      ['(Int, Int)', 0], ['(Int)', 0], ['[Int]', 0], ['[1, 2]', 2],
    ]],
    ['lua', 'local function run(values)\n return (values[1] + values[2])\nend\nrun({1, 2})', [
      ['run(values)', 2], ['(values[1] + values[2])', 2], ['run({1, 2})', 2],
    ]],
    ['yaml', 'colors: [orange, gray]\nconfig: {enabled: true}', [['[orange, gray]', 2], ['{enabled: true}', 2]]],
    ['toml', '[theme]\ncolors = ["orange", "gray"]\nconfig = {enabled = true}', [
      ['[theme]', 2], ['["orange", "gray"]', 2], ['{enabled = true}', 2],
    ]],
  ];
  for (const mode of ['light', 'dark']) for (const [lang, code, cases] of samples) checkBrackets(code, lang, mode, cases);
});

test('通用结构规则不把字符串、注释和排版标记变成粗体', () => {
  const samples = [
    ['cpp', 'const char* value = "literal () [] {}"; // comment () [] {}', [['literal ()', 'content', 0], ['comment ()', 'comment', 1], ['"literal', 'structure', 0]]],
    ['typescript', 'const value = "literal () [] {}"; // comment () [] {}', [['literal ()', 'content', 0], ['comment ()', 'comment', 1], ['"literal', 'structure', 0]]],
    ['python', 'value = f"{result:.3f} {{escaped}}" # comment () [] {}', [[':.3f', 'auxiliary', 0], ['{{', 'auxiliary', 0], ['comment ()', 'comment', 1]]],
    ['go', 'package main\nvar name string = "literal () [] {}"', [['string', 'auxiliary', 0], ['literal ()', 'content', 0]]],
    ['markdown', '- **strong** and *emphasis*', [['-', 'structure', 0], ['**', 'structure', 0], ['*emphasis', 'structure', 0]]],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [lang, code, checks] of samples) for (const [text, role, style] of checks) {
      const token = tokenAt(code, lang, mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${lang}.${text}`);
    }
  }
});

test('模板、泛型和标签尖括号跟随类型使用辅助信息，比较与移位运算符保留端点粗体', () => {
  const types = [
    ['cpp', '#include <vector>\ntemplate <typename T>\nusing Grid = std::vector<std::vector<T>>;'],
    ['typescript', 'function first<T>(items: Array<T>): T { return items[0]; }'],
    ['rust', 'struct Box<T> { items: Vec<Vec<T>> }'],
    ['java', 'class Box<T> { List<List<T>> items; }'],
    ['swift', 'struct Box<T> { var items: Array<Array<T>> }'],
    ['html', '<article><span>Title</span></article>'],
    ...['jsx', 'tsx'].map(lang => [lang, 'const view = <Panel><span>Title</span></Panel>;']),
    ['vue', '<template><section>Title</section></template>'],
    ['svelte', '<section><button>Done</button></section>'],
  ];
  const operators = [
    ['cpp', 'bool compare(int a, int b) { return a < b && a <= b && b > a && b >= a; }\nint shift(int x) { return (x << 1) >> 1; }'],
    ...['javascript', 'typescript', 'jsx', 'tsx'].map(lang => [lang, 'const ok = a < b && a <= b && b > a && b >= a; const shift = (x << 1) >> 1;']),
    ['rust', 'let ok = a < b && a <= b && b > a && b >= a; let shift = (x << 1) >> 1;'],
    ['java', 'class A { boolean ok = a < b && a <= b && b > a && b >= a; int shift = (x << 1) >> 1; }'],
    ['swift', 'let ok = a < b && a <= b && b > a && b >= a\nlet shift = (x << 1) >> 1'],
    ['python', 'ok = a < b and a <= b and b > a and b >= a\nshift = (x << 1) >> 1'],
    ['go', 'package main\nvar ok = a < b && a <= b && b > a && b >= a\nvar shift = (x << 1) >> 1'],
    ['kotlin', 'val ok = a < b && a <= b && b > a && b >= a'],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [samples, role, style] of [[types, 'auxiliary', 0], [operators, 'execution', 2]]) {
      for (const [lang, code] of samples) {
        const tokens = highlighter.codeToTokens(code, { lang, theme: `cinderfolio-${mode}` }).tokens.flat();
        for (const match of code.matchAll(/[<>]/g)) {
          const token = tokens.find(t => t.offset <= match.index && t.offset + t.content.length > match.index);
          assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${match.index}`);
          assert.equal(token.fontStyle, style, `${mode}.${lang}.${match.index}`);
        }
      }
    }
  }
});

test('Python 保留注释斜体与数据粗体，插值边界加粗，格式和字面量保持常规', () => {
  const code = 'MAX_COUNT = 10\n# explanation\n@dataclass\nclass Vector:\n    def describe(self, value: float) -> str:\n        """A docstring."""\n        return f"result: {round(value) + 1:.3f}\\n" if value is not None else True';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['MAX_COUNT', 'execution', 2], ['#', 'comment', 1], ['explanation', 'comment', 1],
      ['dataclass', 'execution', 2], ['class Vector', 'navigation', 2], ['def', 'navigation', 2], ['Vector', 'execution', 2], ['describe', 'execution', 2], ['value: float', 'execution', 2],
      ['"""', 'comment', 1], ['A docstring.', 'comment', 1], ['result:', 'content', 0], ['{round', 'execution', 2],
      ['round', 'execution', 2], ['value) +', 'execution', 2], ['+', 'execution', 2], ['\\n', 'auxiliary', 0], [':.3f', 'auxiliary', 0],
      ['float', 'auxiliary', 0], ['None', 'content', 0], ['True', 'content', 0],
    ]) {
      const token = tokenAt(code, 'python', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('JS/TS 绑定声明使用辅助信息，函数与控制流保留导航色，括号和插值边界统一加粗', () => {
  const code = '// explanation\nconst items = [1, 2];\nfunction sum(values) {\n  let total = 0;\n  for (const value of values) { if (!value) continue; total += value; }\n  return total;\n}\nconst result = sum(items);\nconst label = `sum: ${result}`;\nitems[0];';
  const typed = 'interface Task { readonly id: number; }\nfunction pending(items: Task[]): Task[] { return items; }\ntype Value = Task | string;';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const lang of ['javascript', 'typescript']) {
      for (const [text, role, style] of [
        ['const', 'auxiliary', 0], ['function', 'navigation', 2], ['let', 'auxiliary', 0], ['of values', 'navigation', 2],
        ['for', 'navigation', 2], ['if', 'navigation', 2], ['return', 'navigation', 2],
        ['sum', 'execution', 2], ['values', 'execution', 2], ['items =', 'execution', 2], ['result =', 'execution', 2],
        ['!', 'execution', 2], ['+=', 'execution', 2], ['1,', 'content', 0], ['sum: ', 'content', 0],
        ['[1', 'execution', 2], ['];', 'execution', 2], ['[0', 'execution', 2],
        ['(items)', 'execution', 2], [');', 'execution', 2], ['${', 'execution', 2],
      ]) {
        const token = tokenAt(code, lang, mode, text);
        assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${text}`);
        assert.equal(token.fontStyle, style, `${mode}.${lang}.${text}`);
      }
    }
    for (const [text, role, style] of [
      ['interface', 'navigation', 2], ['readonly', 'auxiliary', 0], ['Task', 'auxiliary', 0], ['number', 'auxiliary', 0],
      [': Task', 'auxiliary', 0], ['[]', 'auxiliary', 0], [']', 'auxiliary', 0],
      ['type Value', 'navigation', 2], ['Value', 'auxiliary', 0], ['|', 'auxiliary', 0], ['string', 'auxiliary', 0],
    ]) {
      const token = tokenAt(typed, 'typescript', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('修饰符与绑定声明使用类型层级，声明与异步流程保持导航色', () => {
  const samples = [
    ['cpp', 'class Item { public: static constexpr int size = 1; virtual int read() const noexcept { return size; } };',
      ['public', 'static', 'constexpr', 'virtual', 'const noexcept', 'noexcept'], ['class', 'return']],
    ...['javascript', 'typescript', 'jsx', 'tsx'].map(lang => [lang,
      'export async function read() { const value = await load(); let count = 1; var total = 2; return value; }',
      ['const', 'let', 'var'], ['export', 'async', 'function', 'await', 'return']]),
    ['typescript', 'export abstract class Task { private static readonly limit: number = 1; public async run() { return await load(); } }',
      ['abstract', 'private', 'static', 'readonly', 'public'], ['export', 'class', 'async', 'return', 'await']],
    ['java', 'public final class Tasks { private static final int COUNT = 1; public synchronized void run() { var count = 0; } }',
      ['public', 'final', 'private', 'static', 'synchronized', 'var'], ['class']],
    ['rust', 'pub const SIZE: usize = 1;\npub async fn run() { let mut value = 1; let result = load().await; }\nstruct Task {}\ntype Count = usize;',
      ['pub', 'const', 'let', 'mut'], ['async', 'fn', 'await', 'struct', 'type']],
    ['go', 'package main\nvar count = 1\nconst limit = 2\nfunc run() { go load(); defer close(); if count > limit { return } }',
      ['var', 'const'], ['func', 'go load', 'defer', 'if', 'return']],
    ['kotlin', 'private const val SIZE = 1\nclass Task { public fun run(): Int { return SIZE } }',
      ['private', 'const', 'public'], ['class', 'fun', 'return']],
    ['swift', 'public final class Task { private let value = 1; public func run() async -> Int { let result = await load(); return result } }',
      ['public', 'final', 'private', 'let'], ['class', 'func', 'async', 'await', 'return']],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [lang, code, modifiers, navigation] of samples) {
      for (const [texts, role, style] of [[modifiers, 'auxiliary', 0], [navigation, 'navigation', 2]]) {
        for (const text of texts) {
          const token = tokenAt(code, lang, mode, text);
          assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${text}`);
          assert.equal(token.fontStyle, style, `${mode}.${lang}.${text}`);
        }
      }
    }
  }
});

test('通用类名、继承类与库类名使用阅读主体，普通类型标记使用辅助信息', () => {
  const samples = [
    ['cpp', 'class Vec {}; Vec copy(const Vec& value);', [['Vec {}', 'execution'], ['Vec copy', 'auxiliary']]],
    ['python', 'class Task(Base):\n    pass', [['Task', 'execution'], ['Base', 'execution']]],
    ...['javascript', 'typescript', 'jsx', 'tsx'].map(lang => [lang,
      'class Task extends Base { copy() { return new Task(); } }\nPromise.resolve(1);',
      [['Task', 'execution'], ['Base', 'execution'], ['Promise', 'execution']],
    ]),
    ['typescript', 'class Task {}\nconst value: Task = new Task();', [['Task {}', 'execution'], ['Task =', 'auxiliary']]],
    ['java', 'class Task extends Base { Task copy() { return new Task(); } }', [['Task extends', 'execution'], ['Base', 'execution'], ['Task copy', 'auxiliary']]],
    ['ruby', 'class Task < Base\n  def copy\n    Task.new\n  end\nend', [['Task <', 'execution'], ['Base', 'execution'], ['Task.new', 'execution']]],
    ['kotlin', 'class Task { fun copy(): Task = Task() }', [['Task {', 'execution'], ['Task =', 'auxiliary']]],
    ['swift', 'class Task: Base { func copy() -> Task { return Task() } }', [['Task:', 'execution'], ['Base', 'execution']]],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [lang, code, checks] of samples) for (const [text, role] of checks) {
      const token = tokenAt(code, lang, mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${text}`);
      assert.equal(token.fontStyle, role === 'execution' ? 2 : 0, `${mode}.${lang}.${text}`);
    }
  }
});

test('Rust、Go 与 Java 的声明词和类型名保持不同的阅读层级', () => {
  const samples = [
    ['rust', 'struct Task { done: bool }\nfn main() {}', [['struct', 'navigation', 2], ['Task', 'auxiliary', 0], ['fn', 'navigation', 2], [':', 'structure', 0]]],
    ['go', 'type Task struct { Done bool }\nfunc main() {}', [['type', 'navigation', 2], ['struct', 'navigation', 2], ['Task', 'auxiliary', 0], ['bool', 'auxiliary', 0]]],
    ['java', 'public class Tasks { record Task(String title) {} void run() { var count = 0; } }', [['class', 'navigation', 2], ['record', 'navigation', 2], ['var', 'auxiliary', 0], ['public', 'auxiliary', 0], ['String', 'auxiliary', 0]]],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [lang, code, checks] of samples) for (const [text, role, style] of checks) {
      const token = tokenAt(code, lang, mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${lang}.${text}`);
    }
  }
});

test('JSON/CSS/SCSS 的键、选择器和属性名使用阅读主体，属性值与单位保持正文', () => {
  const samples = [
    ['json', '{"enabled": true, "count": 2}', [['enabled', 'execution', 2], ['true', 'content', 0], ['2', 'content', 0], [':', 'structure', 0]]],
    ['css', '.card { display: grid; padding: 1rem; }', [['display', 'execution', 2], ['grid', 'content', 0], ['1', 'content', 0], ['rem', 'content', 0], [':', 'structure', 0]]],
    ['css', 'button.card:hover { display: grid; }', [['button', 'execution', 2], ['card', 'execution', 2], ['hover', 'execution', 2], ['grid', 'content', 0]]],
    ['scss', '$sizes: (compact: 0.5rem);\n.card { &__title { color: red; } &--#{$name} { width: 1px; } }', [
      ['compact', 'execution', 2], ['&__title', 'execution', 2], ['__title', 'execution', 2],
      ['--#{$name}', 'execution', 2], ['red', 'content', 0], ['1px', 'content', 0],
    ]],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [lang, code, checks] of samples) for (const [text, role, style] of checks) {
      const token = tokenAt(code, lang, mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${lang}.${text}`);
    }
  }
});

test('Markdown 排版边界弱化，标题、正文强调与嵌入代码保留层次', () => {
  const code = '# Title\n\nBody **strong** and *emphasis*.\n\n> Quote\n\n[Link](https://example.com) and `code()`.\n\n![Image](preview.png) and [Reference][ref].\n\n[ref]: https://example.com\n\n~~~python\nif items:\n    print(items[0])\n~~~\n\n| Head |\n| --- |\n| Cell |';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['#', 'structure', 0], ['Title', 'execution', 2], ['Body', 'content', 0],
      ['strong', 'execution', 2], ['emphasis', 'comment', 1], ['**', 'structure', 0],
      ['Quote', 'content', 0], ['>', 'structure', 0], ['Link', 'content', 0],
      ['https:', 'structure', 0], ['code()', 'content', 0], ['|', 'structure', 0], ['Cell', 'content', 0],
      ['[Link', 'structure', 0], ['](https', 'structure', 0], ['(https', 'structure', 0],
      ['![Image', 'structure', 0], ['Image', 'content', 0], ['(preview', 'structure', 0],
      ['[ref].', 'structure', 0], ['].\n\n[ref]', 'structure', 0], ['ref]', 'structure', 0], ['~~~', 'structure', 0], ['if items', 'navigation', 2],
      ['print', 'execution', 2], ['(items', 'execution', 2], ['[0]', 'execution', 2], ['])', 'execution', 2],
    ]) {
      const token = tokenAt(code, 'markdown', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('HTML 标签使用常规端点色，静态属性弱化，正文、实体与注释保留各自职责', () => {
  const code = '<!-- explanation -->\n<article class="card" aria-label="Example"><h1>Title &amp; text</h1></article>';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['<!--', 'comment', 1], ['explanation', 'comment', 1], ['<article', 'auxiliary', 0],
      ['article', 'content', 0], ['h1', 'content', 0], ['class', 'auxiliary', 0], ['aria-label', 'auxiliary', 0],
      ['card', 'content', 0], ['Example', 'content', 0], ['Title', 'content', 0],
      ['&amp;', 'auxiliary', 0], ['amp;', 'auxiliary', 0], ['; text', 'auxiliary', 0],
    ]) {
      const token = tokenAt(code, 'html', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('TeX 公式与宏保留强调，LaTeX 排版及引用降为辅助信息，标题使用端点粗体', () => {
  const tex = '% explanation\nValue $\\alpha x_i^2$ with \\custom{data}.';
  const latex = String.raw`\documentclass[11pt]{article}
\usepackage{amsmath}
\newcommand{\vect}[1]{\mathbf{#1}}
\begin{document}
\section{Result}
% explanation
Value $\alpha x_i^2$ and $f(s)$.
\begin{equation}
  s = \sum_{i=1}^{n} x_i
  \label{eq:result}
\end{equation}
\textbf{Strong} and \emph{Emphasis}; see \eqref{eq:result}.
\end{document}`;
  const samples = [
    ['tex', tex, [
      ['%', 'comment', 1], ['explanation', 'comment', 1], ['Value', 'content', 0],
      ['\\alpha', 'execution', 2], ['alpha', 'execution', 2], ['x_i', 'content', 0],
      ['_', 'execution', 2], ['^', 'execution', 2], ['2', 'content', 0], ['$', 'structure', 0],
      ['\\custom', 'execution', 2], ['custom', 'execution', 2],
    ]],
    ['latex', latex, [
      ['\\documentclass', 'auxiliary', 0], ['documentclass', 'auxiliary', 0],
      ['\\newcommand', 'navigation', 2], ['newcommand', 'navigation', 2],
      ['\\vect', 'execution', 2], ['vect', 'execution', 2],
      ['\\begin', 'auxiliary', 0], ['begin', 'auxiliary', 0], ['\\end', 'auxiliary', 0],
      ['\\section', 'auxiliary', 0], ['section', 'auxiliary', 0], ['Result', 'execution', 2],
      ['%', 'comment', 1], ['Value', 'content', 0], ['x_i', 'content', 0], ['2$', 'content', 0],
      ['\\alpha', 'execution', 2], ['alpha', 'execution', 2], ['\\sum', 'execution', 2],
      ['_', 'execution', 2], ['^', 'execution', 2], ['$', 'structure', 0], ['{Result', 'structure', 0],
      ['[11pt', 'structure', 0], [']{article', 'structure', 0], ['{article', 'structure', 0],
      ['article', 'auxiliary', 0], ['amsmath', 'auxiliary', 0], ['document}', 'auxiliary', 0], ['equation}', 'auxiliary', 0],
      ['{\\vect', 'structure', 0], ['}[1]', 'structure', 0],
      ['[1]', 'structure', 0], [']{\\mathbf', 'structure', 0], ['{i=1', 'structure', 0], ['}^{n', 'structure', 0],
      ['(s)', 'content', 0], [')$', 'content', 0],
      ['Strong', 'execution', 2], ['Emphasis', 'comment', 1],
      ['\\textbf', 'auxiliary', 0], ['textbf', 'auxiliary', 0], ['{Strong', 'structure', 0],
      ['\\emph', 'auxiliary', 0], ['emph', 'auxiliary', 0], ['{Emphasis', 'structure', 0],
      ['\\label', 'auxiliary', 0], ['\\eqref', 'auxiliary', 0], ['eq:result', 'structure', 0],
    ]],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [lang, code, checks] of samples) for (const [text, role, style] of checks) {
      const token = tokenAt(code, lang, mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${lang}.${text}`);
    }
  }
});

test('模板语言以流程指令导航，组件属性与数据加粗，标签及静态正文使用常规字重', () => {
  const samples = [
    ['vue', `<script setup lang="ts">const ready = true;</script>
<template>
<ul v-if="pending.length">
  <li v-for="task in pending" :key="task.id">
    <button @click="complete(task)" class="action">{{ task.title }}</button>
  </li>
</ul>
<p v-else-if="loading">读取中</p><p v-else>完成</p>
</template>`, [
      ['setup', 'auxiliary', 0], ['lang=', 'auxiliary', 0],
      ['ul ', 'content', 0], ['button ', 'content', 0], ['v-if', 'navigation', 2],
      ['v-for', 'navigation', 2], ['v-else-if', 'navigation', 2], ['v-else>', 'navigation', 2],
      ['pending.length', 'execution', 2], ['task in', 'execution', 2], ['in pending', 'execution', 2],
      ['@click', 'execution', 2], ['click', 'execution', 2], ['complete', 'execution', 2],
      // 原生 HTML 回退未细分插值正文，保持常规端点色；属性中的表达式整体强调。
      ['task.title', 'content', 0], ['{{', 'content', 0], [':key', 'execution', 2],
      ['key=', 'execution', 2], ['class=', 'auxiliary', 0], ['"pending', 'structure', 0], ['完成', 'content', 0],
    ]],
    ['svelte', `<section>
{#if pending.length}
  {#each pending as task}
    <button class="action" class:done={task.done} onclick={() => complete(task)} disabled>{task.title} Done</button>
  {/each}
{:else}Empty{/if}
</section>
<input aria-label="Title" bind:value={title} on:input={update} />`, [
      ['section', 'content', 0], ['button', 'content', 0], ['if pending', 'navigation', 2],
      ['each pending', 'navigation', 2], ['else', 'navigation', 2], ['pending.length', 'execution', 2],
      ['task}', 'execution', 2], ['class=', 'execution', 2], ['class:done', 'execution', 2], ['done=', 'execution', 2],
      ['onclick', 'execution', 2], ['disabled', 'execution', 2], ['aria-label', 'execution', 2],
      ['bind:value', 'execution', 2], ['value=', 'execution', 2], ['on:input', 'execution', 2], [':input', 'execution', 2], ['input=', 'execution', 2],
      ['complete', 'execution', 2], ['task.title', 'execution', 2], ['Done', 'content', 0], ['Empty', 'content', 0],
    ]],
    ...['jsx', 'tsx'].map(lang => [lang,
      'const view = <Panel className="tasks" aria-label="Tasks" onClick={() => complete(task)} disabled>{pending.length ? task.title : "Empty"} Done</Panel>;', [
        ['const', 'auxiliary', 0], ['Panel', 'content', 0], ['className', 'execution', 2], ['onClick', 'execution', 2],
        ['aria-label', 'execution', 2], ['disabled', 'execution', 2],
        ['complete', 'execution', 2], ['pending.length', 'execution', 2], ['task.title', 'execution', 2],
        ['?', 'navigation', 2], [': "Empty', 'navigation', 2], ['Empty', 'content', 0], ['Done', 'content', 0],
      ]]),
    ...['twig', 'liquid'].map(lang => [lang,
      '{% if tasks %}{% for task in tasks %}<li>{{ task.title }}</li>{% endfor %}{% endif %}', [
        ['if tasks', 'navigation', 2], ['for task', 'navigation', 2], ['endfor', 'navigation', 2],
        ['tasks', 'execution', 2], ['task.title', 'execution', 2], ['title', 'execution', 2], ['li', 'content', 0],
      ]]),
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [lang, code, checks] of samples) for (const [text, role, style] of checks) {
      const token = tokenAt(code, lang, mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${lang}.${text}`);
    }
  }
});

test('独立 JSON 配合原生 Vue 保留阅读层级，懒加载其他语言后效果一致', async () => {
  const themes = ['light', 'dark'].map(mode => JSON.parse(JSON.stringify(createShikiTheme(seeds, mode))));
  const h = await createHighlighter({ langs: ['vue'], themes });
  try {
    const code = `<script setup lang="ts">const ready = true;</script>
<template>
  <ul v-if="ready" class="tasks" title="Task list" data-id="list">
    <li v-for="task in pending" :key="task.id">
      <button @click.stop="complete(task)" v-bind:disabled="task.done">{{ task.title }}</button>
    </li>
  </ul>
  <p v-else-if="loading">读取中</p><p v-else>完成</p>
  <input v-model="query" custom-prop="label" />
  <Panel :active="ready" @change="update" />
</template>
<style scoped>.tasks { display: grid; }</style>`;
    for (const extra of [null, 'jsx', 'tsx', 'markdown']) {
      if (extra) await h.loadLanguage(extra);
      for (const mode of ['light', 'dark']) {
        const palette = createShikiPalette(seeds, mode);
        const tokens = h.codeToTokens(code, { lang: 'vue', theme: `cinderfolio-${mode}` }).tokens.flat();
        for (const [text, role, style] of [
          ['v-if', 'navigation', 2], ['v-for', 'navigation', 2],
          ['v-else-if', 'navigation', 2], ['v-else>', 'navigation', 2],
          ['task in pending', 'execution', 2], [':key', 'execution', 2], ['task.id', 'execution', 2],
          ['@click.stop', 'execution', 2], ['complete(task)', 'execution', 2],
          ['v-bind:disabled', 'execution', 2], ['task.done', 'execution', 2],
          ['v-model', 'execution', 2], ['query', 'execution', 2],
          ['custom-prop', 'execution', 2], ['label', 'execution', 2],
          ['active=', 'execution', 2], ['@change', 'execution', 2], ['update', 'execution', 2],
          ['ul ', 'content', 0], ['Panel ', 'content', 0],
          ['{{ task.title }}', 'content', 0], ['完成', 'content', 0],
          ['class=', 'auxiliary', 0], ['title=', 'auxiliary', 0], ['data-id=', 'auxiliary', 0],
          ['Task list', 'content', 0], ['setup', 'auxiliary', 0], ['lang=', 'auxiliary', 0],
          ['scoped', 'auxiliary', 0], ['const', 'auxiliary', 0], ['true', 'content', 0],
          ['"ready', 'structure', 0], ['="ready', 'structure', 0], ['<ul', 'auxiliary', 0],
        ]) {
          const index = code.indexOf(text);
          assert.ok(index >= 0, text);
          const token = tokens.find(t => t.offset <= index && t.offset + t.content.length > index);
          const label = `${mode}.${extra ?? 'vue-only'}.${text}`;
          assert.equal(token.color.toLowerCase(), palette[role].color, label);
          assert.equal(token.fontStyle, style, label);
        }
      }
    }
  } finally {
    h.dispose();
  }
});

test('纯结构、排版与数据片段不强行分配品牌色，嵌入代码仍按职责着色', () => {
  const samples = [
    ['html', '<article class="card"><h1>Title</h1><p>Text</p></article>'],
    ['xml', '<?xml version="1.0"?><tasks count="2"><task>Title</task></tasks>'],
    ['markdown', '# Title\n\nBody **strong** and *emphasis*.'],
    ['latex', String.raw`\documentclass{article}\begin{document}\section{Title}
\begin{align}x &= y \\ z &= 2\end{align}
\begin{itemize}\item Text\end{itemize}\end{document}`],
    ['json', '{"enabled": true, "tasks": [1, 2]}'],
    ['yaml', 'enabled: true\ntasks: [1, 2]\nscript: |\n  echo done\nnotes: >\n  More text'],
    ['toml', '[theme]\nenabled = true\ntasks = [1, 2]'],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [lang, code] of samples) {
      const tokens = highlighter.codeToTokens(code, { lang, theme: `cinderfolio-${mode}` }).tokens.flat();
      assert.ok(tokens.every(token => token.color.toLowerCase() !== palette.navigation.color), `${mode}.${lang}`);
    }
    const code = '<button onclick="if (ready) complete(task)">Done</button>';
    for (const [text, role, style] of [['onclick', 'execution', 2], ['if', 'navigation', 2], ['complete', 'execution', 2], ['Done', 'content', 0]]) {
      const token = tokenAt(code, 'html', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('Bash 选项、分支模式和执行连接使用阅读主体，普通参数值与无法区分的标记保持原层级', () => {
  const code = [
    'set -euo pipefail',
    'curl --retry 3 "$url"',
    'build && deploy || report',
    'worker &',
    'case "$file" in',
    '  *.json|*.yaml) convert "$file" ;;',
    'esac',
    'report() {',
    '  local path="$1"',
    '  if [[ ! -f "$path" ]]; then return 1; fi',
    '}',
    'count=$((count + 1))',
    'root="${1:-cinderfolio/dist}"',
    'printf done >&2',
    '# explanation',
  ].join('\n');
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['set', 'execution', 2], ['-euo', 'execution', 2], ['euo', 'execution', 2],
      ['--retry', 'execution', 2], ['retry', 'execution', 2], ['3', 'content', 0], ['pipefail', 'content', 0],
      ['&&', 'execution', 2], ['||', 'execution', 2], ['&\n', 'execution', 2],
      ['case', 'navigation', 2], ['.json', 'execution', 2], ['|*.yaml', 'execution', 2],
      ['.yaml', 'execution', 2], [';;', 'execution', 2], ['esac', 'navigation', 2],
      ['local', 'auxiliary', 0], ['$1', 'execution', 2], ['if', 'navigation', 2],
      ['-f', 'execution', 2], ['return', 'navigation', 2], ['1; fi', 'content', 0], ['; fi', 'structure', 0],
      ['>&2', 'execution', 2], ['done', 'content', 0], ['# explanation', 'comment', 1],
      // 当前语法把算术展开中的 + 当普通参数，把默认路径当变量；不按字符重新分类。
      ['+ 1', 'content', 0], ['cinderfolio/dist', 'execution', 2],
    ]) {
      const token = tokenAt(code, 'bash', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('PowerShell 声明使用导航色，数据构造使用阅读主体，常量前缀随数据正文', () => {
  const code = `function Convert-Task {
  param([string]$Name)
  $map = @{ Name = $Name; Enabled = $true; Missing = $null }
  $items = @($Name, "other", $false)
  $first = $items[0]
  Get-ChildItem -Filter "*.json" -ErrorAction Stop |
    ForEach-Object { $_.Name.ToUpper() }
  if ($Name -and $first -ne "skip") { return $map }
  # explanation
}
filter Select-Ready { $_ }
Get-Item a && Write-Output b || Write-Warning c`;
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['function', 'navigation', 2], ['filter', 'navigation', 2], ['param', 'navigation', 2],
      ['Convert-Task', 'execution', 2], ['Select-Ready', 'execution', 2], ['string', 'auxiliary', 0],
      ['@{', 'execution', 2], ['@(', 'execution', 2], ['$Name', 'execution', 2],
      ['$true', 'content', 0], ['true', 'content', 0], ['$false', 'content', 0],
      ['false', 'content', 0], ['$null', 'content', 0], ['null', 'content', 0], ['other', 'content', 0],
      ['Get-ChildItem', 'execution', 2], ['ForEach-Object', 'execution', 2], ['Stop', 'execution', 2],
      ['|\n', 'execution', 2], ['$_', 'execution', 2], ['.Name', 'execution', 2], ['ToUpper', 'execution', 2],
      ['if', 'navigation', 2], ['-and', 'execution', 2], ['-ne', 'execution', 2], ['return', 'navigation', 2],
      ['# explanation', 'comment', 1],
      // && / || 与普通分号共用标记，类型方括号和下标也无法仅靠主题区分。
      ['&&', 'structure', 0], ['||', 'structure', 0], ['; Enabled', 'structure', 0],
    ]) {
      const token = tokenAt(code, 'powershell', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
    checkBrackets(code, 'powershell', mode, [['[string]', 2], ['$items[0]', 2]]);
  }
});

test('SQL 标识符使用阅读主体，AS 降为辅助信息，查询步骤与无法区分的关键字保留导航色', () => {
  const code = `WITH projects(id, name) AS (VALUES (1, 'Cinderfolio'))
-- explanation
SELECT p.name, p.id, COUNT(*) AS pending, [title], @limit
FROM projects AS p
WHERE p.id > 0 AND p.done = FALSE
ORDER BY pending DESC;
CREATE TABLE tasks (id INTEGER, title TEXT);`;
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['WITH', 'navigation', 2], ['SELECT', 'navigation', 2], ['FROM', 'navigation', 2],
      ['WHERE', 'navigation', 2], ['ORDER BY', 'navigation', 2], ['DESC', 'navigation', 2],
      ['p.name', 'execution', 2], ['name,', 'execution', 2], ['id, COUNT', 'execution', 2],
      ['COUNT', 'execution', 2], ['pending', 'execution', 2], ['[title]', 'execution', 2],
      ['title]', 'execution', 2], ['@limit', 'execution', 2], ['>', 'execution', 2],
      ['AS', 'auxiliary', 0], ['INTEGER', 'auxiliary', 0], ['TEXT', 'auxiliary', 0],
      ['Cinderfolio', 'content', 0], ['1,', 'content', 0], ['--', 'comment', 1],
      // 当前语法把普通名称 name 也标为 keyword.other.sql，不按文字猜测并覆盖。
      ['name)', 'navigation', 2],
    ]) {
      const token = tokenAt(code, 'sql', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('CMake 平台变量使用阅读主体，参数标签弱化，原始文本常规，共用命令标记保持原样', () => {
  const code = `cmake_minimum_required(VERSION 3.20)
option(WARNINGS "Enable warnings" ON)
# explanation
if(MSVC)
  target_compile_options(app PRIVATE /W4)
else()
  target_include_directories(app PUBLIC \${ROOT}/include)
endif()
message([[literal \${NAME}]])`;
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['cmake_minimum_required', 'navigation', 2], ['option', 'navigation', 2], ['ON)', 'navigation', 2],
      ['if(', 'navigation', 2], ['else', 'navigation', 2], ['endif', 'navigation', 2],
      ['target_compile_options', 'navigation', 2], ['MSVC', 'execution', 2], ['app', 'execution', 2],
      ['${ROOT}', 'execution', 2], ['VERSION', 'auxiliary', 0], ['PRIVATE', 'auxiliary', 0],
      ['PUBLIC', 'auxiliary', 0], ['Enable warnings', 'content', 0],
      ['[[literal', 'content', 0], ['literal', 'content', 0], ['${NAME}', 'content', 0],
      ['# explanation', 'comment', 1],
    ]) {
      const token = tokenAt(code, 'cmake', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('Dockerfile 由指令提供导航，未细分参数与 Shell 内容使用常规端点色', () => {
  const code = `ARG NODE_VERSION=22
FROM node:\${NODE_VERSION}-alpine AS build
# explanation
RUN echo "$NODE_VERSION" && test -d /app
COPY --from=build /export/ /app/
EXPOSE 80
CMD ["node", "server.js"]`;
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['ARG', 'navigation', 2], ['FROM', 'navigation', 2], ['AS', 'navigation', 2],
      ['RUN', 'navigation', 2], ['COPY', 'navigation', 2], ['CMD', 'navigation', 2],
      ['NODE_VERSION=22', 'content', 0], ['node:', 'content', 0], ['${NODE_VERSION}', 'content', 0],
      ['build', 'content', 0], ['echo', 'content', 0], ['$NODE_VERSION', 'content', 0],
      ['&&', 'content', 0], ['test', 'content', 0], ['--from=build', 'content', 0],
      ['/export/', 'content', 0], ['80', 'content', 0], ['server.js', 'content', 0],
      ['# explanation', 'comment', 1],
    ]) {
      const token = tokenAt(code, 'dockerfile', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('Make 强调构建关系、条件与配方，普通赋值取值使用常规端点色', () => {
  const code = `CXX ?= c++
CXXFLAGS := -O2
OBJECTS := $(patsubst %.cpp,%.o,$(SOURCES))
ifeq ($(DEBUG),1)
CXXFLAGS += -g
endif
.PHONY: all clean
all: $(TARGET)
# explanation
%.o: %.cpp
\t$(CXX) $(CXXFLAGS) -c $< -o $@
$(TARGET): $(OBJECTS)
\t$(CXX) $(OBJECTS) -o $@
clean:
\t$(RM) $(TARGET) $(OBJECTS)`;
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['CXX', 'execution', 2], ['?=', 'execution', 2], [':=', 'execution', 2], ['+=', 'execution', 2],
      ['c++', 'content', 0], ['-O2', 'content', 0], ['-g', 'content', 0],
      ['ifeq', 'navigation', 2], ['endif', 'navigation', 2], ['DEBUG', 'execution', 2],
      ['patsubst', 'execution', 2], ['%.cpp', 'execution', 2], ['%.o:', 'execution', 2],
      ['.PHONY', 'execution', 2], ['all:', 'execution', 2], [': $(TARGET)', 'execution', 2],
      ['$(CXX)', 'execution', 2], ['-c', 'execution', 2], ['$<', 'execution', 2], ['$@', 'execution', 2],
      ['$(TARGET):', 'execution', 2], ['$(OBJECTS)', 'execution', 2], ['clean:', 'execution', 2],
      ['# explanation', 'comment', 1], [',%.o', 'structure', 0],
    ]) {
      const token = tokenAt(code, 'make', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('正则的字符、修饰符、分组与转义统一使用阅读主体，完整注释使用端点斜体', () => {
  const comment = '(?# 配置项与数值)';
  const code = String.raw`(?mx)
^(?P<key>[A-Z_]\w*)[ \t]*=(?P<value>\d{1,3}|\u0041+)\#?$
${comment}
(?P=key)(?=end)(?!skip)(?<=start)(?<!stop)`;
  const start = code.indexOf(comment), end = start + comment.length;
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    const tokens = highlighter.codeToTokens(code, { lang: 'regexp', theme: `cinderfolio-${mode}` }).tokens.flat();
    for (const token of tokens) {
      assert.equal(token.color.toLowerCase(), palette.execution.color, `${mode}.${token.content}`);
      for (let index = 0; index < token.content.length; index++) {
        if (/\s/.test(token.content[index])) continue;
        const offset = token.offset + index;
        assert.equal(token.fontStyle, offset >= start && offset < end ? 1 : 2, `${mode}.${offset}.${token.content}`);
      }
    }
  }
});

test('TS 类型箭头、可选属性与 satisfies 使用辅助信息，运行时箭头和可选链保持原层级', () => {
  const code = 'type Handler = (id: number) => void;\ninterface Task { done?: boolean }\nconst id = task?.id;\nconst task = value satisfies Task;\nconst result = items.map(x => x + 1);';
  for (const mode of ['light', 'dark']) for (const lang of ['typescript', 'tsx']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['=> void', 'auxiliary', 0], ['?: boolean', 'auxiliary', 0], ['satisfies', 'auxiliary', 0],
      ['?.id', 'execution', 2], ['=> x', 'navigation', 2], ['type Handler', 'navigation', 2],
    ]) {
      const token = tokenAt(code, lang, mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${lang}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${lang}.${text}`);
    }
  }
});

test('C++ 声明属性使用辅助信息，lambda 捕获和下标保持阅读主体', () => {
  const code = '[[nodiscard]] int read() { return 1; }\nconst auto run = [&data](int i) { return data[i]; };';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['[[', 'auxiliary', 0], ['nodiscard', 'auxiliary', 0], [']]', 'auxiliary', 0],
      ['[&data]', 'execution', 2], ['[i]', 'execution', 2], ['read()', 'execution', 2],
      ['return', 'navigation', 2],
    ]) {
      const token = tokenAt(code, 'cpp', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('Rust 结果和选项变体使用阅读主体，类型保持辅助信息，字符引号保持结构细节', () => {
  const code = 'fn choose(x: Option<i32>) -> Result<i32, String> {\n  match x { Some(n) => Ok(n), None => Err("missing".into()) }\n}\nlet comma = \',\';';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['Some', 'execution', 2], ['None', 'execution', 2], ['Ok', 'execution', 2], ['Err', 'execution', 2],
      ['Option', 'auxiliary', 0], ['Result', 'auxiliary', 0], ['String', 'auxiliary', 0],
      ["',", 'structure', 0], ["';", 'structure', 0], [",';", 'content', 0], ['match', 'navigation', 2],
    ]) {
      const token = tokenAt(code, 'rust', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('C 的结构体、回调、预处理与指针访问复用通用规则，未细分的类型名不猜测语义', () => {
  const code = '#define LIMIT 2\ntypedef struct { const char *title; int done; } Task;\ntypedef int (*Predicate)(const Task *);\nint visit(const Task tasks[], Predicate accept) {\n  for (int i = 0; i < LIMIT; ++i) {\n    const Task *task = &tasks[i];\n    if (!accept(task)) continue;\n    puts(task->title);\n  }\n  return 0;\n}';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['#define', 'navigation', 2], ['typedef', 'navigation', 2], ['struct', 'navigation', 2],
      ['for', 'navigation', 2], ['if', 'navigation', 2], ['continue', 'navigation', 2],
      ['const', 'auxiliary', 0], ['char', 'auxiliary', 0], ['Task;', 'execution', 2],
      ['accept(task)', 'execution', 2], ['->title', 'execution', 2], ['[i]', 'execution', 2],
      ['0;', 'content', 0],
    ]) {
      const token = tokenAt(code, 'c', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('C# 类型与修饰符使用辅助信息，record 和执行箭头提供导航，括号使用阅读主体', () => {
  const code = 'record Item(string Title, bool Done);\nclass Program {\n  static async Task<Item[]> Load() {\n    var items = await Read();\n    return items.Where(item => !item.Done).ToArray();\n  }\n  static string Describe(Item item) => item switch {\n    { Done: true } => "done", _ => $"{item.Title}"\n  };\n}';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['record', 'navigation', 2], ['class', 'navigation', 2], ['async', 'navigation', 2],
      ['await', 'navigation', 2], ['=> !item', 'navigation', 2], ['=> item switch', 'navigation', 2], ['switch', 'navigation', 2],
      ['string', 'auxiliary', 0], ['bool', 'auxiliary', 0], ['Task<', 'auxiliary', 0], ['static', 'auxiliary', 0], ['var', 'auxiliary', 0],
      ['Item(string', 'execution', 2], ['Title,', 'execution', 2], ['{\n  static', 'execution', 2], ['[]', 'execution', 2],
      ['true', 'content', 0], ['"done', 'structure', 0], ['done"', 'content', 0],
    ]) {
      const token = tokenAt(code, 'csharp', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('Lua local 使用辅助信息，函数与分支保持导航，表和回调保持阅读主体', () => {
  const code = 'local function pending(tasks)\n  local result = {}\n  -- Keep unfinished tasks.\n  for _, task in ipairs(tasks) do\n    if not task.done then table.insert(result, task) end\n  end\n  return result\nend\nlocal ok, value = pcall(pending, {{done = false}})';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['local function', 'auxiliary', 0], ['local result', 'auxiliary', 0],
      ['function', 'navigation', 2], ['for', 'navigation', 2], ['if', 'navigation', 2], ['then', 'navigation', 2], ['end\n', 'navigation', 2],
      ['pending(tasks)', 'execution', 2], ['ipairs', 'execution', 2], ['table.insert', 'execution', 2], ['pcall', 'execution', 2],
      ['false', 'content', 0], ['-- Keep', 'comment', 1],
    ]) {
      const token = tokenAt(code, 'lua', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('纯文本不增加语法分类，Mermaid 别名使用同一主题，Diff 保留增删标记与字形', () => {
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    const plain = highlighter.codeToTokens('输入 V → 输出 R', { lang: 'text', theme: `cinderfolio-${mode}` });
    assert.equal(plain.fg.toLowerCase(), palette.execution.color);
    assert.equal(tokenAt('flowchart LR\n A --> B', 'mmd', mode, 'flowchart').color.toLowerCase(), palette.navigation.color);
    const code = '--- a/a.py\n+++ b/a.py\n@@ -1,2 +1,2 @@\n unchanged(value[0])\n-old\n+new';
    for (const [text, role, style] of [['---', 'auxiliary', 0], ['@@', 'auxiliary', 0], ['unchanged', 'content', 0], ['(value', 'content', 0], ['-old', 'deleted', 8], ['+new', 'execution', 2]]) {
      const token = tokenAt(code, 'diff', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});
