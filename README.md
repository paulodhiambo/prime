# PrimeNet Issue Desk

A web-based issue tracking and analytics platform for PrimeNet Internet Banking. Built with Node.js, Express, and native SQLite (`node:sqlite`), featuring branch-level issue logging and a protected register & analytics dashboard.

---

## Key Features

1. **Direct Issue Logging (`/`)**:
   - Branch staff can rapidly record internet banking complaints, inquiries, and transaction disputes across channels (Branch, Mobile App, Call Centre, Email, Website, etc.) without exposing previous incidents or customer data.
   - Live category categorization with sub-group pills (Login & Access, Transactions, System Issue, Enquiry, Complaint).

2. **SQLite Database Storage (`data/primenet.db`)**:
   - Central SQLite database using Node.js built-in `node:sqlite` (`DatabaseSync`) with Write-Ahead Logging (`WAL`) enabled for fast concurrent read/write performance.
   - Initialized with realistic sample issues spanning multiple banking branches (Riverside, Westlands, Upper Hill, CBD, Mombasa, Kisumu, Karen, Industrial Area).

3. **Authentication Gateway for Register & Analysis**:
   - The **"Register & analysis"** view and its underlying APIs (`/api/issues`, `/api/issues/recent`, `/api/stats`, `/api/issues/:id/status`) require authentication.
   - Features the **"Recently logged"** stream alongside analytics charts and the full central register.
   - If an unauthenticated user clicks the tab, an authentication modal appears.
   - Passwords hashed using cryptographic `scrypt` with individual salt per user.

4. **Analytics & Register Dashboard**:
   - **Metrics Strip**: Total issues, Open/In-progress count, Resolved count, Leading issue category.
   - **4 Interactive Charts** (powered by Chart.js):
     - Issues by category (Horizontal bar chart)
     - Status split (Doughnut chart with color coded legend)
     - Monthly volume trend (Line chart with area fill)
     - Top 10 branches by issue volume (Bar chart)
   - **Full Register Table**:
     - Real-time text search (name, branch, details, category, account number).
     - Category filter and Status filter.
     - In-line status changer updating SQLite directly.
     - **Export CSV** function with full field escaping.

---

## Project Structure

```
prime/
├── server.js               # Express server, SQLite schema, auth sessions & API endpoints
├── package.json            # Node.js configuration and dependencies
├── data/
│   └── primenet.db         # SQLite database file (auto-generated & seeded on startup)
└── public/
    ├── index.html          # Semantic HTML5 layout and login modal
    ├── styles.css          # Vanilla CSS design system (Fraunces & IBM Plex typography)
    └── app.js              # Frontend client, API requests, Chart.js logic
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
The server will start on `http://localhost:3000`.

For auto-reloading during development:
```bash
npm run dev
```

### 3. Default Login Credentials

| Role | Username | Password |
|---|---|---|
| System Administrator | `admin` | `admin123` |
| Senior Analyst | `analyst` | `prime2026` |

---

## API Reference

### Public Endpoints
- `GET /api/auth/me` — Returns `{ authenticated: boolean, user: object|null }`
- `POST /api/auth/login` — Authenticates user and sets HTTP-only session cookie
- `POST /api/auth/logout` — Destroys session
- `POST /api/issues` — Creates a new issue (open for branch staff recording)

### Protected Endpoints (Requires Auth)
- `GET /api/issues/recent` — Fetches 8 most recent issues for the dashboard stream
- `GET /api/issues` — Returns all registered issues
- `PATCH /api/issues/:id/status` — Updates status (`Open`, `In Progress`, `Not Confirmed`, `Resolved`)
- `GET /api/stats` — Returns aggregated counts and chart groupings
