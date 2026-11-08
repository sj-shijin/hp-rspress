import type { SidebarData } from '@rspress/core';
import { useActiveMatcher, useSidebar } from '@rspress/core/runtime';
import { SidebarList } from '@rspress/core/theme-original';
import { useLayoutEffect, useState } from 'react';

type Item = SidebarData[number];

function restoreSidebar(source: SidebarData, previous: SidebarData, isActive: (link: string) => boolean) {
  const collapsed = new Map<string, boolean | undefined>();
  const remember = (items: SidebarData, parents: string[] = []) => {
    for (const item of items) {
      if ('items' in item) {
        const path = [...parents, item.text];
        collapsed.set(JSON.stringify(path), item.collapsed);
        remember(item.items, path);
      }
    }
  };
  remember(previous);

  const containsActive = (item: Item): boolean => {
    if ('link' in item && item.link && isActive(item.link)) return true;
    return 'items' in item && item.items.some(containsActive);
  };
  const restore = (items: SidebarData, parents: string[] = []): SidebarData => items.map(item => {
    if (!('items' in item)) return item;
    const path = [...parents, item.text];
    return {
      ...item,
      items: restore(item.items, path),
      collapsed: containsActive(item) ? false : collapsed.get(JSON.stringify(path)) ?? item.collapsed,
    };
  });
  return restore(source);
}

export function Sidebar() {
  const source = useSidebar();
  const isActive = useActiveMatcher();
  const [sidebar, setSidebar] = useState(() => restoreSidebar(source, [], isActive));

  // 文章各有一份侧栏配置；切页时按分组层级保留折叠状态，并展开当前文章的父级。
  useLayoutEffect(() => {
    setSidebar(previous => restoreSidebar(source, previous, isActive));
  }, [source, isActive]);

  return <SidebarList sidebarData={sidebar} setSidebarData={setSidebar} />;
}
