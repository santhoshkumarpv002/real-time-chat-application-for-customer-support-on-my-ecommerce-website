/**
 * ChatWindow.jsx — Main chat area
 * Displays messages, typing indicator, and input for the active session
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({
  session,
  messages,
  typingState,
  agentId,
  onAccept,
  onClose,
  onSendMessage,
  onTypingStart,
  onTypingStop,
}) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingState]);

  // ── Typing indicator logic ──────────────────────────────────
  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);

    if (!session) return;

    // Emit typing start
    onTypingStart(session.id);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop(session.id);
    }, 2000);
  }, [session, onTypingStart, onTypingStop]);

  // ── Send message ────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content || !session) return;

    onSendMessage(session.id, content);
    setInputValue('');

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTypingStop(session.id);
  }, [inputValue, session, onSendMessage, onTypingStop]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ── Empty state ─────────────────────────────────────────────
  if (!session) {
    return (
      <div className="chat-window">
        <div className="chat-window-empty">
          <span className="empty-chat-icon">💬</span>
          <h3>No Conversation Selected</h3>
          <p>Select a conversation from the queue to start chatting with a customer</p>
        </div>
      </div>
    );
  }

  const customerInitial = (session.customerName || 'V')[0].toUpperCase();
  const isClosed = session.status === 'CLOSED';
  const isQueued = session.status === 'QUEUED';
  const isCustomerTyping = typingState?.sender === 'CUSTOMER' && typingState?.isTyping;

  return (
    <div className="chat-window">
      {/* ── Chat Header ─────────────────────────────────────── */}
      <div className="chat-header">
        <div className="customer-info">
          <div className="customer-avatar">{customerInitial}</div>
          <div className="customer-details">
            <h3>{session.customerName || 'Visitor'}</h3>
            <span>
              {session.customerEmail || 'No email provided'}
              {session.status === 'ACTIVE' && ' · Active'}
              {isClosed && ' · Closed'}
            </span>
          </div>
        </div>

        <div className="chat-actions">
          {isQueued && (
            <button
              className="action-btn accept"
              onClick={() => onAccept(session.id)}
            >
              ✓ Accept Chat
            </button>
          )}
          {!isClosed && !isQueued && (
            <button
              className="action-btn close-session"
              onClick={() => onClose(session.id)}
            >
              ✕ Close Session
            </button>
          )}
        </div>
      </div>

      {/* ── Messages Area ───────────────────────────────────── */}
      <div className="messages-area">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwnMessage={msg.sender === 'AGENT'}
          />
        ))}

        {/* Typing indicator */}
        {isCustomerTyping && (
          <div className="typing-indicator">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Message Input ───────────────────────────────────── */}
      {!isClosed ? (
        <div className="message-input-area">
          <div className="message-input-wrapper">
            <input
              type="text"
              placeholder={
                isQueued
                  ? 'Accept the chat to start messaging...'
                  : 'Type a message...'
              }
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isQueued}
              aria-label="Message input"
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!inputValue.trim() || isQueued}
              aria-label="Send message"
            >
              ➤
            </button>
          </div>
        </div>
      ) : (
        <div className="message-input-area" style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            This session has been closed
          </span>
        </div>
      )}
    </div>
  );
}
