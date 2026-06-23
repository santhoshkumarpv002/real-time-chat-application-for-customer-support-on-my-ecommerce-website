# Real-Time Customer Support Chat Monorepo

Welcome to the Real-Time Customer Support Chat project! This monorepo contains a full-stack, real-time messaging application designed for customer support.

It allows customers to chat with agents via an embeddable widget, while agents manage multiple conversations through a responsive dashboard.

## 🚀 Key Features

*   **Real-time Communication:** Powered by Socket.IO for seamless, low-latency messaging.
*   **Agent Dashboard:** A React-based interface for agents to accept, manage, and close support sessions.
*   **Embeddable Chat Widget:** A vanilla JS/CSS widget that can be easily embedded on any website.
*   **Authentication & Security:** JWT-based authentication for agents and Rate Limiting for the API.
*   **Session Management:** Customers can rejoin their active sessions, and chat history is preserved.
*   **Typing Indicators:** Real-time visual feedback when the other party is typing.
*   **Theming:** Dark mode support on the Agent Dashboard.

## 🏗 Architecture Diagram

```mermaid
graph TD
    subgraph Client-Side
        A[Embeddable Widget<br>(Vanilla JS/CSS)]
        B[Agent Dashboard<br>(React, Vite)]
    end

    subgraph Server-Side
        C[Node.js / Express Backend]
        D[Socket.IO Server]
    end

    subgraph Database Layer
        E[(Prisma + SQLite/PostgreSQL)]
    end

    A <-->|Socket.IO| D
    A -->|REST API| C
    B <-->|Socket.IO| D
    B -->|REST API| C

    C --> E
    D --> E
```

## 🛠 Tech Stack

*   **Backend:** Node.js, Express, Socket.IO, Prisma ORM, SQLite (Dev), JWT, bcryptjs
*   **Dashboard (Frontend):** React 18, Vite, Vitest, CSS Variables for theming
*   **Widget (Frontend):** Vanilla JavaScript, CSS, Socket.IO client
*   **Database:** SQLite (configured for Dev)

## 📁 Repository Structure

*   `app_build/backend/`: Node.js API and Socket.IO server.
*   `app_build/dashboard/`: React Vite application for the support agents.
*   `app_build/widget/`: Self-contained vanilla JavaScript and CSS chat widget.

## 🏁 Getting Started

### Prerequisites

*   Node.js (v18+ recommended)
*   npm

### Backend Setup

1.  Navigate to the backend directory:
    ```bash
    cd app_build/backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up the database:
    ```bash
    npm run db:migrate
    npm run db:generate
    ```
    *(Optional) Seed the database with a test agent:*
    ```bash
    npm run db:seed
    ```
4.  Start the backend server:
    ```bash
    npm run dev
    # The server will run on http://localhost:3001
    ```

### Dashboard Setup

1.  Navigate to the dashboard directory:
    ```bash
    cd app_build/dashboard
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    # The dashboard will run on http://localhost:5173
    ```

### Widget Integration

The chat widget can be served directly from the backend server or hosted anywhere. To test it locally:

1. You can open `app_build/widget/index.html` in your browser.
2. Ensure the backend server is running, as the widget connects to `http://localhost:3001` via Socket.IO.

## 🧪 Testing

To run the dashboard tests:

```bash
cd app_build/dashboard
npm test
```

## 👨‍💻 Development Information

*   **Database Migrations:** If you modify `schema.prisma`, run `npx prisma migrate dev` within the backend directory.
*   **CORS Configuration:** In the backend `.env`, `CORS_ORIGIN` defines the allowed origins. It defaults to `http://localhost:5173`.
