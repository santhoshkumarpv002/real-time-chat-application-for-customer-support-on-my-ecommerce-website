import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';

// Mocking components to avoid full logic testing in App.test
vi.mock('./pages/Login', () => ({
  default: ({ onLogin }) => (
    <div>
      <button onClick={() => onLogin({ token: 'test-token', agent: { name: 'Test Agent' } })}>
        Login
      </button>
    </div>
  ),
}));

vi.mock('./pages/Dashboard', () => ({
  default: ({ theme, toggleTheme }) => (
    <div>
      <div data-testid="theme-display">{theme}</div>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  ),
}));

describe('App Theme Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  it('toggles theme and updates body class', () => {
    render(<App />);

    // Login first to see dashboard
    fireEvent.click(screen.getByText('Login'));

    const toggleBtn = screen.getByText('Toggle');

    // Initial should be light (or default)
    expect(document.body.classList.contains('dark-theme')).toBe(false);

    // Toggle to dark
    fireEvent.click(toggleBtn);
    expect(document.body.classList.contains('dark-theme')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');

    // Toggle back to light
    fireEvent.click(toggleBtn);
    expect(document.body.classList.contains('dark-theme')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
