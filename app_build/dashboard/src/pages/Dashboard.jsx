/**
 * Dashboard.jsx — Main agent dashboard layout
 * Split-panel: sidebar queue + chat window
 */

import { useState, useReducer, useEffect, useCallback } from 'react';
import useSocket from '../hooks/useSocket';
import AgentHeader from '../components/AgentHeader';
import ChatQueue from '../components/ChatQueue';
import ChatWindow from '../components/ChatWindow';

// ── State Reducer ────────────────────────────────────────────
const initialState = {
  sessions: [],
  activeSessionId: null,
  messages: {},       // sessionId → Message[]
  typingStates: {},   // sessionId → { sender, isTyping }
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };

    case 'ADD_SESSION': {
      // Avoid duplicates
      const exists = state.sessions.find(s => s.id === action.payload.id);
      if (exists) return state;
      return { ...state, sessions: [action.payload, ...state.sessions] };
    }

    case 'UPDATE_SESSION': {
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      };
    }

    case 'REMOVE_SESSION': {
      return {
        ...state,
        sessions: state.sessions.filter(s => s.id !== action.payload),
        activeSessionId: state.activeSessionId === action.payload
          ? null
          : state.activeSessionId,
      };
    }

    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSessionId: action.payload };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: { ...state.messages, [action.sessionId]: action.payload },
      };

    case 'ADD_MESSAGE': {
      const sessionId = action.payload.sessionId;
      const existing = state.messages[sessionId] || [];
      // Avoid duplicate messages
      if (existing.find(m => m.id === action.payload.id)) return state;
      return {
        ...state,
        messages: {
          ...state.messages,
          [sessionId]: [...existing, action.payload],
        },
        // Update the session's latest message preview
        sessions: state.sessions.map(s =>
          s.id === sessionId
            ? { ...s, messages: [action.payload], _count: { messages: (s._count?.messages || 0) + 1 } }
            : s
        ),
      };
    }

    case 'SET_TYPING':
      return {
        ...state,
        typingStates: {
          ...state.typingStates,
          [action.payload.sessionId]: {
            sender: action.payload.sender,
            isTyping: action.payload.isTyping,
          },
        },
      };

    default:
      return state;
  }
}

export default function Dashboard({ auth, onLogout }) {
  const { token, agent } = auth;
  const { isConnected, emit, on, off } = useSocket(token);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [filter, setFilter] = useState('ALL');

  // ── Fetch initial sessions ──────────────────────────────────
  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/v1/sessions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const sessions = await res.json();
          dispatch({ type: 'SET_SESSIONS', payload: sessions });
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      }
    }
    fetchSessions();
  }, [token]);

  // ── Socket event listeners ──────────────────────────────────
  useEffect(() => {
    if (!isConnected) return;

    const handleQueued = ({ session }) => {
      dispatch({ type: 'ADD_SESSION', payload: session });
    };

    const handleAccepted = ({ sessionId, agentId, agentName }) => {
      dispatch({
        type: 'UPDATE_SESSION',
        payload: { id: sessionId, status: 'ACTIVE', agentId, agent: { name: agentName } },
      });
    };

    const handleMessageReceived = ({ message }) => {
      dispatch({ type: 'ADD_MESSAGE', payload: message });
    };

    const handleTyping = ({ sessionId, sender, isTyping }) => {
      dispatch({
        type: 'SET_TYPING',
        payload: { sessionId, sender, isTyping },
      });
    };

    const handleSessionClosed = ({ sessionId }) => {
      dispatch({
        type: 'UPDATE_SESSION',
        payload: { id: sessionId, status: 'CLOSED' },
      });
    };

    const handleSessionUpdated = ({ sessionId, latestMessage }) => {
      dispatch({
        type: 'UPDATE_SESSION',
        payload: { id: sessionId, messages: [latestMessage] },
      });
    };

    const handleSessionData = ({ session }) => {
      dispatch({
        type: 'SET_MESSAGES',
        sessionId: session.id,
        payload: session.messages || [],
      });
    };

    on('session:queued', handleQueued);
    on('session:accepted', handleAccepted);
    on('message:received', handleMessageReceived);
    on('typing:indicator', handleTyping);
    on('session:closed', handleSessionClosed);
    on('session:updated', handleSessionUpdated);
    on('session:data', handleSessionData);

    return () => {
      off('session:queued', handleQueued);
      off('session:accepted', handleAccepted);
      off('message:received', handleMessageReceived);
      off('typing:indicator', handleTyping);
      off('session:closed', handleSessionClosed);
      off('session:updated', handleSessionUpdated);
      off('session:data', handleSessionData);
    };
  }, [isConnected, on, off]);

  // ── Actions ─────────────────────────────────────────────────
  const handleSelectSession = useCallback(async (sessionId) => {
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });

    // Load messages if not cached
    if (!state.messages[sessionId]) {
      try {
        const res = await fetch(`/api/v1/sessions/${sessionId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const messages = await res.json();
          dispatch({ type: 'SET_MESSAGES', sessionId, payload: messages });
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    }
  }, [token, state.messages]);

  const handleAcceptSession = useCallback((sessionId) => {
    emit('session:accept', { sessionId });
  }, [emit]);

  const handleCloseSession = useCallback((sessionId) => {
    emit('session:close', { sessionId });
  }, [emit]);

  const handleSendMessage = useCallback((sessionId, content) => {
    emit('message:send', { sessionId, content });
  }, [emit]);

  const handleTypingStart = useCallback((sessionId) => {
    emit('typing:start', { sessionId });
  }, [emit]);

  const handleTypingStop = useCallback((sessionId) => {
    emit('typing:stop', { sessionId });
  }, [emit]);

  // ── Filter sessions ─────────────────────────────────────────
  const filteredSessions = state.sessions.filter(s => {
    if (filter === 'ALL') return true;
    return s.status === filter;
  });

  const activeSession = state.sessions.find(s => s.id === state.activeSessionId);
  const activeMessages = state.messages[state.activeSessionId] || [];
  const activeTyping = state.typingStates[state.activeSessionId];

  return (
    <div className="dashboard">
      <AgentHeader agent={agent} isConnected={isConnected} onLogout={onLogout} />

      <ChatQueue
        sessions={filteredSessions}
        activeSessionId={state.activeSessionId}
        onSelectSession={handleSelectSession}
        filter={filter}
        onFilterChange={setFilter}
        totalCount={state.sessions.length}
      />

      <ChatWindow
        session={activeSession}
        messages={activeMessages}
        typingState={activeTyping}
        agentId={agent.id}
        onAccept={handleAcceptSession}
        onClose={handleCloseSession}
        onSendMessage={handleSendMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
      />
    </div>
  );
}
