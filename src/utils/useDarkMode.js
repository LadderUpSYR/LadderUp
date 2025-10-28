import { useState, useEffect } from 'react';

/**
 * Custom hook for managing dark mode preference across the application
 * Syncs with localStorage to persist user preference
 */
export const useDarkMode = () => {
  // Initialize from localStorage or default to false
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Update localStorage and dispatch custom event when dark mode changes
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    
    // Dispatch custom event to notify other components/pages
    window.dispatchEvent(new CustomEvent('darkModeChange', { 
      detail: { isDarkMode } 
    }));
  }, [isDarkMode]);

  // Listen for dark mode changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'darkMode') {
        setIsDarkMode(e.newValue ? JSON.parse(e.newValue) : false);
      }
    };

    // Listen for changes from other tabs
    window.addEventListener('storage', handleStorageChange);

    // Listen for changes within the same page
    const handleDarkModeChange = (e) => {
      if (e.detail && e.detail.isDarkMode !== isDarkMode) {
        setIsDarkMode(e.detail.isDarkMode);
      }
    };
    window.addEventListener('darkModeChange', handleDarkModeChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('darkModeChange', handleDarkModeChange);
    };
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return { isDarkMode, setIsDarkMode, toggleDarkMode };
};
