import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useHead } from '@rspress/core/runtime';
import { seeds } from '../cinderfolio/palette.mjs';
import { createColorCss } from '../cinderfolio/css.mjs';

export type CinderfolioSeeds = typeof seeds;
type ThemeState = { input: CinderfolioSeeds; setInput: Dispatch<SetStateAction<CinderfolioSeeds>> };
const Context = createContext<ThemeState>({ input: seeds, setInput: () => {} });

/** 在 Layout 内保持本次浏览的配色，亮暗仍由 Rspress 的原生开关控制。 */
export function CinderfolioProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState({ ...seeds });
  useHead({
    style: [{
      key: 'cinderfolio-live',
      id: 'cinderfolio-live',
      textContent: createColorCss(input, {
        light: 'html:root:not(.rp-dark)',
        dark: 'html:root.rp-dark',
      }),
    }],
  });
  return <Context.Provider value={{ input, setInput }}>{children}</Context.Provider>;
}

export function useCinderfolio() {
  return useContext(Context);
}
