import { useContext, useEffect, useState } from 'react';
import { ThemeContext } from '@rspress/core/runtime';
import { seeds, recipes, grayDivisions, grayIndex, accentSteps, createGrayScale, createAccentScale, createPalette, contrast } from '../cinderfolio/palette.mjs';
import { useCinderfolio, type CinderfolioSeeds } from './CinderfolioTheme';
import './cinderfolio.css';

const accentPresets = [
  ['蓝色', '#0095ff'], ['紫色', '#8b5cf6'], ['粉色', '#ec4899'], ['红色', '#ef4444'],
  ['橙色', seeds.accent], ['黄色', '#eab308'], ['绿色', '#22c55e'], ['青绿', '#14b8a6'],
  ['青色', '#06b6d4'], ['靛蓝', '#6366f1'],
] as const;

const seedControls = [
  { name: 'ink', label: '深色', step: 'g0', presets: [['纯黑', '#000000'], ['炭黑', seeds.ink], ['暖黑', '#1c1917']] },
  { name: 'paper', label: '浅色', step: 'g16', presets: [['纯白', '#ffffff'], ['微暖白', seeds.paper], ['暖白', '#faf8f2']] },
  { name: 'accent', label: '品牌色', step: 'brand', presets: accentPresets },
] as const;

const roleGroups = [
  ['背景层次', ['background', 'surface', 'surfaceHover']],
  ['文字层次', ['foreground', 'textMuted', 'textSubtle']],
  ['边界与控件', ['border', 'borderStrong', 'controlBorder', 'controlSelectedBackground', 'controlSelectedForeground']],
  ['品牌与状态', ['interaction', 'link', 'diagramStroke', 'selection', 'selectedBackground']],
] as const;

function BgMark() {
  return <span className="cf-bg" title="当前背景色" aria-label="当前背景色">bg</span>;
}

/** 交互参考 Rspress CssPickerEditor：预设圆点与原生颜色选择器。 */
function ColorBar({ name, label, step, presets, value, isBackground, onChange }: {
  name: keyof CinderfolioSeeds; label: string; step: string; presets: readonly (readonly [string, string])[];
  value: string; isBackground: boolean; onChange: (color: string) => void;
}) {
  const custom = value !== seeds[name] && !presets.some(([, color]) => color === value);
  return <div className={`cf-color-strip cf-color-strip--${name}`}>
    <div className="cf-color-strip__heading">
      <strong>{label}</strong><code>{step}</code>{isBackground && <BgMark />}<code className="cf-color-strip__value">{value}</code>
    </div>
    <div className="cf-color-bar" role="group" aria-label={`${label}颜色选择`}>
      <button type="button" className="cf-color-bar__default" aria-label={`恢复${label}默认颜色`}
        title={`默认 · ${seeds[name]}`} onClick={() => onChange(seeds[name])}>默认</button>
      <span className="cf-color-bar__divider" aria-hidden="true" />
      {presets.map(([title, color]) => <button key={color} type="button" className="cf-color-bar__swatch"
        style={{ backgroundColor: color, color }} aria-label={title} title={`${title} · ${color}`}
        aria-pressed={value === color} onClick={() => onChange(color)} />)}
      <span className="cf-color-bar__divider" aria-hidden="true" />
      <label className="cf-color-bar__custom" style={{ color: value }} data-selected={custom}
        title={`自定义${label} · ${value}`}>
        <input type="color" value={value} aria-label={`自定义${label}`}
          onInput={event => onChange(event.currentTarget.value)} />
      </label>
    </div>
  </div>;
}

/** 各段复用 Layout 提供的种子；页面本身就是预览，不再绘制独立样本。 */
export default function CinderfolioPreview({ section }: { section: 'controls' | 'roles' | 'scales' }) {
  const { input, setInput } = useCinderfolio();
  const { theme, setTheme } = useContext(ThemeContext);
  // SSG 使用默认亮色；首个客户端渲染保持一致，再读取用户保存的主题。
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const mode = hydrated && theme === 'dark' ? 'dark' : 'light';
  const colors = createPalette(input)[mode];
  const backgroundStep = `g${grayIndex(recipes.background.gray, mode)}`;

  if (section === 'controls') return <div className="cf-preview">
    <div className="cf-preview__seeds rp-not-doc">
      {seedControls.map(control => <ColorBar key={control.name} {...control} value={input[control.name]} isBackground={control.step === backgroundStep}
        onChange={color => setInput(previous => ({ ...previous, [control.name]: color }))} />)}
    </div>
    <div className="cf-preview__metrics rp-not-doc">
      <div className="cf-preview__scope">
        <button type="button" className="cf-theme-switch" role="switch" aria-label="暗色模式" aria-checked={mode === 'dark'}
          title={mode === 'light' ? '切换为暗色' : '切换为亮色'} onClick={() => setTheme?.(theme === 'dark' ? 'light' : 'dark')}>
          <span className="cf-theme-switch__thumb" />
        </button>
        <span>{mode === 'light' ? '亮色' : '暗色'} · 全网页生效</span>
      </div>
      <span>正文 {contrast(colors.foreground, colors.background).toFixed(2)}:1</span>
      <span>链接 {contrast(colors.link, colors.background).toFixed(2)}:1</span>
    </div>
  </div>;

  if (section === 'roles') return <div className="cf-role-groups rp-not-doc">
    {roleGroups.map(([title, keys]) => <section key={title} className="cf-role-group" aria-label={title}>
      <h3>{title}</h3>
      <ul className="cf-roles">
        {keys.map(key => {
          const recipe = recipes[key];
          let source;
          if ('gray' in recipe) source = `g${grayIndex(recipe.gray, mode)}`;
          else if ('accent' in recipe) source = typeof recipe.accent === 'string' ? recipe.accent : recipe.accent[mode];
          else if ('contrast' in recipe) source = colors[key] === input.ink ? 'g0' : 'g16';
          else {
            const [a, b, percent] = recipe.mix;
            const names = { accent: 'brand', background: 'bg' };
            source = `${names[a]} ${percent}% + ${names[b]} ${100 - percent}%`;
          }
          return <li key={key}>
            <div className="cf-roles__heading">
              <span className="cf-roles__swatch" style={{ background: colors[key] }} aria-hidden="true" />
              <span className="cf-roles__name">{recipe.label}</span>{key === 'background' && <BgMark />}<code>{colors[key]}</code>
            </div>
            <p className="cf-roles__detail"><code>{source}</code>{' · '}{recipe.usage}</p>
          </li>;
        })}
      </ul>
    </section>)}
  </div>;

  return <div className="cf-preview__scales rp-not-doc">
    <div className="cf-scale" aria-label="十六等分灰阶">
      {Object.entries(createGrayScale(input)).map(([name, value], index) => <div key={name} className="cf-swatch">
        <span style={{ background: value }} />
        <div className="cf-swatch__name">
          <strong>{name}</strong>{name === backgroundStep && <BgMark />}<small>{index * 100 / grayDivisions}%</small>
        </div>
        <code>{value}</code>
      </div>)}
    </div>
    <div className="cf-scale cf-scale--accent" aria-label="品牌色五档">
      {Object.entries(createAccentScale(input.accent)).map(([name, value]) => {
        const delta = accentSteps[name];
        const offset = delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '0';
        return <div key={name} className="cf-swatch">
          <span style={{ background: value }} />
          <div className="cf-swatch__name">
            <strong>{name}</strong><small title={`HSL 明度偏移 ${offset} 个百分点`}>ΔL {offset}</small>
          </div>
          <code>{value}</code>
        </div>;
      })}
    </div>
  </div>;
}
