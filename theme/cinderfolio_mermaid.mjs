/** Mermaid 的配置是全局状态，初始化和绘图必须放在同一串行任务中。 */
let sequence = 0;

export function createMermaidRenderer(load = () => import('mermaid')) {
  let queue = Promise.resolve();
  let loading;
  return (source, config, isCurrent = () => true, container) => {
    const result = queue.then(async () => {
      if (!isCurrent()) return;
      const { default: mermaid } = await (loading ??= load());
      if (!isCurrent()) return;
      mermaid.initialize({ ...config, startOnLoad: false, suppressErrorRendering: true });
      // 甘特图等根据父容器宽度排版，不能在 body 上按整窗宽度绘制。
      return mermaid.render(`cf-mermaid-${++sequence}`, source, container);
    });
    // 一个图失败不阻断后续图表；错误由调用者呈现。
    queue = result.catch(() => {});
    return result;
  };
}

export const renderMermaid = createMermaidRenderer();
