import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textDim: string;
  border: string;
  danger: string;
};

type FontSize = 'small' | 'normal' | 'large';

const LightColors: ThemeColors = {
  background: '#f0f4f8',
  surface: '#ffffff',
  text: '#0f172a',
  textDim: '#64748b',
  border: '#cbd5e1',
  danger: '#dc2626',
};

const DarkColors: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  textDim: '#94a3b8',
  border: '#334155',
  danger: '#ef4444',
};

export const FONT_SCALES: Record<FontSize, number> = {
  small: 0.85,
  normal: 1,
  large: 1.15,
};

type ThemeContextType = {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isCalendarView: boolean;
  toggleCalendarView: () => void;
  autoApproveTournament: boolean;
  toggleAutoApproveTournament: () => void;
  openMatchCreation: boolean;
  toggleOpenMatchCreation: () => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  fontScale: number;
  colors: ThemeColors;
};

const DEFAULT_COLOR = '#0ea5e9';

const ThemeContext = createContext<ThemeContextType>({
  primaryColor: DEFAULT_COLOR,
  setPrimaryColor: () => {},
  isDarkMode: true,
  toggleDarkMode: () => {},
  isCalendarView: false,
  toggleCalendarView: () => {},
  autoApproveTournament: false,
  toggleAutoApproveTournament: () => {},
  openMatchCreation: false,
  toggleOpenMatchCreation: () => {},
  fontSize: 'normal',
  setFontSize: () => {},
  fontScale: 1,
  colors: DarkColors,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [primaryColor, setPrimaryColorState] = useState<string>(() => window.localStorage.getItem('themeColor') || DEFAULT_COLOR);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('themeMode');
    return saved ? saved === 'dark' : true;
  });
  const [isCalendarView, setIsCalendarView] = useState<boolean>(() => window.localStorage.getItem('calendarView') === 'true');
  const [autoApproveTournament, setAutoApproveTournament] = useState<boolean>(() => window.localStorage.getItem('autoApproveTournament') === 'true');
  const [openMatchCreation, setOpenMatchCreation] = useState<boolean>(() => window.localStorage.getItem('openMatchCreation') === 'true');
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const saved = window.localStorage.getItem('fontSize');
    return saved === 'small' || saved === 'normal' || saved === 'large' ? saved : 'normal';
  });

  const colors = isDarkMode ? DarkColors : LightColors;
  const fontScale = FONT_SCALES[fontSize];

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    root.style.setProperty('--bg-color', colors.background);
    root.style.setProperty('--surface-color', colors.surface);
    root.style.setProperty('--text-primary', colors.text);
    root.style.setProperty('--text-secondary', colors.textDim);
    root.style.setProperty('--border-color', colors.border);
    root.style.setProperty('--danger-color', colors.danger);
    root.style.setProperty('--primary-color', primaryColor);
    root.style.setProperty('--primary-color-dim', `${primaryColor}22`);
    root.style.setProperty('--font-scale', String(fontScale));
    document.body.style.backgroundColor = colors.background;
  }, [colors, fontScale, isDarkMode, primaryColor]);

  const value = useMemo<ThemeContextType>(() => ({
    primaryColor,
    setPrimaryColor: (color: string) => {
      setPrimaryColorState(color);
      window.localStorage.setItem('themeColor', color);
    },
    isDarkMode,
    toggleDarkMode: () => {
      setIsDarkMode((prev) => {
        const next = !prev;
        window.localStorage.setItem('themeMode', next ? 'dark' : 'light');
        return next;
      });
    },
    isCalendarView,
    toggleCalendarView: () => {
      setIsCalendarView((prev) => {
        const next = !prev;
        window.localStorage.setItem('calendarView', String(next));
        return next;
      });
    },
    autoApproveTournament,
    toggleAutoApproveTournament: () => {
      setAutoApproveTournament((prev) => {
        const next = !prev;
        window.localStorage.setItem('autoApproveTournament', String(next));
        return next;
      });
    },
    openMatchCreation,
    toggleOpenMatchCreation: () => {
      setOpenMatchCreation((prev) => {
        const next = !prev;
        window.localStorage.setItem('openMatchCreation', String(next));
        return next;
      });
    },
    fontSize,
    setFontSize: (size: FontSize) => {
      setFontSizeState(size);
      window.localStorage.setItem('fontSize', size);
    },
    fontScale,
    colors,
  }), [autoApproveTournament, colors, fontScale, fontSize, isCalendarView, isDarkMode, openMatchCreation, primaryColor]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
