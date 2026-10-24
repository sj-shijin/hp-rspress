import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { licenseText, licenseComment } from '../license.mjs';
import { createPeleCss } from '../css.mjs';
import { createRspressCss } from '../rspress.mjs';
import { createMarpCss } from '../marp.mjs';
import { createMermaidTheme } from '../mermaid.mjs';

test('无 node_modules 时仍可独立导出所有主题，分发产物带有 MIT 许可', async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'cinderfolio-export-'));
  try {
    const source = new URL('../', import.meta.url);
    for (const name of ['palette', 'oklch', 'pele', 'pele-svg', 'mermaid', 'shiki', 'css', 'build', 'rspress', 'marp', 'license']) {
      await fs.copyFile(new URL(`${name}.mjs`, source), path.join(root, `${name}.mjs`));
    }
    const output = path.join(root, 'exported');
    const command = [path.join(root, 'build.mjs'), '--out-dir', output];
    execFileSync(process.execPath, command);
    const read = name => fs.readFile(path.join(output, name), 'utf8');
    assert.deepEqual((await fs.readdir(output)).sort(), [
      'LICENSE', 'colors.css', 'colors.json', 'cf-pele.css', 'cf-rspress.css', 'cf-marp.css',
      'cf-shiki-light.json', 'cf-shiki-dark.json',
      'cf-mermaid-light.json', 'cf-mermaid-dark.json',
    ].sort());
    assert.equal(licenseText, await fs.readFile(new URL('LICENSE', source), 'utf8'));
    assert.equal(await read('LICENSE'), licenseText);
    for (const name of ['colors.css', 'cf-pele.css', 'cf-rspress.css', 'cf-marp.css']) {
      assert.ok((await read(name)).startsWith(licenseComment));
    }
    for (const [name, create] of [['cf-pele.css', createPeleCss], ['cf-rspress.css', createRspressCss], ['cf-marp.css', createMarpCss]]) {
      assert.equal(await read(name), create());
    }
    const pele = await read('cf-pele.css');
    assert.doesNotMatch(pele, /@import|--rp-|rp-dark|sj-mermaid/);
    assert.ok(pele.includes('[data-cinderfolio="dark"]'));
    for (const declaration of ['--cf-background: #121212', '--pele-border: #787877', '--pele-border: #959593',
      '--pele-critical: #f97316', '--pele-critical: #fcaf79']) assert.ok(pele.includes(declaration));
    assert.equal(pele.split('--pele-series-1: #cf9600').length - 1, 1);
    assert.equal(pele.split('--pele-series-1: #c08b00').length - 1, 1);
    assert.equal(pele.split('--pele-accent: #fa9148').length - 1, 2);
    assert.doesNotMatch(pele, /--cf-pele-fill-/);
    assert.doesNotMatch(await read('cf-rspress.css'), /--pele-/);
    const colors = JSON.parse(await read('colors.json'));
    for (const mode of ['light', 'dark']) {
      assert.deepEqual(JSON.parse(await read(`cf-mermaid-${mode}.json`)), createMermaidTheme(undefined, mode));
    }
    assert.equal(colors.themes.light.selection, '#fad8c0');
    assert.equal(colors.pele.seriesRecipe.space, 'oklch');
    assert.equal(colors.pele.roles.critical.accent.light, 'brand');
    assert.equal(colors.pele.themes.dark.colors.accent, '#fa9148');
    assert.ok(colors.pele.themes.light.vision.after.models.deuteranopia);
    for (const [mode, foreground, background] of [['light', '#121212', '#fafaf8'], ['dark', '#fafaf8', '#121212']]) {
      const content = await read(`cf-shiki-${mode}.json`);
      const theme = JSON.parse(content);
      assert.deepEqual(theme, colors.shiki.themes[mode]);
      assert.equal(theme.type, mode);
      assert.equal(theme.colors['editor.foreground'], foreground);
      assert.equal(theme.colors['editor.background'], background);
      assert.doesNotMatch(content, /var\(/);
      assert.equal(theme.tokenColors.length, 7);
    }
    execFileSync(process.execPath, [...command, '--check']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
