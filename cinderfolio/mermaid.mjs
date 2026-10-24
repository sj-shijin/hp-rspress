/** Mermaid 官方主题；复用 Pele 已确定的图表职责，只转换渲染器的变量名。 */
import { seeds } from './palette.mjs';
import { peleRoles, peleRoleGroups, createPeleTheme } from './pele.mjs';

export const mermaidRoles = {
  ...peleRoles,
  accent: { ...peleRoles.accent, usage: '普通任务、激活区与强调标记' },
  critical: { ...peleRoles.critical, usage: '关键任务与时间标记' },
};
export const mermaidRoleGroups = peleRoleGroups;

// 显式映射基础色，避免 Mermaid 根据主色再次旋转色相或调整明度。
const roleVariables = {
  bg: ['background', 'edgeLabelBackground', 'labelBackgroundColor', 'relationLabelBackground',
    'compositeBackground', 'altSectionBkgColor', 'commitLabelBackground', 'tagLabelBackground'],
  fg: ['primaryTextColor', 'tertiaryTextColor', 'textColor', 'nodeTextColor', 'titleColor',
    'actorTextColor', 'signalTextColor', 'labelTextColor', 'loopTextColor', 'classText',
    'stateLabelColor', 'transitionLabelColor', 'requirementTextColor', 'relationLabelColor',
    'taskTextOutsideColor', 'taskTextDarkColor', 'taskTextClickableColor', 'commitLabelColor',
    'tagLabelColor', 'pieTitleTextColor', 'pieLegendTextColor'],
  muted: ['noteTextColor'],
  line: ['lineColor', 'arrowheadColor', 'defaultLinkColor', 'signalColor', 'actorLineColor',
    'transitionColor', 'relationColor', 'specialStateColor', 'innerEndBackground', 'vertLineColor'],
  surface: ['primaryColor', 'mainBkg', 'nodeBkg', 'actorBkg', 'stateBkg', 'labelBoxBkgColor',
    'noteBkgColor', 'requirementBackground', 'compositeTitleBackground', 'rowOdd',
    'attributeBackgroundColorOdd', 'activeTaskBkgColor', 'errorBkgColor'],
  'surface-alt': ['tertiaryColor', 'clusterBkg', 'altBackground', 'rowEven',
    'attributeBackgroundColorEven', 'sectionBkgColor', 'sectionBkgColor2', 'rectBkgColor',
    'excludeBkgColor', 'doneTaskBkgColor'],
  border: ['primaryBorderColor', 'secondaryBorderColor', 'tertiaryBorderColor', 'border2',
    'nodeBorder', 'clusterBorder', 'flowContainerStroke', 'actorBorder', 'noteBorderColor',
    'labelBoxBorderColor', 'activationBorderColor', 'compositeBorder', 'requirementBorderColor',
    'gridColor', 'doneTaskBorderColor', 'tagLabelBorder', 'pieStrokeColor', 'pieOuterStrokeColor'],
  accent: ['secondaryColor', 'activationBkgColor', 'taskBkgColor', 'taskBorderColor', 'activeTaskBorderColor'],
  critical: ['critBkgColor', 'critBorderColor', 'todayLineColor'],
  error: ['errorTextColor'],
};

export function createMermaidTheme(input = seeds, mode = 'light') {
  const { colors: c, onFill } = createPeleTheme(input, mode);
  const series = Array.from({ length: 8 }, (_, i) => c[`series-${i + 1}`]);
  const v = {
    darkMode: mode === 'dark',
    fontFamily: 'sans-serif',
    useGradient: false,
    dropShadow: 'none',
    // 分类色已针对实底文字校正对比度，饼图不再叠加默认的 0.7 透明度。
    pieOpacity: 1,
  };
  for (const [role, variables] of Object.entries(roleVariables)) {
    for (const variable of variables) v[variable] = c[role];
  }
  Object.assign(v, {
    secondaryTextColor: onFill.accent,
    taskTextColor: onFill.accent,
    taskTextLightColor: onFill.critical,
    sequenceNumberColor: c.bg,
    // 饼图只提供一个内侧标签字色；现有八色都以深色端点为实底文字。
    pieSectionTextColor: input.ink,
    scaleLabelColor: input.ink,
    branchLabelColor: input.ink,
    faceColor: input.paper,
  });

  // Mermaid 内置部分图表读取 12 档；八色循环，类别顺序始终一致。
  for (let i = 0; i < 12; i++) {
    const key = `series-${i % 8 + 1}`;
    v[`pie${i + 1}`] = c[key];
    v[`cScale${i}`] = c[key];
    v[`cScaleLabel${i}`] = onFill[key];
    v[`cScaleInv${i}`] = onFill[key];
    v[`cScalePeer${i}`] = c[key];
    if (i < 8) {
      v[`git${i}`] = c[key];
      v[`gitInv${i}`] = onFill[key];
      v[`gitBranchLabel${i}`] = onFill[key];
      v[`fillType${i}`] = c[key];
      // 旅程图原生角色色槽为六个；分组仍有八个 fillType 色槽。
      if (i < 6) v[`actor${i}`] = c[key];
    }
  }
  // 时间线等图表的层次底色继续引用固定灰阶。
  for (let i = 0; i < 5; i++) {
    v[`surface${i}`] = i % 2 ? c['surface-alt'] : c.surface;
    v[`surfacePeer${i}`] = c.border;
  }

  for (let i = 1; i <= 4; i++) {
    v[`quadrant${i}Fill`] = i % 2 ? c.surface : c['surface-alt'];
    v[`quadrant${i}TextFill`] = c.fg;
  }
  Object.assign(v, {
    quadrantPointFill: c.accent,
    quadrantPointTextFill: c.fg,
    quadrantXAxisTextFill: c.muted,
    quadrantYAxisTextFill: c.muted,
    quadrantInternalBorderStrokeFill: c.border,
    quadrantExternalBorderStrokeFill: c.border,
    quadrantTitleFill: c.fg,
    xyChart: {
      backgroundColor: c.bg,
      titleColor: c.fg,
      dataLabelColor: c.fg,
      legendTextColor: c.fg,
      xAxisTitleColor: c.fg,
      xAxisLabelColor: c.muted,
      xAxisTickColor: c.line,
      xAxisLineColor: c.line,
      yAxisTitleColor: c.fg,
      yAxisLabelColor: c.muted,
      yAxisTickColor: c.line,
      yAxisLineColor: c.line,
      plotColorPalette: series.join(','),
    },
  });

  // 原生时间线把轴线绑定到分类标签色；旅程图的 HTML 标签则沿用画布文字。
  // 两处补充规则随 JSON 分发，避免只有网站预览修正了对比度。
  const themeCSS = [
    `.lineWrapper line { stroke: ${c.line}; }`,
    `.journey-section .label, .task .label, text.journey-section, text.task { color: ${input.ink}; fill: ${input.ink}; }`,
  ].join('\n');
  return {
    theme: 'base', look: 'classic', fontFamily: v.fontFamily, themeVariables: v, themeCSS,
  };
}
