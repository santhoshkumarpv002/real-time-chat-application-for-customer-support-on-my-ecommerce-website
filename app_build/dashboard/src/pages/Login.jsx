/**
 * Login.jsx — Agent login page
 * Glassmorphic card with gradient background
 */

import { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      onLogin(data);
    } catch (err) {
      setError('Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedAgent = async () => {
    setSeeding(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok) {
        setEmail('agent@demo.com');
        setPassword('demo123');
      } else {
        setError(data.error || 'Failed to seed demo agent');
      }
    } catch {
      setError('Network error — is the backend running?');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card fade-in">
        <h1>Support Chat</h1>
        <p className="subtitle">Agent Dashboard — Sign in to manage conversations</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              placeholder="agent@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading || !email || !password}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-hint">
          <strong>First time?</strong> Click below to create a demo agent, then log in.
          <br />
          <button
            onClick={handleSeedAgent}
            disabled={seeding}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '6px',
              color: '#818cf8',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {seeding ? 'Creating...' : '🌱 Seed Demo Agent'}
          </button>
          <br />
          <span style={{ marginTop: '6px', display: 'inline-block' }}>
            Email: <code>agent@demo.com</code> / Password: <code>demo123</code>
          </span>
        </div>
      </div>
    </div>
  );
}
