/** 构建独立排版样张；只生成 HTML，不启动浏览器或接入使用方的状态。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { marpCli } from '@marp-team/marp-cli';
import { createMarpCss } from '../marp.mjs';

export async function buildMarpExample(output = new URL('../dist/marp/', import.meta.url)) {
  const directory = output instanceof URL ? fileURLToPath(output) : path.resolve(output);
  const temporary = await fs.mkdtemp(path.join(tmpdir(), 'cinderfolio-marp-'));
  const source = await fs.readFile(new URL('../examples/marp.md', import.meta.url), 'utf8');
  const config = fileURLToPath(new URL('../marp-engine.mjs', import.meta.url));
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.cp(new URL('../fonts/marp/', import.meta.url), path.join(directory, 'fonts'), { recursive: true });
    await fs.cp(new URL('../examples/assets/', import.meta.url), path.join(directory, 'assets'), { recursive: true });
    await fs.copyFile(new URL('../LICENSE', import.meta.url), path.join(directory, 'LICENSE'));
    const theme = path.join(temporary, 'cf-marp.css');
    await fs.writeFile(theme, createMarpCss());
    for (const [size, filename] of [['16:9', 'example.html'], ['4:3', 'example-4-3.html']]) {
      const input = path.join(temporary, 'example.md');
      const target = path.join(directory, filename);
      await fs.writeFile(input, source.replace(/^size: 16:9$/m, `size: ${size}`));
      const status = await marpCli([input, '--theme-set', theme, '--config-file', config, '--output', target]);
      if (status !== 0) throw new Error(`Marp HTML 生成失败：${status}`);
      const html = await fs.readFile(target, 'utf8');
      await fs.writeFile(target, html.replace('</head>', '<link rel="stylesheet" href="./fonts/font.css"></head>'));
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { 'out-dir': { type: 'string' } } });
  await buildMarpExample(values['out-dir']);
  console.log('Cinderfolio-Marp：已生成独立的 16:9 与 4:3 排版样张。');
}
