"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  dark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ec-theme');
      setDark(stored === 'dark');
    } catch (e) {
      /* ignore */
    }
    setMounted(true);
  }, []);

  // Apply theme class to root element
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }
    try {
      localStorage.setItem('ec-theme', dark ? 'dark' : 'light');
    } catch (e) {
      /* ignore */
    }
  }, [dark, mounted]);

  const toggleDark = () => {
    setDark((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ dark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
