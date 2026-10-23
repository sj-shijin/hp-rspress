import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createHighlighter } from 'shiki';
import { seeds } from '../cinderfolio/palette.mjs';
import { themeVariables } from '../cinderfolio/css.mjs';
import { shikiRoles, shikiRoleGroups, createShikiPalette, createShikiTheme } from '../cinderfolio/shiki.mjs';

let highlighter;
before(async () => {
  highlighter = await createHighlighter({
    langs: ['c', 'cpp', 'python', 'javascript', 'typescript', 'rust', 'go', 'java', 'bash', 'json', 'css', 'markdown', 'html', 'tex', 'latex', 'ruby', 'kotlin', 'swift', 'lua', 'yaml', 'toml', 'mermaid', 'diff'],
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
      assert.equal(token.color.toLowerCase(), expected[index] === 2 ? palette.execution.color : palette.structure.color, label);
    }
  }
}

test('实时变量主题与独立 HEX 主题取色一致，六个阅读层级与底色、Diff 删除样式完整覆盖', async () => {
  const keys = ['background', 'deleted', ...shikiRoleGroups.flatMap(([, keys]) => keys)];
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

test('C++ 命名空间与类型同层，函数和成员保持粗体，字面量使用常规端点色', () => {
  const code = '#include <span>\n#define SCALE 2\n// explanation\nnamespace app {}\nnamespace math = app;\nusing namespace std;\nstruct Vector {};\ntemplate <std::floating_point T>\nT dot(T value) { const T result = value * 2.0f; std::cout << "result" << result; return result; }';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['#include', 'navigation', 2], ['#define', 'navigation', 2], ['<span', 'structure', 0], ['>', 'structure', 0], ['span', 'content', 0], ['SCALE', 'execution', 2],
      ['//', 'comment', 1], ['explanation', 'comment', 1], ['struct', 'navigation', 2],
      ['app {}', 'structure', 0], ['math =', 'structure', 0], ['app;', 'structure', 0], ['std;', 'structure', 0],
      ['std::floating_point', 'structure', 0], ['std::cout', 'structure', 0], ['cout', 'execution', 2],
      ['Vector', 'structure', 0], ['template', 'navigation', 2], ['floating_point', 'structure', 0], ['const', 'structure', 0],
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
      ['[[nodiscard]]', 2], ['run(int values[3])', 2], ['[&values](int i)', 2],
      ['obj.method(values[0])', 2], ['consume((value + 1))', 2], ['if (ready) { work(); }', 2],
    ]],
    ['python', 'def run(items: list[int]):\n    result = call((x + y), items[0])\n    return items[fn(0)]', [
      ['run(items: list[int])', 2], ['call((x + y), items[0])', 2], ['items[fn(0)]', 2],
    ]],
    ['java', 'class A { void run(int[] values) { obj.method(values[0]); consume((value + 1)); } }', [
      ['run(int[] values)', 2], ['obj.method(values[0])', 2], ['consume((value + 1))', 2],
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

test('通用括号规则覆盖数组、类型、属性与其他常用语言', () => {
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
      ['run(values: number[])', 2], ['[number, number]', 2],
    ]],
    ['rust', '#[derive(Debug)]\nfn run(values: &[i32]) { let list = [1, 2]; let value = values[0]; call((x + y)); }', [
      ['#[derive(Debug)]', 2], ['run(values: &[i32])', 2], ['[1, 2]', 2], ['values[0]', 2], ['call((x + y))', 2],
    ]],
    ['go', 'package main\nfunc run(values []int) { list := []int{1, 2}; value := values[0]; fn((value + 1)) }', [
      ['run(values []int)', 2], ['[]int{1, 2}', 2], ['values[0]', 2], ['fn((value + 1))', 2],
    ]],
    ['java', 'class A { void run() { int[] values = new int[]{1, 2}; int value = values[0]; } }', [
      ['int[] values', 2], ['new int[]{1, 2}', 2], ['values[0]', 2], ['run()', 2],
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
      ['run(_ values: [Int])', 2], ['{ values.reduce(0) { $0 + $1 } }', 2], ['run([1, 2])', 2],
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
    ['go', 'package main\nvar name string = "literal () [] {}"', [['string', 'structure', 0], ['literal ()', 'content', 0]]],
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

test('模板和泛型尖括号使用类型灰阶，比较与移位运算符保留端点粗体', () => {
  const types = [
    ['cpp', '#include <vector>\ntemplate <typename T>\nusing Grid = std::vector<std::vector<T>>;'],
    ['typescript', 'function first<T>(items: Array<T>): T { return items[0]; }'],
    ['rust', 'struct Box<T> { items: Vec<Vec<T>> }'],
    ['java', 'class Box<T> { List<List<T>> items; }'],
    ['swift', 'struct Box<T> { var items: Array<Array<T>> }'],
    ['html', '<article><span>Title</span></article>'],
  ];
  const operators = [
    ['cpp', 'bool compare(int a, int b) { return a < b && a <= b && b > a && b >= a; }\nint shift(int x) { return (x << 1) >> 1; }'],
    ...['javascript', 'typescript'].map(lang => [lang, 'const ok = a < b && a <= b && b > a && b >= a; const shift = (x << 1) >> 1;']),
    ['rust', 'let ok = a < b && a <= b && b > a && b >= a; let shift = (x << 1) >> 1;'],
    ['java', 'class A { boolean ok = a < b && a <= b && b > a && b >= a; int shift = (x << 1) >> 1; }'],
    ['swift', 'let ok = a < b && a <= b && b > a && b >= a\nlet shift = (x << 1) >> 1'],
    ['python', 'ok = a < b and a <= b and b > a and b >= a\nshift = (x << 1) >> 1'],
    ['go', 'package main\nvar ok = a < b && a <= b && b > a && b >= a\nvar shift = (x << 1) >> 1'],
    ['kotlin', 'val ok = a < b && a <= b && b > a && b >= a'],
  ];
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [samples, role, style] of [[types, 'structure', 0], [operators, 'execution', 2]]) {
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
      ['dataclass', 'execution', 2], ['class Vector', 'navigation', 2], ['def', 'navigation', 2], ['Vector', 'structure', 0], ['describe', 'execution', 2], ['value: float', 'execution', 2],
      ['"""', 'comment', 1], ['A docstring.', 'comment', 1], ['result:', 'content', 0], ['{round', 'execution', 2],
      ['round', 'execution', 2], ['value) +', 'execution', 2], ['+', 'execution', 2], ['\\n', 'auxiliary', 0], [':.3f', 'auxiliary', 0],
      ['float', 'structure', 0], ['None', 'content', 0], ['True', 'content', 0],
    ]) {
      const token = tokenAt(code, 'python', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('JS/TS 声明词着品牌色，圆方括号和插值边界统一加粗', () => {
  const code = '// explanation\nconst items = [1, 2];\nfunction sum(values) {\n  let total = 0;\n  for (const value of values) { if (!value) continue; total += value; }\n  return total;\n}\nconst result = sum(items);\nconst label = `sum: ${result}`;\nitems[0];';
  const typed = 'interface Task { readonly id: number; }\nfunction pending(items: Task[]): Task[] { return items; }';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const lang of ['javascript', 'typescript']) {
      for (const [text, role, style] of [
        ['const', 'navigation', 2], ['function', 'navigation', 2], ['let', 'navigation', 2], ['of values', 'navigation', 2],
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
      ['interface', 'navigation', 2], ['readonly', 'structure', 0], ['Task', 'structure', 0], ['number', 'structure', 0],
      [': Task', 'structure', 0], ['[]', 'execution', 2], [']', 'execution', 2],
    ]) {
      const token = tokenAt(typed, 'typescript', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('Rust、Go 与 Java 的声明词和类型名保持不同的阅读层级', () => {
  const samples = [
    ['rust', 'struct Task { done: bool }\nfn main() {}', [['struct', 'navigation', 2], ['Task', 'structure', 0], ['fn', 'navigation', 2], [':', 'structure', 0]]],
    ['go', 'type Task struct { Done bool }\nfunc main() {}', [['type', 'navigation', 2], ['struct', 'navigation', 2], ['Task', 'structure', 0], ['bool', 'structure', 0]]],
    ['java', 'public class Tasks { record Task(String title) {} void run() { var count = 0; } }', [['class', 'navigation', 2], ['record', 'navigation', 2], ['var', 'navigation', 2], ['public', 'structure', 0], ['String', 'structure', 0]]],
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

test('JSON/CSS 属性名按成员加粗，属性值与单位使用端点色常规字重', () => {
  const samples = [
    ['json', '{"enabled": true, "count": 2}', [['enabled', 'execution', 2], ['true', 'content', 0], ['2', 'content', 0], [':', 'structure', 0]]],
    ['css', '.card { display: grid; padding: 1rem; }', [['display', 'execution', 2], ['grid', 'content', 0], ['1', 'content', 0], ['rem', 'content', 0], [':', 'structure', 0]]],
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

test('Markdown 保留标题导航、正文粗斜体、链接与结构标点的层次', () => {
  const code = '# Title\n\nBody **strong** and *emphasis*.\n\n> Quote\n\n[Link](https://example.com) and `code()`.\n\n| Head |\n| --- |\n| Cell |';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['#', 'navigation', 2], ['Title', 'navigation', 2], ['Body', 'content', 0],
      ['strong', 'execution', 2], ['emphasis', 'comment', 1], ['**', 'structure', 0],
      ['Quote', 'content', 0], ['>', 'structure', 0], ['Link', 'content', 0],
      ['https:', 'structure', 0], ['code()', 'content', 0], ['|', 'structure', 0], ['Cell', 'content', 0],
    ]) {
      const token = tokenAt(code, 'markdown', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('HTML 用标签导航结构，属性加粗，正文、实体与注释保留各自职责', () => {
  const code = '<!-- explanation -->\n<article class="card" aria-label="Example"><h1>Title &amp; text</h1></article>';
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    for (const [text, role, style] of [
      ['<!--', 'comment', 1], ['explanation', 'comment', 1], ['<article', 'structure', 0],
      ['article', 'navigation', 2], ['h1', 'navigation', 2], ['class', 'execution', 2], ['aria-label', 'execution', 2],
      ['card', 'content', 0], ['Example', 'content', 0], ['Title', 'content', 0],
      ['&amp;', 'auxiliary', 0], ['amp;', 'auxiliary', 0], ['; text', 'auxiliary', 0],
    ]) {
      const token = tokenAt(code, 'html', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});

test('TeX 命令连同反斜杠强调，LaTeX 保留结构、粗斜体、公式与引用层次', () => {
  const tex = '% explanation\nValue $\\alpha x_i^2$ with \\custom{data}.';
  const latex = String.raw`\documentclass{article}
\newcommand{\vect}[1]{\mathbf{#1}}
\begin{document}
\section{Result}
% explanation
Value $\alpha x_i^2$.
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
      ['\\documentclass', 'navigation', 2], ['documentclass', 'navigation', 2],
      ['\\newcommand', 'navigation', 2], ['newcommand', 'navigation', 2],
      ['\\vect', 'execution', 2], ['vect', 'execution', 2],
      ['\\begin', 'navigation', 2], ['begin', 'navigation', 2], ['\\end', 'navigation', 2],
      ['\\section', 'navigation', 2], ['section', 'navigation', 2], ['Result', 'navigation', 2],
      ['%', 'comment', 1], ['Value', 'content', 0], ['x_i', 'content', 0], ['2$', 'content', 0],
      ['\\alpha', 'execution', 2], ['alpha', 'execution', 2], ['\\sum', 'execution', 2],
      ['_', 'execution', 2], ['^', 'execution', 2], ['$', 'structure', 0], ['{Result', 'execution', 2],
      ['Strong', 'execution', 2], ['Emphasis', 'comment', 1],
      ['\\label', 'navigation', 2], ['\\eqref', 'navigation', 2], ['eq:result', 'structure', 0],
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

test('纯文本不增加语法分类，Mermaid 别名使用同一主题，Diff 保留增删标记与字形', () => {
  for (const mode of ['light', 'dark']) {
    const palette = createShikiPalette(seeds, mode);
    const plain = highlighter.codeToTokens('输入 V → 输出 R', { lang: 'text', theme: `cinderfolio-${mode}` });
    assert.equal(plain.fg.toLowerCase(), palette.execution.color);
    assert.equal(tokenAt('flowchart LR\n A --> B', 'mmd', mode, 'flowchart').color.toLowerCase(), palette.navigation.color);
    const code = '--- a/a.py\n+++ b/a.py\n@@ -1 +1 @@\n-old\n+new';
    for (const [text, role, style] of [['---', 'auxiliary', 0], ['@@', 'auxiliary', 0], ['-old', 'deleted', 8], ['+new', 'execution', 2]]) {
      const token = tokenAt(code, 'diff', mode, text);
      assert.equal(token.color.toLowerCase(), palette[role].color, `${mode}.${text}`);
      assert.equal(token.fontStyle, style, `${mode}.${text}`);
    }
  }
});
