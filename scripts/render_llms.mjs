/** 通过 Rspress 原生回调编排索引；分组、摘要与顺序均来自公开内容索引。 */
export function renderLlmsTxt(context, index) {
  const { title, description, base, siteOrigin, sections } = context;
  const prefix = base === '/' ? '' : base.replace(/\/$/, '');
  // 原生 page.link 已处理 base 与正式域名，按路径匹配即可兼容两种构建。
  const aliases = new Set(index.notes.flatMap(note => note.aliases || [])
    .map(url => `${prefix}${url}index.md`));
  const pages = sections.flatMap(section => section.pages)
    .filter(page => !aliases.has(new URL(page.link, 'https://rspress.local').pathname));
  const byPath = new Map(pages.map(page => [
    new URL(page.link, 'https://rspress.local').pathname, page,
  ]));
  const used = new Set();
  const indexPath = `${prefix}/knowledge/index.json`;
  const indexLink = siteOrigin ? new URL(indexPath, siteOrigin).href : indexPath;
  const lines = [
    `# ${title}`, '', `> ${description}`, '',
    '先读领域概览或项目介绍，再按需读取单篇 Markdown。', '',
    // JSON 是关联数据资源；使用明文地址，避免文档发现器将其当成文章页。
    `关联数据（JSON 辅助资源，非文档页面）：${indexLink}`, '',
  ];

  function entry(url, summary) {
    const page = byPath.get(`${prefix}${url}index.md`);
    if (!page) throw new Error(`公开内容缺少对应的 SSG-MD 页面：${url}`);
    used.add(page.link);
    const text = summary || page.description;
    lines.push(`- [${page.title}](${page.link})${text ? `: ${text}` : ''}`);
  }

  function notes(items) {
    const groups = new Map();
    for (const note of items) {
      const label = [note.group, note.chapter].filter(Boolean).join(' · ') || '笔记';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(note);
    }
    for (const [label, items] of groups) {
      lines.push('', `### ${label}`, '');
      for (const note of items) entry(note.url, note.description);
    }
  }

  lines.push('## 内容导航', '');
  entry('/knowledge/', '按领域查阅基础知识、研究增量与阅读路线。');
  if (index.categories.some(category => category.section === 'projects')) {
    entry('/projects/', '项目的设计、实现与实践记录。');
  }
  for (const category of index.categories) {
    lines.push('', `## ${category.title}`, '');
    entry(category.url, category.description);
    notes(index.notes.filter(note => note.category === category.id && note.url !== category.url));
  }
  const uncategorized = index.notes.filter(note => !note.category);
  if (uncategorized.length) {
    lines.push('', '## 其他笔记');
    notes(uncategorized);
  }

  // 保留未来新增的网站独立页面；知识笔记不会重复出现在此分组。
  const remaining = pages.filter(page => !used.has(page.link));
  if (remaining.length) {
    lines.push('', '## 其他页面', '');
    for (const page of remaining) {
      lines.push(`- [${page.title}](${page.link})${page.description ? `: ${page.description}` : ''}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
