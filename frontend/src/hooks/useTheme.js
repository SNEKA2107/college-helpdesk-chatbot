import { useState, useCallback } from 'react';

export const THEMES = [
  { id: 'dark',  icon: '🌙', label: 'Dark' },
  { id: 'light', icon: '☀️', label: 'Light' },
  { id: 'night', icon: '🌑', label: 'Night' },
];

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ca_theme') || 'dark');

  const apply = useCallback((id) => {
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem('ca_theme', id);
    setTheme(id);
  }, []);

  const cycle = useCallback(() => {
    const idx = THEMES.findIndex(t => t.id === (localStorage.getItem('ca_theme') || 'dark'));
    apply(THEMES[(idx + 1) % THEMES.length].id);
  }, [apply]);

  const current = THEMES.find(t => t.id === theme) || THEMES[0];
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  return { theme, current, next, cycle, apply };
}
