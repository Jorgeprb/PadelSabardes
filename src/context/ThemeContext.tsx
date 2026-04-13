import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  primaryColor: string;
  setPrimaryColor: (c: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isCalendarView: boolean;
  toggleCalendarView: () => void;
  autoApproveTournament: boolean;
  toggleAutoApproveTournament: () => void;
  openMatchCreation: boolean;
  toggleOpenMatchCreation: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  primaryColor: '#0ea5e9',
  setPrimaryColor: () => {},
  isDarkMode: false,
  toggleDarkMode: () => {},
  isCalendarView: false,
  toggleCalendarView: () => {},
  autoApproveTournament: false,
  toggleAutoApproveTournament: () => {},
  openMatchCreation: false,
  toggleOpenMatchCreation: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [primaryColor, setPrimaryColorState] = useState(() => localStorage.getItem('primaryColor') || '#0ea5e9');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('isDarkMode') === 'true');
  const [isCalendarView, setIsCalendarView] = useState(() => localStorage.getItem('isCalendarView') === 'true');
  const [autoApproveTournament, setAutoApprove] = useState(() => localStorage.getItem('autoApproveTournament') === 'true');
  const [openMatchCreation, setOpenMatch] = useState(() => localStorage.getItem('openMatchCreation') === 'true');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--primary-color-dim', primaryColor + '22');
  }, [isDarkMode, primaryColor]);

  const setPrimaryColor = (c: string) => {
    setPrimaryColorState(c);
    localStorage.setItem('primaryColor', c);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(p => {
      localStorage.setItem('isDarkMode', String(!p));
      return !p;
    });
  };

  const toggleCalendarView = () => {
    setIsCalendarView(p => {
      localStorage.setItem('isCalendarView', String(!p));
      return !p;
    });
  };

  const toggleAutoApproveTournament = () => {
    setAutoApprove(p => {
      localStorage.setItem('autoApproveTournament', String(!p));
      return !p;
    });
  };

  const toggleOpenMatchCreation = () => {
    setOpenMatch(p => {
      localStorage.setItem('openMatchCreation', String(!p));
      return !p;
    });
  };

  return (
    <ThemeContext.Provider value={{
      primaryColor, setPrimaryColor, isDarkMode, toggleDarkMode,
      isCalendarView, toggleCalendarView,
      autoApproveTournament, toggleAutoApproveTournament,
      openMatchCreation, toggleOpenMatchCreation,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
