/**
 * App.jsx — Root component
 * Handles auth state and routes between Login and Dashboard
 */

import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [auth, setAuth] = useState(null);

  // Restore auth from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('agent_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Check if token is still somewhat valid (basic check)
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

  return <Dashboard auth={auth} onLogout={handleLogout} />;
}
