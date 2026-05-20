/**
 * App.jsx — Root component
 * Handles auth state and routes between Login and Dashboard
 */

import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Apply theme class to document body
  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Restore auth from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('agent_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.agent) {
          setAuth(parsed);
        }
      } catch {
        localStorage.removeItem('agent_auth');
      }
    }
  }, []);

  const handleLogin = (authData) => {
    localStorage.setItem('agent_auth', JSON.stringify(authData));
    setAuth(authData);
  };

  const handleLogout = () => {
    localStorage.removeItem('agent_auth');
    setAuth(null);
  };

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard
    auth={auth}
    onLogout={handleLogout}
    theme={theme}
    toggleTheme={toggleTheme}
  />;
}
