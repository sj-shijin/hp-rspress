/** 返回同步清理函数，覆盖加载前离开、挂载中离开和正常卸载。 */
export function enhanceMermaid(container, source, load = () => import('pele/lazy'), options = {}) {
  let disposed = false;
  let diagram;
  const reportError = error => {
    if (disposed) return;
    if (options.onError) options.onError(error);
    else console.warn('[Mermaid] 自适应布局加载失败，预生成图表仍可使用。', error);
  };

  void load().then(async ({ mountAsync }) => {
    if (disposed) return;
    const mounted = await mountAsync(container, source, {
      autoDirection: true,
      directionBreakpoint: 640,
      // 不固定 maxWidth，让 Pele 自己监听容器的可用宽度。
      zoom: false,
      ...options,
      onError: reportError,
      onRender: result => { if (!disposed) options.onRender?.(result); },
    });
    if (disposed) mounted.destroy();
    else diagram = mounted;
  }).catch(reportError);

  return () => {
    disposed = true;
    diagram?.destroy();
  };
}
