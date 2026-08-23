/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getTheme } from '../../shared/preferences.js';

const ThemeContext = createContext(null);

function resolveSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const { userData } = useAuth();
  const storedTheme = getTheme(userData?.preferences);
  const [systemTheme, setSystemTheme] = useState(() => resolveSystemTheme());
  const resolvedTheme = storedTheme === 'system' ? systemTheme : storedTheme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    try {
      localStorage.setItem('theme-preference', storedTheme);
    } catch { /* localStorage unavailable — pre-paint cache just won't update */ }
  }, [resolvedTheme, storedTheme]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSystemTheme(resolveSystemTheme());
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
