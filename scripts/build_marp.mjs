/** 网站集成：准备下载资源，并在独立 Marp HTML 中接入同源调色同步。 */
import fs from 'node:fs/promises';
import { buildMarpExample } from 'cinderfolio/marp-build';
import { installMarpThemeSync, marpThemeStorageKey } from './marp_theme_sync.mjs';

const directory = new URL('../.generated/cinderfolio/', import.meta.url);
const themes = new URL('./', import.meta.resolve('cinderfolio/themes/cf-marp.css'));
await fs.rm(directory, { recursive: true, force: true });
await fs.cp(themes, directory, { recursive: true });

const slides = new URL('marp/', directory);
await buildMarpExample(slides);
// 脚本只进入本站 HTML，Cinderfolio 的独立产物不依赖本地存储或网站组件。
const sync = `<script>(${installMarpThemeSync.toString()})(${JSON.stringify(marpThemeStorageKey)});</script>`;
for (const filename of ['example.html', 'example-4-3.html']) {
  const target = new URL(filename, slides);
  const html = await fs.readFile(target, 'utf8');
  await fs.writeFile(target, html.replace('</body>', `${sync}</body>`));
}
console.log('Cinderfolio-Marp：网站资源已生成，包含 16:9 / 4:3 示例和同源主题同步。');
