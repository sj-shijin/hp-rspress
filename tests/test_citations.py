"""在独立临时书目中验证实际 Pandoc 转换，不读取正式知识库。"""
from pathlib import Path
import re
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from export_knowledge import render_citations


class CitationTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='pkw-citations-'))
        self.bib = self.root / 'references.bib'
        self.bib.write_text('''
@article{example,
  author = {Author, Alice and Researcher, Bob},
  title = {{A Complete Reference Title}},
  year = {2025},
  url = {https://example.com/paper.pdf},
  doi = {10.1000/example},
  note = {PDF 页码说明。}
}
@misc{unused,
  title = {UNREFERENCED_BIB_SENTINEL}
}
@misc{other,
  author = {Author, Alice and Researcher, Bob},
  title = {{Another Complete Title}},
  year = {2024},
  url = {https://example.com/other.pdf}
}
''')

    def tearDown(self):
        shutil.rmtree(self.root)

    def test_repeated_reference_is_listed_once_and_locators_stay_in_body(self):
        source = ('因此，**用 $y$ 缩短指定向量 $x$**的条件见 [@example, p. 2]。\n\n'
                  '$$\na_1 = b_2\n\\text{[@math-literal]}\n$$\n\n'
                  '```mermaid\nflowchart LR\n A --> B\n```\n\n'
                  '```markdown\n[@not-a-citation]\n$x$\n```\n\n'
                  '`[@inline-code]` 与 $[@inline-math]$ 保持原样。\n\n'
                  '另一处来源见 [@example, pp. 3–4]。\n')
        original_bib = self.bib.read_bytes()
        converted = render_citations(source, self.bib, 'example-note')
        body, notes = converted.split('\n\n## 参考文献', 1)
        self.assertEqual(body, source.replace('[@example, p. 2]',
                         r'\[[1, p. 2](#ref-example-note-example)\]')
                         .replace('[@example, pp. 3–4]',
                         r'\[[1, pp. 3–4](#ref-example-note-example)\]').rstrip())
        self.assertEqual(notes.count('Alice Author'), 1)
        self.assertEqual(notes.count('Bob Researcher'), 1)
        self.assertEqual(notes.count('A Complete Reference Title'), 1)
        self.assertIn('[DOI](https://doi.org/10.1000/example)', notes)
        self.assertNotIn('https://example.com/paper.pdf', notes)
        self.assertNotIn('PDF 页码说明。', converted)
        self.assertNotIn('Footnotes', converted)
        self.assertNotIn('UNREFERENCED_BIB_SENTINEL', converted)
        self.assertEqual(self.bib.read_bytes(), original_bib)

    def test_multiple_papers_share_numbers_and_keep_individual_locators(self):
        converted = render_citations(
            '首次 [@example, p. 2]。多篇 [@other, sec. 1; @example, pp. 3–4]。',
            self.bib, 'cluster')
        body, notes = converted.split('\n\n## 参考文献', 1)
        self.assertIn('[1, p. 2](#ref-cluster-example)', body)
        self.assertIn('[2, sec. 1](#ref-cluster-other); [1, pp. 3–4](#ref-cluster-example)', body)
        self.assertEqual(notes.count('A Complete Reference Title'), 1)
        self.assertEqual(notes.count('Another Complete Title'), 1)
        self.assertIn('[原文](https://example.com/other.pdf)', notes)
        self.assertNotIn('sec. 1', notes)

    def test_each_note_uses_independent_reference_ids(self):
        ids = []
        for slug in ['first-note', 'second-note']:
            converted = render_citations('来源 [@example]。', self.bib, slug)
            ids.append(re.findall(r'id="(ref-[^"]+)"', converted)[0])
            self.assertIn(f'](#{ids[-1]})', converted)
        self.assertEqual(len(set(ids)), 2)

    def test_unknown_keys_and_invalid_locators_report_the_source_problem(self):
        for citation, error in [
            ('[@missing]', '文献引用转换失败'),
            ('[@example, p. 1; p. 2]', '分号仅分隔不同文献'),
        ]:
            with self.subTest(citation=citation), self.assertRaisesRegex(ValueError, error):
                render_citations(citation, self.bib, 'invalid-note')


if __name__ == '__main__':
    unittest.main()
