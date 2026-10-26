/** 网站只构建导出阶段登记的文稿；每份文稿的 assets/ 随演示公开。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { buildMarp } from 'cinderfolio/marp-build';
import { installMarpThemeSync, marpThemeStorageKey } from './marp_theme_sync.mjs';

export async function syncMarpHtml(target) {
  const sync = `<script>(${installMarpThemeSync.toString()})(${JSON.stringify(marpThemeStorageKey)});</script>`;
  const html = await fs.readFile(target, 'utf8');
  await fs.writeFile(target, html.replace('</body>', `${sync}</body>`));
}

export async function buildSlideDecks(entries, { root, output, fontDirectory }) {
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  for (const entry of entries) {
    const input = path.join(root, entry.source);
    const target = path.join(output, path.relative('/slides', entry.src));
    await fs.mkdir(path.dirname(target), { recursive: true });
    const assets = path.join(path.dirname(input), 'assets');
    try {
      await fs.cp(assets, path.join(path.dirname(target), 'assets'), { recursive: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const sources = entry.sources ?? { [entry.size]: entry.src };
    const source = await fs.readFile(input, 'utf8');
    const temporary = await fs.mkdtemp(path.join(tmpdir(), 'site-marp-sizes-'));
    try {
      for (const [size, src] of Object.entries(sources)) {
        const variant = path.join(output, path.relative('/slides', src));
        let variantInput = input;
        if (size !== entry.size) {
          // 和 Cinderfolio 的双比例样张一样，仅替换临时副本的全局 size。
          const end = source.indexOf('\n---\n', 4);
          const frontmatter = source.slice(0, end);
          const resized = /^size:/m.test(frontmatter)
            ? frontmatter.replace(/^size:.*$/m, `size: ${size}`)
            : `${frontmatter}\nsize: ${size}`;
          variantInput = path.join(temporary, 'index.md');
          await fs.writeFile(variantInput, resized + source.slice(end));
        }
        await buildMarp(variantInput, { output: variant, fontDirectory });
        await syncMarpHtml(variant);
      }
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
  }
}
