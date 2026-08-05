import { createContext, useContext, useCallback, useLayoutEffect, useState } from 'react';

const ThemeContext = createContext(null);
const KEY = 'mb_theme';

export function ThemeProvider({ children }) {
  // Normalize so any stale/invalid stored value always resolves to a valid theme
  const [theme, setTheme] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // useLayoutEffect so the DOM class is always reconciled before paint — this
  // also self-heals a stale `.dark` class left on <html> by HMR/old sessions.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
