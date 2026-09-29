# KIIT DSA Tracker & Leaderboard Platform - Setup & Deployment Guide

Welcome to the **Coding Ninjas KIIT Chapter DSA Tracker**! This guide details the complete production architecture, database setup, Google OAuth configuration, and admin management.

---

## 1. Project Structure (Contributing)

```
app/                     # Next.js App Router: routes, pages, API handlers
  page.tsx               # Landing page (static server component)
  dashboard/ leaderboard/ sheets/ profile/ admin/   # Authenticated pages
  api/                   # Route handlers (REST endpoints)
  layout.tsx             # Root layout: fonts, SEO metadata, navbar
  robots.ts sitemap.ts   # SEO route generators
  [slug]/ not-found.tsx  # Dynamic sheet route & themed 404
components/
  Navbar.tsx             # Global header + tab nav (client)
  dashboard/             # MetricCard, ProgressBar
  leaderboard/           # LeaderboardView (tabs/search) + Podium + StandingsTable
  sheets/                # SheetsView (filters) + QuestionsTable + SheetStandings
  profile/               # ProfileView + PlatformCard + AchievementsGrid
  admin/                 # AdminView (tabs) + one file per tab + two modals
lib/
  auth.ts prisma.ts      # Supabase session auth, Prisma singleton
  services/              # leaderboard.ts, sheets.ts, sync-engine.ts (business logic)
  scoring/               # Deterministic score calculators
  platform/              # Per-platform API providers + registry
  supabase/ validations/ utils.ts site.ts
prisma/                  # schema.prisma, seed.ts
```

**Conventions:** pages are server components that fetch data and pass it to a
single `*View` client container; interactive widgets live in feature folders.
Shared styling helpers live in `lib/utils.ts`; site metadata in `lib/site.ts`.

---

## 2. System Architecture Overview

- **Framework:** Next.js 15 (App Router with React 19, TypeScript, Tailwind CSS)
- **Database:** Supabase PostgreSQL (Managed PostgreSQL)
- **ORM:** Prisma 6 with pooled application connections and direct migration connections
- **Authentication:** Supabase Auth + Google OAuth with SSR cookie sessions (`@supabase/ssr`)
- **Institution Security:** Server-side domain restriction ensuring only `@kiit.ac.in` accounts can authenticate
- **Coding Platform:** LeetCode only — official GraphQL API (problem slugs, contest ratings, recent accepted submissions)
- **Scoring:** Fixed per difficulty — Easy **1 pt**, Medium **4 pts**, Hard **8 pts** (used identically by the global and per-sheet leaderboards)

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in the environment parameters:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Pooled PostgreSQL connection string (Transaction pooler on port 6543) | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Direct PostgreSQL connection string (Port 5432) | `postgresql://postgres.[ref]:[pass]@aws-0-[region].supabase.co:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://[project-ref].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anonymous Client Key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret | `eyJhbGciOi...` |
| `INSTITUTION_EMAIL_DOMAIN` | Allowed institutional email domain | `kiit.ac.in` |
| `ROLL_NUMBER_REGEX` | Configurable roll number regex pattern | `^([a-zA-Z0-9._-]+)` |
| `ROLL_NUMBER_CAPTURE_GROUP` | Regex capture group index | `1` |
| `CRON_SECRET` | Secret token for background sync cron jobs | `your-secure-cron-secret` |
| `LEETCODE_API_BASE_URL` | LeetCode GraphQL URL | `https://leetcode.com/graphql` |
| `PLATFORM_SYNC_MIN_INTERVAL_MINUTES` | Minimum interval between API syncs per user | `10` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL used for SEO metadata/sitemap | `https://your-production-domain.com` |

---

## 3. Supabase & Database Configuration

### Step 1: Run Database Schema Migrations
Deploy the Prisma schema into your Supabase PostgreSQL instance:

```bash
npx prisma db push
```
Or for migration tracking:
```bash
npx prisma migrate dev --name init
```

### Step 2: Seed Initial DSA Sheets and Scoring Rules
Run the seeding script to populate the curated sheets (*KIIT DSA 75* and *KIIT DSA 150*), canonical problems, and badges:

```bash
npx tsx prisma/seed.ts
```

### Step 3: Configure the Institution Email Domain Restriction in Supabase
Execute `prisma/migrations/supabase_auth_hook.sql` in the **Supabase SQL Editor**:

```sql
-- 1. Allowed domains table
CREATE TABLE IF NOT EXISTS public.allowed_email_domains (
    domain TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.allowed_email_domains (domain)
VALUES ('kiit.ac.in')
ON CONFLICT (domain) DO NOTHING;

-- 2. Trigger function to enforce domain restriction on auth.users
CREATE OR REPLACE FUNCTION public.check_institutional_email()
RETURNS TRIGGER AS $$
DECLARE
    email_domain TEXT;
    is_allowed BOOLEAN;
BEGIN
    email_domain := SUBSTRING(LOWER(NEW.email) FROM '@(.*)$');
    SELECT EXISTS(
        SELECT 1 FROM public.allowed_email_domains WHERE LOWER(domain) = email_domain
    ) INTO is_allowed;

    IF NOT is_allowed THEN
        RAISE EXCEPTION 'Access Denied: Only institutional emails ending in @% are allowed.', 
            (SELECT string_agg(domain, ', ') FROM public.allowed_email_domains);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_institutional_email ON auth.users;
CREATE TRIGGER tr_check_institutional_email
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.check_institutional_email();
```

---

## 4. Google Cloud Console & OAuth Setup

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project named **KIIT DSA Tracker**.
3. Under **APIs & Services > OAuth consent screen**:
   - User Type: **External** (or Internal if configured under KIIT Google Workspace)
   - App Name: `Coding Ninjas KIIT DSA Tracker`
   - User support email: `your-support@kiit.ac.in`
4. Under **Credentials > Create Credentials > OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
     - `https://your-production-domain.com`
     - `https://<your-supabase-project-id>.supabase.co`
   - **Authorized redirect URIs:**
     - `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`
5. Copy the generated **Client ID** and **Client Secret**.
6. In the Supabase Dashboard:
   - Go to **Authentication > Providers > Google**.
   - Enable Google provider, paste the Client ID & Secret, and Save.
   - Under **Authentication > URL Configuration**:
     - Site URL: `http://localhost:3000` (or your production URL)
     - Redirect URLs: `http://localhost:3000/auth/callback`, `https://your-production-domain.com/auth/callback`

---

## 5. Administrator Management

Administrator roles are stored securely in PostgreSQL (`public.profiles.role = 'ADMIN'`).
You can manage admins **either** from the Admin Panel UI (**Admin Panel → Admins & Roles**
tab: promote, demote, and delete users with last-admin protection), **or** directly with SQL
in the Supabase SQL Editor — both operate on the same `public.profiles` table.

### Promote a KIIT student to Administrator (SQL)

```sql
UPDATE public.profiles
SET role = 'ADMIN'
WHERE LOWER(email) = LOWER('admin.roll@kiit.ac.in');
```

> The user must have signed in at least once (their `profiles` row is auto-created on first
> login). If they haven't, ask them to log in first, or insert the row manually using their
> Supabase `auth.users.id`:
>
> ```sql
> INSERT INTO public.profiles (id, email, name, role)
> SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 'ADMIN'
> FROM auth.users
> WHERE LOWER(email) = LOWER('admin.roll@kiit.ac.in');
> ```

### Demote an administrator back to a regular user (SQL)

```sql
-- Check how many admins remain first - never demote your last admin!
SELECT id, email, name FROM public.profiles WHERE role = 'ADMIN';

UPDATE public.profiles
SET role = 'USER'
WHERE LOWER(email) = LOWER('someone@kiit.ac.in');
```

### Delete a user completely (SQL)

Deleting a profile cascades to their platform accounts, solved problems, snapshots and sync
logs. Also remove the Supabase auth user so they can't sign in again:

```sql
DELETE FROM public.profiles WHERE LOWER(email) = LOWER('leaver@kiit.ac.in');

-- Then in Supabase: Authentication -> Users -> select the user -> Delete user
-- (or run this with the service-role key via a script:
--   supabaseAdmin.auth.admin.deleteUser('<auth-user-id>') )
```

> The Admin Panel UI performs this same sequence automatically, including unlinking the
> Supabase auth user (requires `SUPABASE_SERVICE_ROLE_KEY` to be set).

### Inspect current administrators (SQL)

```sql
SELECT id, email, name, "rollNumber", role, "createdAt"
FROM public.profiles
WHERE role = 'ADMIN';
```

> **Safety rules enforced by the Admin Panel API:** you cannot demote or delete the last
> remaining administrator, and you cannot change your own role while signed in. When using
> raw SQL, keep at least one `ADMIN` row yourself.

---

## 6. Authentication Troubleshooting

If sign-in appears to fail, work through this checklist — the causes below cover all known
failure modes of the OAuth loop:

1. **Supabase env vars missing or server not restarted.** `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` are read **once at startup**. After editing `.env`, fully
   stop (`Ctrl+C`) and rerun `npm run dev`. The app now fails loudly (`config_error` banner
   on the landing page) instead of silently using placeholder credentials.
2. **Redirect URL mismatch.** In Supabase Dashboard → Authentication → URL Configuration,
   add exactly `http://localhost:3000/auth/callback` (and your production equivalent).
   A mismatch makes `exchangeCodeForSession` fail → `?error=auth_failed` banner.
3. **Wrong Google account.** The `hd=kiit.ac.in` OAuth hint only *prefilters* the Google
   chooser; users can still pick a personal Gmail account, which is rejected server-side →
   `?error=invalid_domain` banner. Sign in with your `@kiit.ac.in` account.
4. **Stale session cookies.** Before this fix, expired sessions were never refreshed and
   every protected page silently bounced to `/` with no message. The new `middleware.ts`
   refreshes the session on every request — if you upgrade from an older deployment,
   clear the site's cookies once (or sign in again) so fresh cookies get issued.
5. **Database unreachable.** If the profile upsert fails on login, you now get a
   `?error=db_error` banner; verify `DATABASE_URL` / `DIRECT_URL`.

Error codes shown in the landing-page banner: `invalid_domain`, `auth_failed`,
`config_error`, `missing_email`, `db_error`.

---

## 7. Background Scheduled Synchronization (Cron)

To keep platform statistics fresh across all verified accounts, set up a cron job targeting `/api/cron/sync` every 15-30 minutes:

```bash
# Example cURL request for Vercel Cron or GitHub Actions:
curl -X POST "https://your-domain.com/api/cron/sync" \
  -H "Authorization: Bearer your-secure-cron-secret"
```

---

## 8. Running the Project Locally

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Run tests
npm test

# Start Next.js Development Server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the dashboard!
