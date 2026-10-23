/** 仅用于网站示例 HTML；独立 cf-marp.css 不需要此脚本。 */
export function installMarpThemeSync(storageKey) {
  function apply(value) {
    if (!value) return;
    const { mode, variables } = JSON.parse(value);
    document.documentElement.style.colorScheme = mode;
    // 内联变量覆盖 Marpit 编译后的主题选择器，不改页码或重载播放器。
    for (const section of document.querySelectorAll('section')) {
      section.style.colorScheme = mode;
      for (const [key, color] of Object.entries(variables)) section.style.setProperty(key, color);
    }
  }

  window.addEventListener('storage', event => {
    if (event.key === storageKey) apply(event.newValue);
  });
  // 同源 iframe、演讲者窗口与下一页预览共用这份状态。
  try { apply(localStorage.getItem(storageKey)); } catch {
    // 存储不可用时，独立主题仍通过媒体查询跟随外层或系统亮暗。
  }
}
