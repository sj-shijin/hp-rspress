/** 返回同步清理函数，覆盖加载前离开、挂载中离开和正常卸载。 */
export function enhanceMermaid(container, source, load = () => import('pele/lazy')) {
  let disposed = false;
  let diagram;

  void load().then(async ({ mountAsync }) => {
    if (disposed) return;
    const mounted = await mountAsync(container, source, {
      autoDirection: true,
      directionBreakpoint: 640,
      // 不固定 maxWidth，让 Pele 自己监听容器的可用宽度。
      zoom: false,
    });
    if (disposed) mounted.destroy();
    else diagram = mounted;
  }).catch(error => {
    if (!disposed) console.warn('[Mermaid] 自适应布局加载失败，预生成图表仍可使用。', error);
  });

  return () => {
    disposed = true;
    diagram?.destroy();
  };
}
