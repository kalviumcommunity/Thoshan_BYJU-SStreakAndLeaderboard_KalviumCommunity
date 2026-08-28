# BYJU'S Streak Engine & Cohort Leaderboard

A full-stack, production-grade habit tracking and competitive gamification platform engineered for BYJU'S learning ecosystem. The system tracks daily academic milestones, evaluates continuous learning streaks using pure database-driven calendar algorithms with a 24-hour inactivity grace period, awards activity points, and maintains real-time cohort leaderboards cached via Redis.

---

## 1. Project Overview

The **BYJU'S Streak & Leaderboard** application is an educational productivity platform designed to drive consistent daily learning habits among students.

### Core Mechanisms & Interrelationships
- **Tasks & Activities:** Students organize daily academic curriculum (e.g. Calculus lectures, kinematics quizzes, chemistry notes). Completing an activity on a given calendar date creates a persistent, date-specific completion record.
- **Streak Calculation:** Daily task completions register active dates in PostgreSQL. The streak engine runs server-side calendar math over distinct active days, computing current and longest streaks while offering a 24-hour grace window for the active reference date.
- **Scoring & Gamification:** Completing an activity awards **15 points** and creates an Activity event tied to the current weekly cohort window.
- **Cohort Leaderboards:** Scores are dynamically aggregated across multiple timeframes (`day`, `week`, `month`, `all_time`), ranked with deterministic tie-breaking (Points $\to$ Streak $\to$ Seniority), and cached in Redis with an hourly background refresh schedule.

```
[User Action: Task Completed]
          │
          ├──▶ [TaskCompletion Record Created in DB (date-specific)]
          ├──▶ [Activity Logged (+15 pts) & WeeklyScore Updated]
          │
          ├──▶ [Streak Recalculated from Persistent DB Data]
          └──▶ [Leaderboard Aggregated & Cached in Redis (1h TTL)]
```

---

## 2. Problem Statement

Maintaining consistent study habits is one of the hardest challenges in self-paced digital education. Traditional habit trackers suffer from:
1. **Fragile Client-Side State:** Streaks stored in local browser storage or in-memory caches that reset upon logout or server restart.
2. **Artificial Inflation Vulnerabilities:** Completing 5 tasks on a single afternoon artificially multiplying a streak counter by 5.
3. **Timezone & Midnight Skew:** Daylight Saving Time (DST) changes or UTC day rollovers prematurely breaking streaks.
4. **Unfair Leaderboard Mechanics:** Slow batch-only recalculations and lack of transparent tie-breaking rules.

### Solution Provided by this Platform
- **Pure Database-Driven Truth:** Streaks are dynamically computed from unique active calendar dates (`YYYY-MM-DD`) stored in PostgreSQL.
- **Idempotent Set-Based Deduplication:** Multiple completions on the same date count as exactly 1 active day.
- **24-Hour Inactivity Grace Window:** Streaks remain active during the current reference day if the student was active yesterday (`isAtRisk: true`), only resetting to 0 if a full 24h+ calendar gap occurs.
- **Sub-Millisecond Leaderboards:** Redis-cached sorted rankings with automatic fallback to PostgreSQL if Redis is offline.

---

## 3. Features

### Authentication & User Identity
- **User Registration & Login:** Email/password authentication backed by bcryptjs (10 salt rounds) and signed custom JWTs (7-day validity).
- **Dual Authentication Middleware:** Seamlessly validates both custom application JWTs and Firebase ID tokens (Google Sign-In / Firebase Auth).
- **Rate Limiting:** Public auth endpoints (`/auth/register`, `/auth/login`) are protected with an IP-based rate limiter (100 requests / 15 minutes).
- **Current User Profile:** `GET /auth/me` and `GET /profile` return sanitized user data, streak snapshots, and weekly points.
- **Stateless Logout:** `POST /auth/logout` endpoint for clean client session termination.

### Task & Activity Management
- **Full CRUD Support:** Create, read, update, and delete tasks.
- **Date-Specific Completions:** Completion state is stored on a per-date basis (`YYYY-MM-DD`) via the `task_completions` table with unique constraint `(userId, taskId, date)`. Completing a task on today does not affect yesterday or tomorrow.
- **Recurring Task Engine:** Tasks can be configured as one-time or recurring (`daily`, `weekdays`, `weekly`, `custom` days). The system automatically evaluates which tasks should appear on any requested date.
- **Task Categorization:** Tasks support categories (`Core Concept`, `Quiz Practice`, `Daily Task`, `Assessment`) and time slots.
- **Default Curriculum Seeding:** New users automatically receive a set of curated STEM learning tasks.

### Streak Engine
- **Current Streak Calculation:** Consecutive active days counting backwards from reference date (or yesterday during the 24-hour grace period).
- **Longest Streak Calculation:** Historical maximum consecutive chain of active days across the student's entire history.
- **24-Hour Grace Period:** If a user was active yesterday but hasn't completed today's tasks yet, their streak is preserved with an `isAtRisk: true` warning flag.
- **Zero Double-Counting:** Multiple activities on the same date are deduplicated using Set algebra.
- **Weekly Matrix Calendar:** `GET /streak/history` returns a structured 7-day calendar matrix (Monday to Sunday) indicating completed, current, and past days.
- **Server Restart Resilience:** Streaks survive server restarts, cache flushes, and client reloads because they are calculated strictly from database activity records.

### Cohort Leaderboard System
- **Timeframe Filtering:** Supports `day`, `week`, `month`, and `all_time` rankings.
- **Deterministic Tie-Breaking:**
  1. Primary: Highest Points
  2. Secondary: Longest Streak
  3. Tertiary: Seniority (`createdAt` timestamp)
- **User Standing & Surrounding Peers:** `GET /leaderboard/me` returns the student's exact ordinal rank and immediate surrounding peers within a configurable radius.
- **Podium Highlighting:** Top 3 students receive special podium styling (`🥇 #1`, `🥈 #2`, `🥉 #3`).
- **Redis Caching:** Leaderboards are cached with a 1-hour TTL under `leaderboard:<timeframe>`.
- **Database Fallback:** If Redis is unreachable, the system automatically falls back to raw database queries without failing client requests.

---

## 4. Tech Stack

### Frontend
- **Framework:** React 19 (React DOM 19)
- **Language:** TypeScript (~6.0)
- **Bundler & Dev Server:** Vite 8
- **Routing:** React Router DOM 7
- **Styling:** Tailwind CSS 4 (`@tailwindcss/vite`)
- **Authentication SDK:** Firebase JS SDK 12 (Google Sign-In, Email/Password)

### Backend API
- **Runtime:** Node.js (v18+)
- **Server Framework:** Express 4
- **ORM & Database Client:** Prisma Client 6 / 7
- **Database:** PostgreSQL 16
- **Cache Layer:** Redis 7 (via `ioredis` 6)
- **Security & Tokens:** `jsonwebtoken` (JWT), `bcryptjs` (password hashing), `cors`, `dotenv`
- **Rate Limiting:** `express-rate-limit`
- **Firebase Admin SDK:** `firebase-admin` 13 (Token verification)

### DevOps & Infrastructure
- **Containerization:** Docker & Docker Compose
- **Web Server / Reverse Proxy:** Nginx (Alpine) for serving frontend SPA and routing `/api/*` requests

### Testing
- **Test Suite:** Native Node.js assertion suites (`assert`) executing against real Prisma database instances (`test/streak.test.js`, `test/leaderboard.test.js`, `test/regression.test.js`, `test/auth.test.js`, `test/http.test.js`).

---

## 5. System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        SPA["React 19 + Vite Frontend (Nginx :80)"]
    end

    subgraph Backend ["Backend Layer (Express :5000)"]
        Router["Express Router & Rate Limiter"]
        AuthMid["Auth Middleware (JWT / Firebase Admin)"]
        
        subgraph Controllers ["Controllers"]
            AuthCtrl["Auth Controller"]
            TaskCtrl["Task Controller"]
            StreakCtrl["Streak Controller"]
            LBCtrl["Leaderboard Controller"]
            HealthCtrl["Health Controller"]
        end

        subgraph Services ["Services Engine"]
            AuthSvc["Auth Service (bcrypt)"]
            TaskSvc["Task Service"]
            StreakSvc["Streak Engine (Set Math)"]
            LBSvc["Leaderboard Service"]
            SchedSvc["Scheduler Service (1h Interval)"]
        end
    end

    subgraph Data ["Data & Cache Layer"]
        Prisma["Prisma ORM Client"]
        Postgres[("PostgreSQL 16\n- Users\n- Tasks\n- TaskCompletions\n- Activities\n- WeeklyScores\n- StreakHistory")]
        Redis[("Redis 7 Cache\n- Leaderboard Sorted Sets / JSON")]
    end

    SPA -->|HTTP Requests| Router
    Router --> AuthMid
    AuthMid --> Controllers
    Controllers --> Services
    
    Services --> Prisma
    Prisma --> Postgres
    
    LBSvc <-->|Cache Read / Set (1h TTL)| Redis
    SchedSvc -->|Hourly Cache Warming| LBSvc
```

### Request Flow
1. **User Authentication:** Requests pass through `verifyFirebaseToken` middleware, resolving either a local JWT or Firebase ID token to populate `req.user`.
2. **Task State Modification:** `POST /tasks/toggle` invokes `task.service.js`, executing a database upsert on `TaskCompletion` for `(userId, taskId, date)`.
3. **Score & Activity Propagation:** If newly completed, an `Activity` record is inserted and `WeeklyScore` is incremented.
4. **Streak Calculation:** `streak.service.js` queries active dates from `TaskCompletion` and `Activity` tables, calculates metrics, and updates `StreakHistory`.
5. **Leaderboard Serving:** `leaderboard.service.js` checks Redis for cached ranking JSON. On cache miss or Redis offline, it aggregates records from PostgreSQL and repopulates cache.

---

## 6. Database Schema (Prisma)

The database schema is defined in [`backend/prisma/schema.prisma`](file:///backend/prisma/schema.prisma):

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│              User               │       │              Task               │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ id (PK, UUID)                   │◀──┐   │ id (PK, UUID)                   │
│ firebaseUid (Unique, String?)   │   │   │ userId (FK -> User.id)          │──┐
│ email (Unique, String)          │   └───│ title (String)                  │  │
│ passwordHash (String?)          │       │ description (String?)           │  │
│ name (String?)                  │       │ category (String)               │  │
│ createdAt (DateTime)            │       │ time (String?)                  │  │
│ updatedAt (DateTime)            │       │ date (String? YYYY-MM-DD)       │  │
└─────────────────────────────────┘       │ isRecurring (Boolean)           │  │
       │           │          │           │ recurringType (String)          │  │
       │           │          │           │ recurringDays (String?)         │  │
       │           │          │           │ createdAt, updatedAt            │  │
       │           │          │           └─────────────────────────────────┘  │
       │           │          │                            ▲                   │
       ▼           ▼          ▼                            │                   │
┌──────────────┬──────────┬──────────────┐                 │                   │
│TaskCompletion│ Activity │ WeeklyScore  │                 │                   │
├──────────────┼──────────┼──────────────┤                 │                   │
│ id (PK)      │ id (PK)  │ id (PK)      │                 │                   │
│ userId (FK)  │ userId   │ userId (FK)  │                 │                   │
│ taskId (FK)──┼──────────┼──────────────┼─────────────────┘                   │
│ date (String)│ type     │ weekStartDate│                                     │
│ completed    │ points   │ score        │                                     │
│ completedAt  │ timestamp│ updatedAt    │                                     │
└──────────────┴──────────┴──────────────┘                                     │
       ▲                                                                       │
       └────────────────── UNIQUE (userId, taskId, date) ──────────────────────┘
```

### Models Summary

| Model | Table Name | Purpose | Key Constraints / Indexes |
|---|---|---|---|
| **`User`** | `users` | Core user identity for local and Firebase accounts | `@@unique([email])`, `@@unique([firebaseUid])` |
| **`Task`** | `tasks` | Daily learning tasks (one-time and recurring) | `@@index([userId])`, `@@index([userId, date])`, Cascade on delete |
| **`TaskCompletion`** | `task_completions` | Date-specific completion state per task | **`@@unique([userId, taskId, date])`**, `@@index([userId, date])` |
| **`Activity`** | `activities` | Raw activity log with points for audit and scoring | `@@index([userId])`, `@@index([timestamp])` |
| **`WeeklyScore`** | `weekly_scores` | Cohort weekly aggregated points | `@@unique([userId, weekStartDate])`, `@@index([weekStartDate, score])` |
| **`LeaderboardCache`**| `leaderboard_cache`| Fallback database leaderboard snapshot | `@@index([category, rank])` |
| **`StreakHistory`** | `streak_history` | Persistent daily streak count snapshots | `@@unique([userId, date])`, `@@index([userId, date])` |

---

## 7. API Documentation

Detailed endpoint documentation, including request payloads, query parameters, curl examples, and full JSON responses, is available in:

👉 **[Complete API Reference (docs/API.md)](file:///docs/API.md)**

### Quick Endpoint Summary

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | No | System health check |
| `POST` | `/auth/register` | No (Rate limited) | Register new user with email & password |
| `POST` | `/auth/login` | No (Rate limited) | Authenticate user & receive JWT token |
| `GET` | `/auth/me` | Bearer Token | Get profile of logged-in user |
| `POST` | `/auth/logout` | Bearer Token | User logout confirmation |
| `POST` | `/auth/sync` | Bearer Token | Sync Firebase user into PostgreSQL |
| `GET` | `/profile` | Bearer Token | Get user profile by token |
| `POST` | `/tasks` | Bearer Token | Create a new task (one-time or recurring) |
| `GET` | `/tasks` | Bearer Token | Get all tasks (supports `?date=YYYY-MM-DD`) |
| `GET` | `/tasks/completions` | Bearer Token | Get completion map for `?date=YYYY-MM-DD` |
| `POST` | `/tasks/toggle` | Bearer Token | Toggle completion for specific task + date |
| `GET` | `/tasks/:id` | Bearer Token | Retrieve single task by UUID |
| `PUT` | `/tasks/:id` | Bearer Token | Update task title, recurrence, or time |
| `DELETE` | `/tasks/:id` | Bearer Token | Delete task and its completions |
| `GET` | `/streak` | Bearer Token | Get current streak, longest streak, status |
| `GET` | `/streak/history` | Bearer Token | Get streak metrics + 7-day week calendar |
| `POST` | `/streak/recalculate`| Bearer Token | Force DB recalculation & persist snapshot |
| `GET` | `/leaderboard` | Optional Bearer | Get ranked users & podium (cached in Redis)|
| `GET` | `/leaderboard/me` | Bearer Token | Get current user's rank & surrounding peers |
| `POST` | `/leaderboard/refresh`| Bearer Token | Force recalculate & warm Redis cache |

---

## 8. Environment Variables

Create `.env` files based on the provided templates:

### Root / Docker Environment Variables (`.env`)
```ini
# PostgreSQL
POSTGRES_USER=byjus
POSTGRES_PASSWORD=byjus_secret
POSTGRES_DB=byjus_streak

# Security (Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
JWT_SECRET=replace_with_a_strong_random_secret

# CORS
FRONTEND_URL=http://localhost

# Firebase Admin SDK (Optional: For Google Sign-In verification)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

### Backend-Specific Variables (`backend/.env`)
```ini
PORT=5000
NODE_ENV=development

# Database (PostgreSQL Connection String)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/byjus_streak_db?schema=public"

# Redis
REDIS_URL="redis://127.0.0.1:6379"

# Security
JWT_SECRET=replace_with_a_strong_random_secret
FRONTEND_URL=http://localhost:5173
```

---

## 9. Local Setup Guide

### Prerequisites
- Node.js (v18.0.0 or later)
- PostgreSQL (v14+ running locally) or Docker
- Redis (v6+ running locally) or Docker

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd "BYJU'S_Streak_And_Leaderboard"

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 2. Configure Environment Variables
```bash
# In the backend directory:
cp backend/.env.example backend/.env

# In the frontend directory:
cp frontend/.env.example frontend/.env
```

### 3. Setup Database with Prisma
```bash
cd backend

# Generate Prisma Client
npm run prisma:generate

# Run migrations to create tables in PostgreSQL
npm run prisma:migrate
```

### 4. Start the Backend API
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
```

### 5. Start the Frontend Application
```bash
cd frontend
npm run dev
# Vite dev server running at http://localhost:5173
```

---

## 10. Docker Setup

The repository includes a multi-container Docker Compose setup defined in `docker-compose.yml`:

```bash
# Start all 4 services (Postgres, Redis, Backend API, Frontend Nginx)
docker compose up -d --build
```

### Containers Configured

| Service Name | Image / Dockerfile | Exposed Port | Healthcheck |
|---|---|---|---|
| **`postgres`** | `postgres:16-alpine` | `5432` (internal) | `pg_isready` check every 10s |
| **`redis`** | `redis:7-alpine` | `6379` (internal) | `redis-cli ping` check every 10s |
| **`backend`** | `./backend/Dockerfile` | `5000` (internal) | `wget http://localhost:5000/health` |
| **`frontend`** | `./frontend/Dockerfile` | `80:80` (public) | Dependent on healthy backend |

Access the unified application at **`http://localhost`**. Nginx automatically routes browser traffic to `/` for the frontend SPA and proxies `/api/*` to the Express backend container.

---

## 11. Testing & Verification

The project includes unit, algorithm, and integration test suites in `backend/test/`:

```bash
cd backend

# Run the complete test suite (Streak Engine, Leaderboard, Regression, HTTP)
npm run test:all

# Run streak algorithm & database integration tests
npm run test:streak

# Run leaderboard scoring, ranking, & Redis fallback tests
npm run test:leaderboard

# Run regression test suite
npm run test:regression
```

### Test Coverage Highlights
- **`test/streak.test.js`**:
  - `calculateStreakFromActiveDates` pure algorithmic edge cases (empty history, today only, 7-day consecutive streak, same-day duplicate activities, 24-hour grace window, broken streaks).
  - Date helper boundary arithmetic across months, leap years, and year-ends.
  - Live PostgreSQL database test verifying that completing two tasks on the same day awards points but only increments the streak by 1.
- **`test/leaderboard.test.js`**:
  - Point calculations, deterministic tie-breaking by streak count, and registration timestamp seniority.
  - Surrounding users retrieval and Redis cache warming / retrieval.
- **`test/auth.test.js`**:
  - Error middleware response standardization and 404 handler.

---

## 12. Technical Deep Dive: Streak Engine

The core streak algorithm is implemented in [`backend/src/services/streak.service.js`](file:///backend/src/services/streak.service.js).

### Algorithm Principles (`calculateStreakFromActiveDates`)

1. **Active Date Set:** All completed tasks and logged activities are formatted into ISO calendar date strings (`YYYY-MM-DD`) and placed into a JavaScript `Set`. Duplicate tasks on the same calendar day collapse into a single set entry:
   $$\text{ActiveDays} = \{ d \in \text{Completions} \mid d = \text{"YYYY-MM-DD"} \}$$

2. **Current Streak Traversal:**
   - If $\text{today} \in \text{ActiveDays}$: Start at `today`, decrement by 1 calendar day iteratively while the date exists in the Set. `isActiveToday = true`, `isAtRisk = false`.
   - If $\text{today} \notin \text{ActiveDays}$ but $\text{yesterday} \in \text{ActiveDays}$: Start at `yesterday`, decrement backwards. The streak remains intact, but `isActiveToday = false`, `isAtRisk = true` (24-hour daily grace window).
   - If neither $\text{today}$ nor $\text{yesterday}$ are in $\text{ActiveDays}$: `currentStreak = 0`, `isAtRisk = false` (Inactivity > 24 hours).

3. **Longest Streak Traversal:**
   - Sort all unique active dates chronologically: $[d_1, d_2, \dots, d_n]$.
   - Walk through the sorted array. If $d_{i} - d_{i-1} = 1\text{ day}$, increment `currentChain`. If difference $> 1$, reset `currentChain = 1`.
   - $\text{longestStreak} = \max(\text{all chains}, \text{currentStreak})$.

4. **Timezone & Calendar Arithmetic:**
   - Uses `Intl.DateTimeFormat` with IANA timezone strings (`en-CA` locale) to evaluate the exact local calendar day.
   - Date shifts use UTC-based day arithmetic (`Date.UTC`) to prevent Daylight Saving Time skew (23-hour or 25-hour days).

---

## 13. Technical Deep Dive: Leaderboard & Scoring

Implemented in [`backend/src/services/leaderboard.service.js`](file:///backend/src/services/leaderboard.service.js).

### Scoring Rules
- **Task Completion:** Every task completed via `POST /tasks/toggle` awards **+15 points** and logs an `Activity` record.
- **Uncompletion:** Marking a task incomplete deletes the activity and decrements the weekly score by 15.
- **Idempotency:** Re-toggling an already-completed task does not award duplicate points (`pointsAwarded = 0`).

### Ranking & Tie-Breaking
When generating the leaderboard for any timeframe (`day`, `week`, `month`, `all_time`), users are sorted according to three sequential rules:
$$\text{Rank Criteria: } \text{Points (DESC)} \longrightarrow \text{Current Streak (DESC)} \longrightarrow \text{User CreatedAt (ASC)}$$

### Redis Caching Strategy
- Key pattern: `leaderboard:<timeframe>` (e.g. `leaderboard:week`, `leaderboard:day`).
- **TTL:** 3600 seconds (1 hour).
- **Graceful Fallback:** All Redis operations (`get`, `set`, `zadd`) are wrapped in connection safety checks (`redis.isAvailable()`). If Redis is offline or disconnected, queries execute directly on PostgreSQL without throwing exceptions.

---

## 14. Scheduled Background Jobs

Implemented in [`backend/src/services/scheduler.service.js`](file:///backend/src/services/scheduler.service.js).

- **Job Function:** `refreshAllLeaderboards()`
- **Interval:** Every 1 hour (`60 * 60 * 1000` ms) using Node.js `setInterval`.
- **Startup Action:** Automatically triggers an initial cache warming upon server boot to pre-populate Redis with fresh rankings across all 4 timeframes.
- **Error Handling:** Async promise errors are caught and logged with timestamp diagnostics without crashing the Express process.
- **Graceful Shutdown:** Clears timer intervals during `SIGINT` / `SIGTERM` signals.

---

## 15. Project Directory Structure

```text
BYJU'S_Streak_And_Leaderboard/
├── .env.example                  # Root environment variable template
├── docker-compose.yml            # Multi-container Docker Compose configuration
├── package.json                  # Root package descriptor
├── README.md                     # Project overview & architectural documentation
│
├── docs/
│   └── API.md                   # Complete REST API reference & endpoint specifications
│
├── backend/
│   ├── Dockerfile                # Production Node.js backend container definition
│   ├── package.json              # Backend dependencies & test scripts
│   ├── .env.example              # Backend local environment template
│   ├── prisma/
│   │   ├── schema.prisma         # Prisma data models & relation definitions
│   │   └── migrations/           # PostgreSQL migration history
│   ├── src/
│   │   ├── app.js                # Express app initialization, CORS, middleware
│   │   ├── server.js             # HTTP server listener & graceful shutdown handlers
│   │   ├── config/
│   │   │   ├── firebase.js       # Firebase Admin SDK initialization
│   │   │   ├── prisma.js         # PrismaClient singleton instance
│   │   │   └── redis.js          # ioredis client wrapper with fallback handlers
│   │   ├── controllers/
│   │   │   ├── auth.controller.js        # Authentication & profile handlers
│   │   │   ├── health.controller.js      # Health status handler
│   │   │   ├── leaderboard.controller.js # Leaderboard & rank handlers
│   │   │   ├── streak.controller.js      # Streak query & recalculation handlers
│   │   │   └── task.controller.js        # Task CRUD & toggle completion handlers
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js        # Dual JWT & Firebase token verification
│   │   │   └── error.middleware.js       # Centralized 404 & error handlers
│   │   ├── routes/
│   │   │   ├── auth.routes.js            # /auth routes & rate limiting
│   │   │   ├── health.routes.js          # /health route
│   │   │   ├── index.js                  # Master route aggregator
│   │   │   ├── leaderboard.routes.js     # /leaderboard routes
│   │   │   ├── streak.routes.js          # /streak routes
│   │   │   └── task.routes.js            # /tasks routes
│   │   ├── services/
│   │   │   ├── auth.service.js           # Password hashing & user synchronization
│   │   │   ├── leaderboard.service.js    # Aggregations, rankings, & Redis caching
│   │   │   ├── scheduler.service.js      # Hourly background cache warming jobs
│   │   │   ├── streak.service.js         # Pure calendar streak algorithm
│   │   │   └── task.service.js           # Task management & point allocation
│   │   └── utils/
│   │       └── jwt.js                    # JWT signing & verification utilities
│   └── test/
│       ├── auth.test.js          # Auth middleware & error handler tests
│       ├── auth-local.test.js    # Password hashing & JWT verification tests
│       ├── http.test.js          # HTTP route integration tests
│       ├── leaderboard.test.js   # Leaderboard scoring & tie-breaking tests
│       ├── regression.test.js    # End-to-end task & streak regression tests
│       └── streak.test.js        # Streak engine unit & DB integration tests
│
└── frontend/
    ├── Dockerfile                # Multi-stage Vite build + Nginx container
    ├── nginx.conf                # Reverse proxy config for SPA routing & /api proxy
    ├── package.json              # Frontend dependencies (React 19, Tailwind 4)
    ├── vite.config.ts            # Vite build configuration
    ├── index.html                # Application entry HTML template
    └── src/
        ├── App.tsx               # Master React Router component
        ├── main.tsx              # React DOM entrypoint
        ├── config/
        │   └── firebase.ts       # Client Firebase Auth initialization
        ├── components/
        │   └── ScreenLoader.tsx  # Smooth animated transition loader
        ├── pages/
        │   ├── Dashboard.tsx     # Student dashboard, tasks, & streak view
        │   ├── Leaderboard.tsx   # Global podium & cohort rankings view
        │   └── Login.tsx         # Email/password & Google login view
        └── services/
            ├── auth.ts           # Frontend auth service & API sync
            ├── leaderboard.ts    # Frontend leaderboard API client
            ├── streak.ts         # Frontend streak API client
            └── task.ts           # Frontend task management API client
```

---

## 16. Team Contributions

- **Backend Architecture & Streak Engine:** Designed pure calendar algorithm, date-specific task completion persistence, dual JWT/Firebase auth middleware, and Redis-cached leaderboard ranking services.
- **Database & Data Modeling:** Structured Prisma schema with composite constraints (`@@unique([userId, taskId, date])`), foreign keys, and indexes for optimized query performance.
- **Frontend & User Interface:** Built dynamic, responsive React 19 interface with Tailwind CSS 4, date selector, task management modals, streak badges, and cohort leaderboard podiums.
- **DevOps & Containerization:** Created Docker Compose multi-container setup with Nginx reverse proxy, automated health checks, and isolated service networks.
