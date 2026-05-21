import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgentHeader from './AgentHeader';

describe('AgentHeader', () => {
  const mockAgent = { name: 'Test Agent' };
  const mockToggleTheme = vi.fn();

  it('renders the toggle button with correct text for light theme', () => {
    render(
      <AgentHeader
        agent={mockAgent}
        isConnected={true}
        onLogout={() => {}}
        theme="light"
        toggleTheme={mockToggleTheme}
      />
    );
    expect(screen.getByText(/🌙 Dark/i)).toBeInTheDocument();
  });

  it('renders the toggle button with correct text for dark theme', () => {
    render(
      <AgentHeader
        agent={mockAgent}
        isConnected={true}
        onLogout={() => {}}
        theme="dark"
        toggleTheme={mockToggleTheme}
      />
    );
    expect(screen.getByText(/☀️ Light/i)).toBeInTheDocument();
  });

  it('calls toggleTheme when the button is clicked', () => {
    render(
      <AgentHeader
        agent={mockAgent}
        isConnected={true}
        onLogout={() => {}}
        theme="light"
        toggleTheme={mockToggleTheme}
      />
    );
    const button = screen.getByRole('button', { name: /Dark/i });
    fireEvent.click(button);
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });
});
