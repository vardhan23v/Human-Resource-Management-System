import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
const KEY = 'dayflow.theme';

function resolve(t: Theme): 'light' | 'dark' {
  return t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
}
function apply(t: Theme) {
  const r = resolve(t);
  document.documentElement.setAttribute('data-theme', r);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', r === 'dark' ? '#0F0F1C' : '#5B5BF6');
}

/** Light / dark / system theme with persistence. Call once near the app root; read anywhere. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) || 'system');
  useEffect(() => {
    apply(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => theme === 'system' && apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
  const setTheme = useCallback((t: Theme) => { localStorage.setItem(KEY, t); setThemeState(t); }, []);
  const toggle = useCallback(() => setTheme(resolve(theme) === 'dark' ? 'light' : 'dark'), [theme, setTheme]);
  return { theme, resolved: resolve(theme), setTheme, toggle };
}
