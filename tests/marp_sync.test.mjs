import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { marpThemeVariables } from 'cinderfolio/marp';
import { createPeleTheme } from 'cinderfolio/pele';
import { installMarpThemeSync, marpThemeStorageKey } from '../scripts/marp_theme_sync.mjs';

test('嵌入页同步通用与 Pele 配色，更新变量时保留播放位置', () => {
  const sections = Array.from({ length: 3 }, () => ({ style: { setProperty(key, value) { this[key] = value; } } }));
  const state = { mode: 'dark', variables: marpThemeVariables(undefined, 'dark') };
  const listeners = {};
  const document = { documentElement: { style: {} }, querySelectorAll: () => sections };
  const location = { hash: '#2' };
  const context = vm.createContext({
    document, location,
    localStorage: { getItem: key => key === marpThemeStorageKey ? JSON.stringify(state) : null },
    window: { addEventListener: (name, listener) => { listeners[name] = listener; } },
  });
  vm.runInContext(`(${installMarpThemeSync.toString()})(${JSON.stringify(marpThemeStorageKey)})`, context);
  assert.equal(document.documentElement.style.colorScheme, 'dark');
  assert.ok(sections.every(section => section.style['--cf-background'] === '#121212'));
  assert.ok(sections.every(section => section.style['--pele-bg'] === '#121212'
    && section.style['--pele-critical'] === '#fcaf79'));

  const input = { ink: '#000000', paper: '#ffffff', accent: '#0099ff' };
  listeners.storage({ key: marpThemeStorageKey, newValue: JSON.stringify({ mode: 'light', variables: marpThemeVariables(input, 'light') }) });
  assert.equal(document.documentElement.style.colorScheme, 'light');
  assert.ok(sections.every(section => section.style['--cf-background'] === '#ffffff'
    && section.style['--cf-accent-brand'] === '#0099ff'));
  const { colors, onFill } = createPeleTheme(input, 'light');
  for (const section of sections) {
    for (const [key, value] of Object.entries(colors)) assert.equal(section.style[`--pele-${key}`], value);
    for (const [key, value] of Object.entries(onFill)) assert.equal(section.style[`--cf-pele-on-${key}`], value);
  }
  assert.equal(location.hash, '#2');
});
