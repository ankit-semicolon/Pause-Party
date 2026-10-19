import { Moon, Sun } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button className="theme-toggle glass-control" type="button" onClick={() => onChange(nextTheme)} aria-label={`Switch to ${nextTheme} mode`} title={`Switch to ${nextTheme} mode`}>
      <span className="theme-icon">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</span>
      <span className="theme-label">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
    </button>
  );
}
