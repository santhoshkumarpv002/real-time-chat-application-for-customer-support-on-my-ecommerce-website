// chat-widget.js – Self‑contained embeddable support widget
// Load this script via a single <script src="chat-widget.js"></script> tag on any page.

(() => {
  // -----------------------------------------------------------------
  // Configuration – adjust as needed (endpoint URLs, colors can be overridden via CSS vars)
  // -----------------------------------------------------------------
  const SOCKET_URL = "http://localhost:3001"; // backend Socket.IO server
  const API_BASE = `${SOCKET_URL}/api/v1`; // absolute backend API path

  // -----------------------------------------------------------------
  // Utility helpers
  // -----------------------------------------------------------------
  const $ = (selector, ctx = document) => ctx.querySelector(selector);
  const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

  const createEl = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v);
    });
    children.forEach((c) => {
      if (typeof c === "string") el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  };

  // Simple debounce for typing events
  const debounce = (fn, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  };

  // -----------------------------------------------------------------
  // Main Widget class
  // -----------------------------------------------------------------
  class SupportWidget {
    constructor() {
      this.sessionId = sessionStorage.getItem("sc_session_id");
      this.socket = null;
      this.unreadCount = 0;
      this.isAgentConnected = false;
      this.initDOM();
      this.attachEvents();

      // Auto-reconnect if session exists
      if (this.sessionId) {
        this.showChatInterface();
        this.initSocket();
      }
    }

    // -----------------------------------------------------------------
    // DOM creation – all elements are created programmatically so the script is
    // completely self‑contained and does not require any external markup.
    // -----------------------------------------------------------------
    initDOM() {
      // Inject stylesheet
      const link = createEl("link", {
        rel: "stylesheet",
        href: `${SOCKET_URL}/widget/chat-widget.css`
      });
      document.head.appendChild(link);

      // Root container (fixed on page)
      this.root = createEl("div", { id: "sc-widget-root" });
      document.body.appendChild(this.root);

      // Launcher button
      this.launcher = createEl("button", { id: "sc-launcher", "aria-label": "Open support chat" }, [
        createEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, [
          createEl("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm1.31-7.89l-.83.83c-.41.41-.58 1.08-.5 1.93h-2c0-1.16.26-2.03.79-2.58l1.21-1.21c.28-.28.42-.66.42-1.08 0-.86-.69-1.56-1.55-1.56s-1.55.7-1.55 1.56H8c0-2.04 1.66-3.71 3.71-3.71 2.05 0 3.71 1.67 3.71 3.71 0 .79-.25 1.5-.69 2.11z" })
        ])
      ]);
      this.root.appendChild(this.launcher);

      // Unread badge (hidden initially)
      this.badge = createEl("div", { id: "sc-badge" });
      this.launcher.appendChild(this.badge);

      // Panel container (hidden by default)
      this.panel = createEl("div", { id: "sc-panel" });
      this.root.appendChild(this.panel);

      // Header – shows agent status after a session is accepted
      this.header = createEl("div", { id: "sc-panel-header" }, [
        createEl("div", { class: "sc-header-icon" }, [
          createEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, [
            createEl("path", { d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" })
          ])
        ]),
        createEl("div", { class: "sc-header-text" }, [
          createEl("h4", { html: "Support" }),
          createEl("p", { html: "We are here to help" })
        ]),
        createEl("div", { class: "sc-status-dot offline", "aria-label": "Agent status" })
      ]);
      this.panel.appendChild(this.header);

      // Pre‑chat form (optional name/email)
      this.prechat = createEl("div", { id: "sc-prechat" }, [
        createEl("h5", { html: "Start a chat" }),
        createEl("p", { html: "Leave your name and email and we’ll connect you with an agent instantly." }),
        createEl("input", { type: "text", placeholder: "Your name (optional)", id: "sc-name" }),
        createEl("input", { type: "email", placeholder: "Your email (optional)", id: "sc-email" }),
        createEl("button", { type: "button", id: "sc-start-btn" }, ["Start chat"])
      ]);
      this.panel.appendChild(this.prechat);

      // Chat interface – hidden until a session starts
      this.chat = createEl("div", { id: "sc-chat", style: "display:none;" }, [
        // Agent bar appears after an agent accepts the session
        createEl("div", { class: "sc-agent-bar", style: "display:none;" }, [
          createEl("div", { class: "sc-agent-avatar" }, ["A"]),
          createEl("div", { class: "sc-agent-name" }, ["Agent"])
        ]),
        // Message list
        createEl("div", { id: "sc-messages" }),
        // Input area
        createEl("div", { id: "sc-input-area" }, [
          createEl("div", { id: "sc-input-wrapper" }, [
            createEl("input", { type: "text", placeholder: "Type a message…", id: "sc-input", autocomplete: "off" }),
            createEl("button", { id: "sc-send-btn", disabled: true }, ["➤"])
          ])
        ])
      ]);
      this.panel.appendChild(this.chat);
    }

    // -----------------------------------------------------------------
    // Event listeners – launcher, start btn, send btn, socket events
    // -----------------------------------------------------------------
    attachEvents() {
      // Toggle panel open/close
      this.launcher.addEventListener("click", () => this.togglePanel());

      // Start chat button – gather optional info and create session
      $('#sc-start-btn').addEventListener("click", () => this.startSession());

      // Send message on button click or Enter key
      const input = $('#sc-input');
      const sendBtn = $('#sc-send-btn');

      sendBtn.addEventListener("click", () => this.sendMessage());
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
      });

      // Typing indicator – debounce to avoid spamming the server
      input.addEventListener("input", debounce(() => {
        if (this.sessionId) this.emitTyping(true);
        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => this.emitTyping(false), 1500);
      }, 300));
    }

    // -----------------------------------------------------------------
    // UI helpers
    // -----------------------------------------------------------------
    togglePanel() {
      const open = this.panel.classList.toggle("open");
      this.launcher.classList.toggle("open", open);
      if (!open) {
        // Just hide the panel, do not reset/destroy the socket if they just close the panel
        // but if they had not started a session, they'll see the pre-chat form again next time
      }
    }

    reset() {
      // Reset UI to the pre‑chat state
      this.sessionId = null;
      sessionStorage.removeItem("sc_session_id");
      this.isAgentConnected = false;
      this.unreadCount = 0;
      this.badge.classList.remove("show");
      this.prechat.style.display = "flex";
      this.chat.style.display = "none";
      $('#sc-messages').innerHTML = "";
      $('.sc-status-dot').classList.remove('online');
      $('.sc-status-dot').classList.add('offline');
      $('.sc-agent-bar').style.display = 'none';
      $('#sc-send-btn').disabled = true;
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
    }

    // -----------------------------------------------------------------
    // Session handling – connect socket and emit start event
    // -----------------------------------------------------------------
    startSession() {
      const name = $('#sc-name').value.trim();
      const email = $('#sc-email').value.trim();

      $('#sc-start-btn').disabled = true;
      this.initSocket(name, email);
    }

    showChatInterface() {
      this.prechat.style.display = "none";
      this.chat.style.display = "flex";
      $('#sc-send-btn').disabled = false;
    }

    // -----------------------------------------------------------------
    // Socket.IO – register all relevant events
    // -----------------------------------------------------------------
    initSocket(newName = null, newEmail = null) {
      const { io } = window;
      if (!io) {
        console.error("Socket.IO client not loaded. Ensure you include the socket.io script.");
        $('#sc-start-btn').disabled = false;
        return;
      }

      if (this.socket) return;

      this.socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1200,
      });

      this.socket.on("connect", () => {
        console.log("🟢 Widget socket connected");
        if (this.sessionId) {
          this.socket.emit("session:rejoin", { sessionId: this.sessionId });
        } else {
          this.socket.emit("session:start", { name: newName, email: newEmail });
        }
      });

      this.socket.on("disconnect", () => console.log("⚪ Widget socket disconnected"));

      this.socket.on("session:started", ({ session }) => {
        console.log("Session started", session);
        this.sessionId = session.id;
        sessionStorage.setItem("sc_session_id", session.id);
        this.showChatInterface();
        $('#sc-start-btn').disabled = false;
      });

      this.socket.on("session:rejoined", ({ session }) => {
        console.log("Session rejoined", session);
        this.sessionId = session.id;
        sessionStorage.setItem("sc_session_id", session.id);
        
        // Render previous messages
        const container = $('#sc-messages');
        container.innerHTML = "";
        if (session.messages) {
          session.messages.forEach(msg => this.renderMessage(msg));
        }

        // Set agent state if assigned
        if (session.agent) {
          this.isAgentConnected = true;
          $('.sc-status-dot').classList.remove('offline');
          $('.sc-status-dot').classList.add('online');
          
          const agentBar = $('.sc-agent-bar');
          const avatar = $('.sc-agent-avatar');
          const name = $('.sc-agent-name');
          avatar.textContent = session.agent.name.charAt(0).toUpperCase();
          name.textContent = session.agent.name;
          agentBar.style.display = "flex";
        }
      });

      this.socket.on("session:invalid", ({ sessionId }) => {
        console.warn("Session invalid or closed:", sessionId);
        this.reset();
      });

      this.socket.on("session:assigned", ({ session }) => {
        this.isAgentConnected = true;
        $('.sc-status-dot').classList.remove('offline');
        $('.sc-status-dot').classList.add('online');
        // Show agent name if provided
        const agentBar = $('.sc-agent-bar');
        const avatar = $('.sc-agent-avatar');
        const name = $('.sc-agent-name');
        if (session.agent && session.agent.name) {
          avatar.textContent = session.agent.name.charAt(0).toUpperCase();
          name.textContent = session.agent.name;
        } else {
          avatar.textContent = "A";
          name.textContent = "Agent";
        }
        agentBar.style.display = "flex";
        
        // Render a system message that the agent joined
        this.renderSystemMessage(`${name.textContent} has joined the chat.`);
        
        // Reset unread count now that the agent is online
        this.unreadCount = 0;
        this.badge.classList.remove('show');
      });

      this.socket.on("message:received", ({ message }) => {
        this.renderMessage(message);
        // If the widget is minimized (panel closed) we increase unread badge
        if (!this.panel.classList.contains('open')) {
          this.unreadCount++;
          this.badge.textContent = this.unreadCount;
          this.badge.classList.add('show');
        }
      });

      this.socket.on("typing:indicator", ({ sessionId, sender, isTyping }) => {
        if (sessionId !== this.sessionId) return;
        if (sender === "AGENT") {
          const typingEl = $('#sc-typing');
          if (isTyping) {
            if (!typingEl) this.showTyping();
          } else {
            if (typingEl) typingEl.remove();
          }
        }
      });

      this.socket.on("session:closed", ({ sessionId }) => {
        if (sessionId !== this.sessionId) return;
        this.renderSystemMessage("This chat has been closed by the agent.");
        sessionStorage.removeItem("sc_session_id");
        this.socket.disconnect();
        this.socket = null;
        $('#sc-send-btn').disabled = true;
      });
    }

    // -----------------------------------------------------------------
    // Messaging UI
    // -----------------------------------------------------------------
    renderMessage(msg) {
      // Don't render general status log system messages if we already showed them,
      // but render clean, formatted ones
      const container = $('#sc-messages');
      const isAgent = msg.sender === 'AGENT';
      const isCustomer = msg.sender === 'CUSTOMER';
      const isSystem = msg.sender === 'SYSTEM';
      
      let bubbleClass = 'sc-msg system';
      if (isAgent) bubbleClass = 'sc-msg agent';
      if (isCustomer) bubbleClass = 'sc-msg customer';
      
      const bubble = createEl('div', { class: bubbleClass }, [msg.content]);
      if (!isSystem) {
        const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        bubble.appendChild(createEl('div', { class: 'sc-msg-time' }, [time]));
      }
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
    }

    renderSystemMessage(text) {
      const container = $('#sc-messages');
      const el = createEl('div', { class: 'sc-msg system' }, [text]);
      container.appendChild(el);
      container.scrollTop = container.scrollHeight;
    }

    showTyping() {
      const container = $('#sc-messages');
      const typing = createEl('div', { class: 'sc-typing', id: 'sc-typing' }, [
        createEl('div', { class: 'sc-typing-dot' }),
        createEl('div', { class: 'sc-typing-dot' }),
        createEl('div', { class: 'sc-typing-dot' })
      ]);
      container.appendChild(typing);
      container.scrollTop = container.scrollHeight;
    }

    // -----------------------------------------------------------------
    // Send a customer message
    // -----------------------------------------------------------------
    async sendMessage() {
      const input = $('#sc-input');
      const text = input.value.trim();
      if (!text) return;
      
      // Emit to server (server will broadcast it back, which will render it)
      if (this.socket && this.sessionId) {
        this.socket.emit('message:send', { sessionId: this.sessionId, content: text });
        input.value = "";
      }
    }

    // -----------------------------------------------------------------
    // Emit typing indicator (client → server)
    // -----------------------------------------------------------------
    emitTyping(isTyping) {
      if (this.socket && this.sessionId) {
        this.socket.emit(isTyping ? 'typing:start' : 'typing:stop', { sessionId: this.sessionId });
      }
    }
  }

  // -----------------------------------------------------------------
  // Load Socket.IO client script dynamically (cdn) then instantiate widget
  // -----------------------------------------------------------------
  function loadSocketIO(cb) {
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
    script.async = true;
    script.onload = cb;
    script.onerror = () => console.error('Failed to load Socket.IO client script');
    document.head.appendChild(script);
  }

  loadSocketIO(() => new SupportWidget());
})();
