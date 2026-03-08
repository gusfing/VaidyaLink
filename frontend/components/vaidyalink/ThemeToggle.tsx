'use client';

import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    if (theme === 'system') {
      return 'brightness_auto';
    }
    return resolvedTheme === 'dark' ? 'dark_mode' : 'light_mode';
  };

  const getLabel = () => {
    if (theme === 'system') {
      return 'Auto';
    }
    return resolvedTheme === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <button
      onClick={cycleTheme}
      className="theme-toggle-btn"
      aria-label={`Current theme: ${getLabel()}. Click to change.`}
      title={`Theme: ${getLabel()}`}
    >
      <span className="material-symbols-outlined">{getIcon()}</span>
      <span className="theme-label">{getLabel()}</span>
    </button>
  );
}
