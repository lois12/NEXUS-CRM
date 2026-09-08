import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ThemeName, Theme } from '../types';

const themes: Record<ThemeName, Theme> = {
  'cyber-green': {
    name: 'cyber-green',
    label: 'NETRUNNER',
    description: 'Матрица кода',
    colors: {
      primary: '#00ff88',
      secondary: '#00cc6a',
      accent: '#00ff88',
      glow: 'rgba(0, 255, 136, 0.3)',
      bg: '#0a0a0f',
      card: 'rgba(20, 20, 35, 0.8)',
      border: 'rgba(0, 255, 136, 0.2)',
    },
  },
  'cyber-pink': {
    name: 'cyber-pink',
    label: 'SYNTHWAVE',
    description: 'Неоновые мечты',
    colors: {
      primary: '#ff00ff',
      secondary: '#cc00cc',
      accent: '#ff66ff',
      glow: 'rgba(255, 0, 255, 0.3)',
      bg: '#0d0a12',
      card: 'rgba(25, 15, 35, 0.8)',
      border: 'rgba(255, 0, 255, 0.2)',
    },
  },
  'cyber-blue': {
    name: 'cyber-blue',
    label: 'ARASAKA',
    description: 'Корпоративный лёд',
    colors: {
      primary: '#00d4ff',
      secondary: '#00a8cc',
      accent: '#66e5ff',
      glow: 'rgba(0, 212, 255, 0.3)',
      bg: '#080a12',
      card: 'rgba(15, 20, 35, 0.8)',
      border: 'rgba(0, 212, 255, 0.2)',
    },
  },
  'cyber-purple': {
    name: 'cyber-purple',
    label: 'BIOTECH',
    description: 'Генетический код',
    colors: {
      primary: '#bf00ff',
      secondary: '#9900cc',
      accent: '#d966ff',
      glow: 'rgba(191, 0, 255, 0.3)',
      bg: '#0c0a14',
      card: 'rgba(22, 15, 38, 0.8)',
      border: 'rgba(191, 0, 255, 0.2)',
    },
  },
  'cyber-orange': {
    name: 'cyber-orange',
    label: 'WASTELAND',
    description: 'Постапокалипсис',
    colors: {
      primary: '#ff6600',
      secondary: '#cc5200',
      accent: '#ff8833',
      glow: 'rgba(255, 102, 0, 0.3)',
      bg: '#0f0a08',
      card: 'rgba(30, 20, 12, 0.8)',
      border: 'rgba(255, 102, 0, 0.2)',
    },
  },
};

interface ThemeContextType {
  currentTheme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  themes: Record<ThemeName, Theme>;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('nexus_theme');
    return (saved as ThemeName) || 'cyber-green';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    localStorage.setItem('nexus_theme', themeName);
    
    // Apply theme CSS variables to root
    const theme = themes[themeName];
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-glow', theme.colors.glow);
    root.style.setProperty('--color-bg', theme.colors.bg);
    root.style.setProperty('--color-card', theme.colors.card);
    root.style.setProperty('--color-border', theme.colors.border);
  }, [themeName]);

  const setTheme = useCallback((name: ThemeName) => {
    if (name === themeName) return;
    
    setIsTransitioning(true);
    setThemeName(name);
    
    // Remove overlay after scanline completes
    setTimeout(() => setIsTransitioning(false), 600);
  }, [themeName]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme: themes[themeName],
        themeName,
        setTheme,
        themes,
        isTransitioning,
      }}
    >
      {/* Theme transition overlay */}
      {isTransitioning && (
        <div className="theme-transition-overlay" />
      )}
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
