/**
 * ChatQueue.jsx — Sidebar with session list and filters
 */

export default function ChatQueue({
  sessions,
  activeSessionId,
  onSelectSession,
  filter,
  onFilterChange,
  totalCount,
}) {
  const filters = ['ALL', 'QUEUED', 'ACTIVE', 'CLOSED'];

  function formatTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function getPreviewText(session) {
    if (session.messages && session.messages.length > 0) {
      const latest = session.messages[0];
      const prefix = latest.sender === 'AGENT' ? 'You: ' : '';
      return `${prefix}${latest.content}`;
    }
    return 'No messages yet';
  }

  return (
    <aside className="chat-queue">
      <div className="queue-header">
        <h3>
          Conversations
          <span className="queue-count">{totalCount}</span>
        </h3>
      </div>

      <div className="queue-filters">
        {filters.map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => onFilterChange(f)}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="queue-list">
        {sessions.length === 0 ? (
          <div className="queue-empty">
            <span className="empty-icon">📭</span>
            <span>No conversations{filter !== 'ALL' ? ` with status "${filter.toLowerCase()}"` : ''}</span>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-card ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="session-top">
                <span className="customer-name">
                  {session.customerName || 'Visitor'}
                </span>
                <span className={`status-badge ${session.status.toLowerCase()}`}>
                  {session.status}
                </span>
              </div>

              <div className="session-preview">
                {getPreviewText(session)}
              </div>

              <div className="session-time">
                {session.status === 'QUEUED' && (
                  <span className="unread-dot" />
                )}
                <span>{formatTimeAgo(session.createdAt)}</span>
                {session.customerEmail && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    · {session.customerEmail}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
