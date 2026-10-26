import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSlideDecks } from '../scripts/build_slides.mjs';
import { marpThemeStorageKey } from '../scripts/marp_theme_sync.mjs';

test('登记文稿构建两种比例与素材，撤销登记后清理旧产物并保留源文件', async t => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'site-slides-build-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const entry = {
    source: 'slides/example/index.md', title: '临时演示', size: '16:9',
    src: '/slides/example/index.html',
    sources: { '16:9': '/slides/example/index.html', '4:3': '/slides/example/index-4-3.html' },
  };
  const input = path.join(root, entry.source);
  const assets = path.join(path.dirname(input), 'assets');
  await fs.mkdir(assets, { recursive: true });
  const image = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><rect width="80" height="40"/></svg>';
  await fs.writeFile(path.join(assets, '图 1.svg'), image);
  const source = '---\nmarp: true\ntitle: 临时演示\nsize: 16:9\nsizes: [16:9, 4:3]\n---\n\n# 演示\n\n![素材](<./assets/图 1.svg>)\n\n---\n\n## 第二页\n';
  await fs.writeFile(input, source);
  const hidden = path.join(root, 'slides/unpublished/index.md');
  await fs.mkdir(path.dirname(hidden));
  await fs.writeFile(hidden, '未登记的草稿');
  const output = path.join(root, 'built');
  const fontDirectory = path.dirname(fileURLToPath(import.meta.resolve('cinderfolio/fonts/marp/font.css')));
  const options = { root, output, fontDirectory };

  // 真实构建两页小文稿，不重复构建正式演示或整个网站。
  await buildSlideDecks([entry], options);
  assert.deepEqual(await fs.readdir(output), ['example']);
  const published = path.join(output, 'example');
  assert.deepEqual((await fs.readdir(published)).sort(), ['assets', 'index-4-3.html', 'index.html']);
  for (const [filename, width] of [['index.html', 1280], ['index-4-3.html', 960]]) {
    const target = path.join(published, filename);
    const html = await fs.readFile(target, 'utf8');
    assert.ok(html.includes(`viewBox="0 0 ${width} 720"`), filename);
    assert.match(html, /第二页/);
    assert.equal(html.split(marpThemeStorageKey).length - 1, 1, '每个比例只注入一次网站同步脚本');
    const imageUrl = html.match(/<img[^>]*src="([^"]+)"/)[1];
    assert.equal(await fs.readFile(new URL(imageUrl, pathToFileURL(target)), 'utf8'), image);
    const fontUrl = html.match(/url\(["']?([^"'\s)]*InterVariable\.woff2)/)[1];
    assert.ok((await fs.stat(new URL(fontUrl, pathToFileURL(target)))).isFile());
  }

  await buildSlideDecks([], options);
  assert.deepEqual(await fs.readdir(output), []);
  assert.equal(await fs.readFile(input, 'utf8'), source);
  assert.equal(await fs.readFile(path.join(assets, '图 1.svg'), 'utf8'), image);
  assert.equal(await fs.readFile(hidden, 'utf8'), '未登记的草稿');
});
