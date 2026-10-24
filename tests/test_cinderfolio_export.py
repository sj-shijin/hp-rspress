"""将配色源复制到无 node_modules 的临时目录，验证它能独立导出。"""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class CinderfolioExportTests(unittest.TestCase):
    def test_export_without_rspress_or_pele_dependencies(self):
        root = Path(tempfile.mkdtemp(prefix='cinderfolio-export-'))
        try:
            source = Path(__file__).resolve().parents[1] / 'cinderfolio'
            for name in ['palette.mjs', 'oklch.mjs', 'pele.mjs', 'shiki.mjs', 'css.mjs', 'build.mjs', 'rspress.mjs', 'marp.mjs', 'license.mjs']:
                shutil.copyfile(source / name, root / name)
            command = ['node', str(root / 'build.mjs'), '--out-dir', str(root / 'exported')]
            subprocess.run(command, check=True, capture_output=True, text=True)
            output = root / 'exported'
            self.assertEqual({path.name for path in output.iterdir()},
                             {'LICENSE', 'colors.css', 'colors.json', 'cf-pele.css', 'cf-rspress.css', 'cf-marp.css',
                              'cf-shiki-light.json', 'cf-shiki-dark.json'})
            pele = (output / 'cf-pele.css').read_text()
            self.assertNotRegex(pele, r'@import|--rp-|rp-dark|sj-mermaid')
            self.assertIn('[data-cinderfolio="dark"]', pele)
            self.assertIn('--cf-background: #121212', pele)
            self.assertIn('--pele-border: #787877', pele)
            self.assertIn('--pele-border: #959593', pele)
            self.assertEqual(pele.count('--pele-series-1: #ffa475'), 2)
            self.assertEqual(pele.count('--pele-accent: #fa9148'), 2)
            self.assertIn('--pele-critical: #f97316', pele)
            self.assertIn('--pele-critical: #fcaf79', pele)
            self.assertNotIn('--cf-pele-fill-', pele)
            self.assertNotIn('--pele-', (output / 'cf-rspress.css').read_text())
            colors = json.loads((output / 'colors.json').read_text())
            self.assertEqual(colors['themes']['light']['selection'], '#fad8c0')
            self.assertEqual(colors['pele']['seriesRecipe']['space'], 'oklch')
            self.assertEqual(colors['pele']['roles']['critical']['accent']['light'], 'brand')
            self.assertEqual(colors['pele']['themes']['dark']['colors']['accent'], '#fa9148')
            self.assertIn('deuteranopia', colors['pele']['themes']['light']['vision']['after']['models'])
            for mode, foreground, background in [('light', '#121212', '#fafaf8'), ('dark', '#fafaf8', '#121212')]:
                content = (output / f'cf-shiki-{mode}.json').read_text()
                theme = json.loads(content)
                self.assertEqual(theme, colors['shiki']['themes'][mode])
                self.assertEqual(theme['type'], mode)
                self.assertEqual(theme['colors']['editor.foreground'], foreground)
                self.assertEqual(theme['colors']['editor.background'], background)
                self.assertNotIn('var(', content)
                self.assertEqual(len(theme['tokenColors']), 7)
            subprocess.run([*command, '--check'], check=True, capture_output=True, text=True)
        finally:
            shutil.rmtree(root)
