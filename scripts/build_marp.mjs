/** CLI 只生成 HTML，不启动浏览器、不下载 Chromium。 */
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { marpCli } from '@marp-team/marp-cli';
import { marpThemeStorageKey } from '../cinderfolio/marp.mjs';
import { installMarpThemeSync } from './marp_theme_sync.mjs';

const source = fileURLToPath(new URL('../cinderfolio/examples/marp.md', import.meta.url));
const theme = fileURLToPath(new URL('../cinderfolio/dist/cf-marp.css', import.meta.url));
const config = fileURLToPath(new URL('./marp.config.mjs', import.meta.url));
const directory = new URL('../cinderfolio/dist/marp/', import.meta.url);
const output = fileURLToPath(new URL('example.html', directory));
await fs.mkdir(directory, { recursive: true });
// 字体与示例一起发布，HTML 使用相对路径，独立打开或整体搬移时仍可加载。
await fs.cp(new URL('../cinderfolio/fonts/marp/', import.meta.url), new URL('fonts/', directory), { recursive: true });
const status = await marpCli([source, '--theme-set', theme, '--config-file', config, '--output', output]);
if (status !== 0) throw new Error(`Marp HTML 生成失败：${status}`);

// 在独立 HTML 中执行，不把脚本塞入 React / MDX；保留官方 Bespoke 播放器。
const sync = `<script>(${installMarpThemeSync.toString()})(${JSON.stringify(marpThemeStorageKey)});</script>`;
const html = await fs.readFile(output, 'utf8');
await fs.writeFile(output, html
  .replace('</head>', '<link rel="stylesheet" href="./fonts/font.css"></head>')
  .replace('</body>', `${sync}</body>`));
console.log('Cinderfolio-Marp：已生成示例，包含 Pele 图表、Shiki 高亮与同源主题同步。');
