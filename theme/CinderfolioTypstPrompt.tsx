import { Prompt } from '@rspress/core/theme-original';
import { createTypstPrompt } from 'cinderfolio/typst';
import { useCinderfolio } from './CinderfolioTheme';

export default function CinderfolioTypstPrompt() {
  const { input } = useCinderfolio();
  return <Prompt title="用 AI 快速开始" prompt={createTypstPrompt(input)} />;
}
