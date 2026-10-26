/** 网站集成：准备下载资源，并在独立 Marp HTML 中接入同源调色同步。 */
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { buildMarpExample } from 'cinderfolio/marp-build';
import { pseudocodeMathCss } from 'cinderfolio/pseudocode-render';
import { installMarpThemeSync, marpThemeStorageKey } from './marp_theme_sync.mjs';

const directory = new URL('../.generated/cinderfolio/', import.meta.url);
const themes = new URL('./', import.meta.resolve('cinderfolio/themes/cf-marp.css'));
await fs.rm(directory, { recursive: true, force: true });
await fs.mkdir(directory, { recursive: true });
// 网站字体独立缓存、按需加载；独立 Marp 仍内嵌字体，便于离线使用。
const mathjaxRequire = createRequire(import.meta.resolve('cinderfolio/pseudocode-render'));
const mathjaxPackage = pathToFileURL(mathjaxRequire.resolve('mathjax-full/package.json'));
await fs.cp(new URL('es5/output/chtml/fonts/woff-v2/', mathjaxPackage), new URL('mathjax-fonts/', directory), { recursive: true });
await fs.cp(new URL('./', import.meta.resolve('cinderfolio/fonts/mathjax-text/OFL.txt')), new URL('mathjax-fonts/text/', directory), { recursive: true });
await fs.writeFile(new URL('cf-pseudocode-mathjax.css', directory), pseudocodeMathCss('mathjax', { fontURL: './mathjax-fonts' }));
// dist/ 也可保留演示产物，只复制网站需要的主题文件。
for (const file of await fs.readdir(themes, { withFileTypes: true })) {
  if (file.isFile() && (file.name === 'LICENSE' || /\.(css|json)$/.test(file.name))) {
    await fs.copyFile(new URL(file.name, themes), new URL(file.name, directory));
  }
}

const slides = new URL('marp/', directory);
const fonts = new URL('cinderfolio/fonts/', slides);
await fs.mkdir(fonts, { recursive: true });
// 网站发布才需要打包资源；普通文稿的 CLI 构建不复制素材。
await fs.cp(new URL('./', import.meta.resolve('cinderfolio/fonts/marp/font.css')), fonts, { recursive: true });
await fs.cp(new URL('./assets/', import.meta.resolve('cinderfolio/examples/marp.md')), new URL('assets/', slides), { recursive: true });
await fs.copyFile(new URL('LICENSE', themes), new URL('cinderfolio/LICENSE', slides));
await buildMarpExample(slides, { fontDirectory: fonts });
// 脚本只进入本站 HTML，Cinderfolio 的独立产物不依赖本地存储或网站组件。
const sync = `<script>(${installMarpThemeSync.toString()})(${JSON.stringify(marpThemeStorageKey)});</script>`;
for (const filename of ['example.html', 'example-4-3.html']) {
  const target = new URL(filename, slides);
  const html = await fs.readFile(target, 'utf8');
  await fs.writeFile(target, html.replace('</body>', `${sync}</body>`));
}
console.log('Cinderfolio-Marp：网站资源已生成，包含 16:9 / 4:3 示例和同源主题同步。');
