<div align="center">
  <h1>Actify — AI Academic Execution Planner</h1>
  <p><strong>Transform student deadlines into intelligent, personalized daily action plans.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-19-blue" alt="React 19" />
    <img src="https://img.shields.io/badge/Vite-8.0-purple" alt="Vite" />
    <img src="https://img.shields.io/badge/Node.js-Express-green" alt="Express" />
    <img src="https://img.shields.io/badge/Firebase-v12-yellow" alt="Firebase" />
    <img src="https://img.shields.io/badge/Gemini_AI-2.0_Flash-orange" alt="Gemini AI" />
    <img src="https://img.shields.io/badge/Framer_Motion-12-ff69b4" alt="Framer Motion" />
  </p>
</div>

<hr />

## 🌟 The Vision

Actify is an intelligent academic execution planner designed to solve a universal student problem: **knowing _what_ to do next without confusion or paralysis.**

Unlike simple to-do lists, Actify uses server-side AI and rule-based logic to break complex assignments into actionable micro-tasks, distribute workload evenly, detect procrastination risks, and dynamically rethink your schedule when you fall behind. With a unique focus on **Student Strength** and **Subject Proficiency**, Actify adjusts your daily study capacity so you don't burn out.

---

## 🏗️ Project Architecture

The project is structured with a decoupled **Frontend** and **Backend**:

```
Actify/
├── package.json              # Monorepo root orchestration
├── .gitignore                # Root gitignore for frontend, backend, and envs
├── README.md                 # Project documentation
│
├── frontend/                 # Client Application (React 19 + Vite)
│   ├── public/               # Static assets & redirects
│   ├── src/
│   │   ├── assets/           # Media & logo
│   │   ├── components/       # Layout, Dashboard, Tasks, and UI components
│   │   ├── config/           # Firebase client configuration
│   │   ├── context/          # React AuthContext
│   │   ├── hooks/            # useTasks, useSchedule, useSettings
│   │   ├── pages/            # Landing, Login, Signup, Dashboard, Tasks, etc.
│   │   ├── services/         # API client & task services
│   │   ├── styles/           # Design tokens & CSS
│   │   └── utils/            # Scheduling & priority utilities
│   ├── index.html
│   ├── vite.config.js        # Vite config with backend proxy (/api)
│   ├── package.json          # Frontend dependencies
│   └── .env.example          # Frontend environment variables template
│
└── backend/                  # API Server (Node.js + Express)
    ├── src/
    │   ├── config/           # Server environment config
    │   ├── controllers/      # AI & Plan controllers
    │   ├── routes/           # Express API routes (/api/ai)
    │   ├── services/         # Gemini 2.0 Flash service & planning algorithms
    │   └── server.js         # Express app entry point
    ├── package.json          # Backend dependencies
    └── .env.example          # Backend environment variables template
```

---

## ✨ Key Features

### 🧠 Gemini AI-Powered Planning (Backend Service)
Secure server-side integration with **Google Gemini 2.0 Flash**:
- **Protected Credentials**: Gemini API key remains securely on the backend server.
- **Student Strength Analysis**: Evaluates your task completion rate, on-time rate, and efficiency.
- **Subject Proficiency Distribution**: Allocates more study hours to weaker subjects.
- **Smart 15-Hour Cap**: Enforces a strict max of 15 hours per day to prevent burnout.

### 📊 Intelligent Rule-based Engine (Offline Fallback)
If no Gemini API key is configured or when working offline, Actify seamlessly falls back to a mathematical scheduling engine that tracks priority, difficulty, urgency, and chunks workloads.

### 🚨 Procrastination Risk Detection
Actify monitors remaining workload density. High-density tasks are flagged with **🔥 High Risk Alerts** on the dashboard.

### 🎨 Soft Brutalism Design System
A responsive UI built on Soft Brutalism principles:
- Pastel accents (Lavender, Mint, Blush, Sky)
- Clean borders and tactile shadows
- Framer Motion page transitions and celebratory confetti interactions!

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- `npm`

### 1. Install Dependencies
From the repository root:
```bash
npm run install:all
```
*(Or install manually inside each folder: `cd backend && npm install`, then `cd ../frontend && npm install`)*

### 2. Configure Environment Variables

#### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```env
PORT=5000
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here
CORS_ORIGIN=http://localhost:5173
```

#### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Run Development Servers
From the root directory:
```bash
# Run both Backend & Frontend concurrently
npm run dev
```

Or run them individually:
```bash
# Backend only (http://localhost:5000)
npm run dev:backend

# Frontend only (http://localhost:5173)
npm run dev:frontend
```

---

<div align="center">
  <p>Made with ❤️ by Alpha Bro's</p>
</div>
