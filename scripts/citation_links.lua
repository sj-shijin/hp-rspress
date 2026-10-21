-- 仅处理 Pandoc 生成的引用片段与书目，不接触笔记正文、公式或代码。
function Pandoc(doc)
  local slug = pandoc.utils.stringify(doc.meta['reference-slug'])
  for _, block in ipairs(doc.blocks) do
    if block.t == 'Para' and (#block.content ~= 1 or block.content[1].t ~= 'Cite') then
      error('引用应使用 [@文献键, 定位]，分号仅分隔不同文献')
    end
  end
  return doc:walk({
    Link = function(link)
      if link.target:match('^#ref%-') then
        link.target = '#ref-' .. slug .. '-' .. link.target:sub(6)
      elseif link.target:match('^https?://') then
        link.content = {pandoc.Str(link.target:match('^https?://doi.org/') and 'DOI' or '原文')}
      end
      return link
    end,
    Div = function(div)
      if div.identifier == 'refs' then
        div.identifier = 'refs-' .. slug
      elseif div.identifier:match('^ref%-') then
        div.identifier = 'ref-' .. slug .. '-' .. div.identifier:sub(5)
      end
      return div
    end,
  })
end
