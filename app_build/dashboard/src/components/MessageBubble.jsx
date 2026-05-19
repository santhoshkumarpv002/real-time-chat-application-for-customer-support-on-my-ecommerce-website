/**
 * MessageBubble.jsx — Individual message display
 * Handles customer, agent, and system messages with different styles
 */

export default function MessageBubble({ message, isOwnMessage }) {
  const { sender, content, createdAt, readAt } = message;

  // System messages get special treatment
  if (sender === 'SYSTEM') {
    return (
      <div className="message-bubble system">
        {content}
      </div>
    );
  }

  const bubbleClass = sender === 'AGENT' ? 'agent' : 'customer';
  const time = new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message-bubble ${bubbleClass}`}>
      <div>{content}</div>
      <div className="message-meta">
        <span>{time}</span>
        {sender === 'AGENT' && readAt && <span>✓✓</span>}
      </div>
    </div>
  );
}
