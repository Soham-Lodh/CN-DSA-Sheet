# 🚀 Coding Ninjas KIIT Chapter — DSA Tracker & Leaderboard Platform

[![Next.js](https://img.shields.io/badge/Next.js-15.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20Auth-3ECF8E?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-5.0-FCC72B?logo=vitest)](https://vitest.dev/)

An enterprise-grade competitive programming tracker and curated Data Structures & Algorithms sheet platform designed exclusively for **KIIT University** students, built and maintained by the **Coding Ninjas KIIT Chapter**.

The platform automates DSA problem verification through direct LeetCode GraphQL synchronization, enforces institutional authentication via `@kiit.ac.in` domain policies, manages dynamic global and per-sheet competitive leaderboards, visualizes submission heatmaps, and provides a comprehensive administrative control center.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Deterministic Scoring System](#-deterministic-scoring-system)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Database Setup & Seeding](#database-setup--seeding)
  - [Supabase Auth & Institutional Gate](#supabase-auth--institutional-gate)
- [Available Scripts](#-available-scripts)
- [Environment Variables](#-environment-variables)
- [Database Schema & Models](#-database-schema--models)
- [API Route Reference](#-api-route-reference)
- [Administrative Management](#-administrative-management)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)
- [Contributing & Community](#-contributing--community)

---

## ✨ Key Features

### 1. ⚡ Automated LeetCode Synchronization

- **Direct GraphQL Ingestion:** Ingests verified accepted submissions, difficulty distributions, and contest ratings directly from LeetCode’s official GraphQL API.
- **Zero Manual Fraud:** Curated sheet problems are automatically ticked when an accepted solution is verified in the student's submission history.
- **Manual Toggle Override:** Students can flag questions as solved manually with visual badges indicating verification status.
- **Rate-Limit & Anti-Abuse Protection:** Enforces minimum synchronization intervals (`PLATFORM_SYNC_MIN_INTERVAL_MINUTES`) with full audit logging in `SyncLog`.

### 2. 🏆 Dynamic Leaderboards & Standings

- **Deterministic Difficulty Scoring:** Uniform formula — **Easy (1 pt)**, **Medium (4 pts)**, **Hard (8 pts)**.
- **Dual-Mode Leaderboards:**
  - **Global Leaderboard:** All-time university-wide rankings across all LeetCode activity.
  - **Per-Sheet Leaderboards:** Dedicated standings filtered strictly by curated sheet problems (e.g. _KIIT DSA 75_, _KIIT DSA 150_).
- **Podium & Search:** Visual podium for top 3 rankers, real-time search by name or roll number, and instant pagination.

### 3. 📚 Curated DSA Sheets

- Pre-populated industry-standard tracks:
  - **KIIT DSA 75:** High-frequency interview foundation problems.
  - **KIIT DSA 150:** Advanced interview preparation for tier-1 product companies.
- Filter by topic (Arrays, Strings, Trees, Graphs, DP, etc.), difficulty, and completion status.
- Per-sheet live progress bars with solve counts and point tallies.

### 4. 🔒 Institutional Security & Domain Gating

- **Google OAuth Restriction:** Strictly enforces `@kiit.ac.in` domain access at multiple defense layers:
  - Google OAuth consent screen & `hd=kiit.ac.in` domain hint.
  - Server-side email validation on callback.
  - PostgreSQL trigger function on `auth.users` rejecting unauthorized domains before persistence.
- **Roll Number Extraction:** Automatically extracts university roll numbers from institutional emails using regex capture groups.

### 5. 📈 Student Profiles & Analytics

- Complete difficulty breakdowns (Easy / Medium / Hard counts).
- **GitHub-style Activity Heatmap:** Calendar-based submission density visualization.
- **Achievement Badges:** Automated milestones (e.g., First Solved, 10 Solved, 25 Solved, 50 Solved, 75 Master, 100 Solved, 150 Legend).
- Contest ratings, global rankings, and linked platform credentials.

### 6. 🛠️ Comprehensive Admin Control Center

- **Sheet Management:** Create, publish, draft, or archive sheets with custom point configurations.
- **Question Manager & URL Parser:** Add questions by simply pasting a LeetCode URL — automatic metadata extraction (slug, title, difficulty, topic tags).
- **Accounts Audit:** Review connected student handles, verification status, and recent errors.
- **Role Governance:** Promote or demote administrators with fail-safe protection preventing accidental lockout of the last admin.
- **Manual Sync Engine:** Trigger university-wide batch sync jobs on demand.

### 7. ⏱️ Scheduled Background Synchronization

- Dedicated `/api/cron/sync` route secured with `CRON_SECRET` for periodic execution via Vercel Cron, GitHub Actions, or external schedulers.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    User([Student / Admin]) -->|Google OAuth @kiit.ac.in| Auth[Supabase Auth SSR]
    Auth -->|Session Cookie| Middleware[Next.js Middleware & Route Handlers]
    Middleware --> App[Next.js 15 App Router]

    subgraph Core App
        App --> Dashboard[Dashboard & Profile]
        App --> Leaderboards[Global & Sheet Standings]
        App --> Sheets[Curated DSA Sheets]
        App --> Admin[Admin Control Center]
    end

    subgraph Data & Sync Layer
        Sync[Sync Engine / Cron] -->|Fetch Solved Problems| LC[(LeetCode GraphQL API)]
        App -->|ORM Queries| Prisma[Prisma ORM 6]
        Prisma -->|Pooled & Direct Connections| DB[(Supabase PostgreSQL)]
        Sync --> Prisma
    end

    subgraph Security Layer
        DB --- Trigger[PostgreSQL Institutional Email Gate]
    end
```

---

## 💻 Tech Stack

| Layer            | Technology                                                                    | Details                                                   |
| :--------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------------- |
| **Framework**    | [Next.js 15 (App Router)](https://nextjs.org/)                                | Server Components, Route Handlers, Streaming SSR          |
| **Language**     | [TypeScript 5.7](https://www.typescriptlang.org/)                             | Strict type-safety across client and server               |
| **UI & Styling** | [React 19](https://react.dev/) + [Tailwind CSS 3.4](https://tailwindcss.com/) | Custom dark glassmorphic UI, responsive layouts           |
| **Icons**        | [Lucide React](https://lucide.dev/)                                           | Clean, accessible iconography                             |
| **ORM**          | [Prisma 6.4](https://www.prisma.io/)                                          | Type-safe queries, migrations, relation mapping           |
| **Database**     | [PostgreSQL (Supabase)](https://supabase.com/)                                | Transaction pooler (port 6543) & Direct connection (5432) |
| **Auth**         | [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)      | Google OAuth, secure HTTP-only cookie sessions            |
| **Validation**   | [Zod 4](https://zod.dev/)                                                     | Request body, query param, and environment validation     |
| **External API** | [LeetCode GraphQL](https://leetcode.com/graphql)                              | Real-time problem stats and accepted submission logs      |
| **Testing**      | [Vitest 5.0](https://vitest.dev/)                                             | Unit tests and external platform provider test suites     |

---

## 📁 Repository Structure

```
.
├── app/                           # Next.js 15 App Router
│   ├── admin/                     # Administrative management portal
│   ├── api/                       # REST API route handlers
│   │   ├── admin/                 # Admin operations (sheets, questions, roles, sync)
│   │   ├── cron/sync/             # Background scheduled synchronization
│   │   ├── leaderboard/           # Global and sheet-specific leaderboard data
│   │   ├── profile/               # Student profile and platform linkage
│   │   ├── sheets/                # Sheets listing, progress tracking & questions
│   │   └── sync/me/               # On-demand user sync
│   ├── auth/callback/             # Supabase Google OAuth callback handler
│   ├── dashboard/                 # Student dashboard (stats, overview, recent solves)
│   ├── leaderboard/               # University leaderboard page
│   ├── profile/                   # Student profile, activity heatmap & achievements
│   ├── sheets/                    # Curated sheets & dynamic sheet view ([slug])
│   ├── globals.css                # Global CSS styles & glassmorphic classes
│   ├── layout.tsx                 # Root layout with fonts, metadata & Navbar
│   ├── page.tsx                   # Public landing page with institutional login
│   ├── robots.ts & sitemap.ts     # SEO and sitemap routes
│   └── not-found.tsx              # Themed 404 handler
├── components/                    # React client and server components
│   ├── activity/                  # Submission heatmap calendar
│   ├── admin/                     # Admin tab views (Overview, Questions, Sheets, Accounts, Admins)
│   ├── dashboard/                 # MetricCard, ProgressBar
│   ├── home/                      # Landing hero & SignInPanel
│   ├── leaderboard/               # LeaderboardView, Podium, StandingsTable
│   ├── profile/                   # ProfileView, PlatformCard, AchievementsGrid
│   ├── sheets/                    # SheetsView, QuestionsTable, SheetStandings
│   ├── Navbar.tsx                 # Global navigation & session state
│   └── UserAvatar.tsx             # Profile avatar component
├── lib/                           # Core utilities and business logic
│   ├── auth.ts                    # Supabase SSR auth helpers & roll number parser
│   ├── prisma.ts                  # PrismaClient singleton with pooled connection
│   ├── site.ts                    # Site configuration and branding metadata
│   ├── utils.ts                   # Tailwind merge and styling utilities
│   ├── platform/                  # LeetCode provider, URL parser & provider registry
│   ├── scoring/                   # Deterministic score calculator & defaults
│   ├── services/                  # Business logic (sync-engine, leaderboard, sheets, activity)
│   ├── supabase/                  # Supabase browser/server clients and env guard
│   └── validations/               # Zod validation schemas
├── prisma/
│   ├── schema.prisma              # Database schema definitions
│   └── seed.ts                    # Initial seed data (sheets, questions, badges)
├── scripts/                       # Maintenance and verification scripts
│   ├── db-inspect.ts              # Read-only database audit snapshot
│   ├── fix-auth-trigger.ts        # Idempotent repair for domain auth trigger
│   └── verify-live.ts             # Live end-to-end sync verification CLI
├── tests/                         # Vitest test suites
│   ├── providers.test.ts          # LeetCode GraphQL provider tests
│   └── unit.test.ts               # Scoring, regex, and URL parser unit tests
├── SETUP.md                       # Comprehensive deployment and infrastructure guide
└── package.json                   # Project metadata and dependencies
```

---

## 🎯 Deterministic Scoring System

To ensure fair competition across the university without inflation, the platform uses a deterministic difficulty-based scoring engine:

$$\text{Total Score} = (N_{\text{Easy}} \times 1) + (N_{\text{Medium}} \times 4) + (N_{\text{Hard}} \times 8)$$

- **Easy Problems:** `1 Point`
- **Medium Problems:** `4 Points`
- **Hard Problems:** `8 Points`

Sheets can optionally define custom point weights, but the standard 1/4/8 configuration is adopted by default across all KIIT leaderboards.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** `v18.18.0` or higher (Node 20+ recommended)
- **Package Manager:** `npm`, `pnpm`, or `yarn`
- **Database:** A [Supabase](https://supabase.com/) PostgreSQL database (or any PostgreSQL instance)
- **Google Cloud Console:** Configured OAuth 2.0 Web Client credentials

---

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-org/CN-DSA-Sheet.git
   cd CN-DSA-Sheet
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

---

### Environment Configuration

Create a `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Populate the required credentials in `.env`:

```env
# Database Connection (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].supabase.co:5432/postgres"

# Supabase Auth & Storage
NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# Institution Domain & Security
INSTITUTION_EMAIL_DOMAIN="kiit.ac.in"
ROLL_NUMBER_REGEX="^([a-zA-Z0-9._-]+)"
ROLL_NUMBER_CAPTURE_GROUP=1

# Background Synchronization Cron
CRON_SECRET="your-secure-cron-secret-token"

# Coding Platform Integration
LEETCODE_API_BASE_URL="https://leetcode.com/graphql"
PLATFORM_SYNC_MIN_INTERVAL_MINUTES=10
```

---

### Database Setup & Seeding

1. **Push the Prisma schema to the database:**

   ```bash
   npx prisma db push
   ```

   _(Or generate a migration with `npx prisma migrate dev --name init`)_

2. **Generate the Prisma Client:**

   ```bash
   npx prisma generate
   ```

3. **Seed initial DSA sheets, canonical questions, and achievement badges:**
   ```bash
   npm run db:seed
   ```

---

### Supabase Auth & Institutional Gate

1. **Configure Google OAuth in Google Cloud Console:**
   - **Authorized JavaScript origins:** `http://localhost:3000`, `https://your-domain.com`
   - **Authorized redirect URI:** `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`

2. **Enable Google Provider in Supabase Dashboard:**
   - Navigate to **Authentication → Providers → Google**.
   - Input your Google **Client ID** and **Client Secret**.
   - Under **URL Configuration**, set Site URL to `http://localhost:3000` and Redirect URLs to:
     - `http://localhost:3000/auth/callback`
     - `https://your-production-domain.com/auth/callback`

3. **Install the Institutional Domain Security Trigger:**
   Run the automated database setup script:

   ```bash
   npx tsx scripts/fix-auth-trigger.ts
   ```

   _(This ensures only users with `@kiit.ac.in` email addresses can create an account in Supabase)._

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📜 Available Scripts

| Script        | Command                                           | Purpose                                                                 |
| :------------ | :------------------------------------------------ | :---------------------------------------------------------------------- |
| `dev`         | `npm run dev`                                     | Starts the Next.js local development server on port 3000                |
| `build`       | `npm run build`                                   | Builds the optimized production application                             |
| `start`       | `npm run start`                                   | Starts the Next.js production server                                    |
| `lint`        | `npm run lint`                                    | Runs Next.js ESLint checks                                              |
| `test`        | `npm test`                                        | Runs all Vitest test suites                                             |
| `db:seed`     | `npm run db:seed`                                 | Populates initial sheets, badges, and problems into the database        |
| `verify-live` | `npx tsx scripts/verify-live.ts <email> [handle]` | Tests live LeetCode sync, heatmap parsing, and leaderboard scoring      |
| `fix-trigger` | `npx tsx scripts/fix-auth-trigger.ts`             | Sets up the `@kiit.ac.in` domain security trigger in Supabase           |
| `db-inspect`  | `npx tsx scripts/db-inspect.ts`                   | Outputs a safe diagnostic snapshot of current database rows & sync logs |

---

## ⚙️ Environment Variables

| Variable                             | Required | Description                                                    | Example                                                                               |
| :----------------------------------- | :------: | :------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| `DATABASE_URL`                       | **Yes**  | Transaction-pooled PostgreSQL connection URL (port 6543)       | `postgresql://postgres.[ref]:[pass]@pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL`                         | **Yes**  | Direct PostgreSQL connection string for migrations (port 5432) | `postgresql://postgres.[ref]:[pass]@supabase.co:5432/postgres`                        |
| `NEXT_PUBLIC_SUPABASE_URL`           | **Yes**  | Your Supabase project URL                                      | `https://xyzcompany.supabase.co`                                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | **Yes**  | Supabase public anonymous API key                              | `eyJhbGciOi...`                                                                       |
| `SUPABASE_SERVICE_ROLE_KEY`          | **Yes**  | Supabase service-role secret (server-only)                     | `eyJhbGciOi...`                                                                       |
| `INSTITUTION_EMAIL_DOMAIN`           | **Yes**  | Required domain for student authentication                     | `kiit.ac.in`                                                                          |
| `ROLL_NUMBER_REGEX`                  |    No    | Regex to capture student roll number from email                | `^([a-zA-Z0-9._-]+)`                                                                  |
| `ROLL_NUMBER_CAPTURE_GROUP`          |    No    | Capture group index in regex                                   | `1`                                                                                   |
| `CRON_SECRET`                        | **Yes**  | Bearer secret for `/api/cron/sync` trigger                     | `secure-cron-token-here`                                                              |
| `LEETCODE_API_BASE_URL`              |    No    | LeetCode GraphQL API endpoint                                  | `https://leetcode.com/graphql`                                                        |
| `PLATFORM_SYNC_MIN_INTERVAL_MINUTES` |    No    | Minimum minutes required between sync attempts                 | `10`                                                                                  |
| `NEXT_PUBLIC_SITE_URL`               |    No    | Canonical production site URL                                  | `https://cn-dsa.kiit.ac.in`                                                           |

---

## 🗄️ Database Schema & Models

```
┌─────────────┐       1:1       ┌─────────────────┐
│   Profile   ├─────────────────┤ PlatformAccount │
└──────┬──────┘                 └─────────────────┘
       │
       │ 1:1                     ┌──────────────────┐
       ├─────────────────────────┤ PlatformSnapshot │
       │                         └──────────────────┘
       │ 1:N                     ┌───────────────┐
       ├─────────────────────────┤ SolvedProblem │
       │                         └───────┬───────┘
       │ 1:N                             │ (externalKey match)
       ├─────────────────────────┐       ▼
       │                         │ ┌──────────────┐
       │ 1:N                     │ │   Question   │
       ├──────────────┐          │ └──────┬───────┘
       │              │          │        │
       ▼              ▼          │        │ N:M (via SheetQuestion)
┌────────────┐  ┌─────────────┐  │        ▼
│  SyncLog   │  │ Sheet (M:N) ├──┼──>┌──────────────┐
└────────────┘  └─────────────┘  │   │    Sheet     │
                                 │   └──────────────┘
                                 │
                                 │ 1:N ┌────────────────┐
                                 └────>│ ManualProgress │
                                       └────────────────┘
```

- **`Profile`:** Student records created on first Google OAuth login. Stores institutional email, name, avatar, extracted roll number, and role (`USER` | `ADMIN`).
- **`PlatformAccount`:** Linked LeetCode handle, verification state (`PENDING`, `VERIFIED`, `REJECTED`), and last sync timestamp.
- **`PlatformSnapshot`:** High-level cached statistics: total solved, easy/medium/hard solved, contest rating, and rank.
- **`SolvedProblem`:** Canonical solve records deduplicated by problem slug (`externalKey`, e.g. `leetcode:two-sum`).
- **`Sheet` & `Question`:** Curated sheets and questions linked via `SheetQuestion` with sequential ordering (`position`).
- **`ManualProgress`:** Student manual checkbox overrides with solve timestamps.
- **`Achievement` & `UserAchievement`:** Unlockable milestone badges with threshold logic.
- **`SyncLog`:** Audit log of synchronization runs, status, processed counts, and error telemetry.

---

## 🛣️ API Route Reference

### Student & Public Endpoints

- `GET /api/leaderboard/global` — Returns global standings, total solves, scores, and podium rankers.
- `GET /api/sheets` — Lists all published sheets with metadata and question counts.
- `GET /api/sheets/[slug]` — Details of a specific sheet, questions, and authenticated user progress.
- `GET /api/sheets/[slug]/leaderboard` — Dedicated standings for a single sheet.
- `POST /api/sheets/progress` — Manually toggle question completion state.
- `GET /api/profile` — Retrieves the authenticated student's profile, snapshots, and badges.
- `POST /api/profile/platforms` — Connects or updates a student's LeetCode username.
- `POST /api/sync/me` — Triggers an on-demand sync for the authenticated user's LeetCode account.

### Administrative Endpoints (`Role: ADMIN`)

- `GET /api/admin/overview` — System metrics (total students, active accounts, sync failure counts).
- `GET /api/admin/sheets` & `POST /api/admin/sheets` — List, create, and configure sheets.
- `PUT /api/admin/sheets/[id]` & `DELETE /api/admin/sheets/[id]` — Update sheet metadata and remove sheets.
- `GET /api/admin/questions` & `POST /api/admin/questions` — Manage problem repository.
- `POST /api/admin/questions/parse-url` — Extracts metadata from any LeetCode problem URL.
- `GET /api/admin/platform-accounts` — Audit all student platform accounts.
- `GET /api/admin/admins` & `POST /api/admin/admins` — Promote/demote administrators safely.
- `POST /api/admin/sync` — Execute a batch synchronization for all accounts.

### Cron Endpoint

- `POST /api/cron/sync` — Header: `Authorization: Bearer <CRON_SECRET>`. Synchronizes stale student accounts in batches.

---

## 🛡️ Administrative Management

Administrators can be managed directly via the **Admin Portal** (`/admin → Admins & Roles`) or via PostgreSQL queries in the Supabase SQL Editor.

### Safety Guards Enforced

- **Last-Admin Protection:** The API strictly blocks demoting or deleting the last remaining administrator.
- **Self-Demotion Prevention:** An active administrator cannot demote themselves while signed in.

### Promote a Student to Admin (SQL)

```sql
UPDATE public.profiles
SET role = 'ADMIN'
WHERE LOWER(email) = LOWER('student.roll@kiit.ac.in');
```

### Demote an Admin (SQL)

```sql
UPDATE public.profiles
SET role = 'USER'
WHERE LOWER(email) = LOWER('former.admin@kiit.ac.in');
```

---

## ❓ Troubleshooting & FAQs

### 1. "Access Denied: Only institutional emails ending in @kiit.ac.in are allowed"

Ensure you are signing in with your official KIIT Google Workspace account (`@kiit.ac.in`). Personal Gmail accounts (`@gmail.com`) are rejected at the database level by the institutional trigger.

### 2. "Database error saving new user" on first Google Login

Run the trigger fix script to ensure the `allowed_email_domains` table is populated and readable by the Supabase auth service:

```bash
npx tsx scripts/fix-auth-trigger.ts
```

### 3. LeetCode account connection fails

- Verify that your LeetCode username is spelled correctly and that your profile is public.
- Ensure the minimum sync cooldown has passed before re-triggering (`PLATFORM_SYNC_MIN_INTERVAL_MINUTES`).

### 4. Running tests on Windows PowerShell

If `npm test` encounters a script execution policy error on Windows (`PSSecurityException`), run:

```powershell
npm.cmd test
```

---

## 🤝 Contributing & Community

Contributions from KIIT students and Coding Ninjas Chapter members are warmly welcomed!

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`).
4. Run tests to ensure everything passes (`npm test`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

---

## 📄 License

Maintained with ❤️ by the **Coding Ninjas KIIT Chapter**. Built for the students of **Kalinga Institute of Industrial Technology (KIIT)**.
