/**
 * AgentHeader.jsx — Top bar with branding, connection status, and agent info
 */

export default function AgentHeader({ agent, isConnected, onLogout }) {
  const initials = agent.name
    ? agent.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <header className="dashboard-header">
      <div className="brand">
        <div className="brand-icon">💬</div>
        <div className="brand-text">
          <h2>Support Chat</h2>
          <span>Agent Dashboard</span>
        </div>
      </div>

      <div className="agent-info">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: isConnected ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? 'var(--color-success)' : 'var(--color-danger)',
              boxShadow: isConnected
                ? '0 0 8px var(--color-success-glow)'
                : 'none',
            }}
          />
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>

        <div className="agent-avatar">{initials}</div>
        <span className="agent-name">{agent.name}</span>

        <button className="logout-btn" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </header>
  );
}
