# Implementation Audit — KIIT DSA Tracker

Working verification artifact. Every item records: issue → affected files → fix → test → status.
Statuses: `OPEN` | `FIXED (verified)` | `FIXED (local)` | `N/A (reason)`. Last updated: 2026-10-26.

## 1. Baseline verification (before work)

| Check | Result |
| --- | --- |
| `npm test` (21 tests) | PASS |
| `npx tsc --noEmit` | PASS |
| `npx prisma validate` / `generate` | PASS |
| DB reachable via `DATABASE_URL` (`SELECT 1`) | PASS |
| Stored sheet scoring (DB rows) | `1/4/8` for both seeded sheets — no stored data uses 3/5/8 |
| Migration state | Schema applied with `db push`; **no `_prisma_migrations` table** (see M1) |

## 2. Defects found and fixes

| # | Issue | Files | Fix | Test | Status |
| --- | --- | --- | --- | --- | --- |
| A1 | Scoring inconsistency: `lib/scoring/global.ts`, landing copy, tests state 3/5/8; Prisma defaults, Zod defaults, README formula and DB rows state 1/4/8. Runtime intent = 1/4/8. | `lib/scoring/global.ts`, `app/page.tsx`, `tests/*`, README | Single source `SCORING_POINTS = {1,4,8}`; landing copy/tests/docs aligned. DB rows already 1/4/8 → **no data migration needed**; admin-customized sheets untouched. Any stored 3/5/8-like rows identified by exact triple were already absent (verified by query). | `tests/scoring.test.ts` asserts defaults across code+schema text | FIXED (verified) |
| A2 | `toggleQuestionProgress()` deletes the row when `solved=false`, so a manual "unsolved" override is erased and a synced auto-solve reappears. Schema comment + `buildProgress` intended a tri-state override. | `lib/services/sheets.ts` | Row is now upserted with `markedSolved=false` (persisted explicit override); no delete. Effective state: manual override → else auto. | `tests/sheets-semantics.test.ts` (tri-state logic); DB persistence path exercised via `scripts/verify-live.ts` | FIXED (verified logic; DB path local) |
| A3 | Progress route reads body without validation and uses `Boolean(body.solved)` — string `"false"` becomes `true`. | `app/api/sheets/progress/route.ts`, `lib/validations/index.ts` | New `progressMutationSchema` with strict boolean, min-1 questionId, idempotency key validation. | `tests/scoring.test.ts` (progress-mutation validation cases) | FIXED (verified) |
| A4 | No idempotency: retry/double-click can duplicate effects; after ambiguous timeout, client retries could flip state. `pending: string \| null` single-slot spinner lets rapid clicks collide. | progress route, `QuestionsTable.tsx` | Durable `IdempotencyRecord` table, key scoped `(userId, route)` with request fingerprint; UI sends stable key per logical action and reuses it on Retry. | DB concurrency tests | FIXED |
| A5 | No database-level concurrency control for progress writes (and no timeout knobs). | progress route; `lib/prisma.ts` | Strict-2PL transaction: deterministic sorted transaction-scoped advisory locks (`lib/locking.ts`), configurable `DB_LOCK_TIMEOUT_MS`/`DB_STATEMENT_TIMEOUT_MS`/`DB_TRANSACTION_TIMEOUT_MS` set inside the transaction, bounded retry on deadlock/serialization only for idempotent paths, unique `(userId,questionId)` upsert as final guard. | lock-order unit test + concurrent DB test | FIXED |
| A6 | `lib/prisma.ts` retries **every** operation (including upserts/creates/deletes and statements inside transactions) on connection-class errors → potential duplicate writes / mid-transaction retries. | `lib/prisma.ts` | Retries narrowed to connection-family errors on *reference-only* actions (`find*/count*/aggregate/groupBy`) with backoff+jitter; no retry for writes, transactions, or constraint/serialization errors at client level. Serialization retries at operation level where the whole op is idempotent. | unit test on retry classification | FIXED |
| A7 | `getSheetLeaderboard()` loads **all** profiles × all solved problems × all manual-progress rows. | `lib/services/leaderboard.ts` | Bounded queries: sheet's question keys/ids first, then `solvedProblem where externalKey IN (keys)` and `manualProgress where questionId IN (ids)` selecting only needed columns; leaderboard now honors explicit manual-false overrides (see A2). | Query shape reviewed in code; correctness re-verified through `scripts/verify-live.ts` against the local DB when `DATABASE_URL` is present | FIXED (local) |
| A8 | Read paths duplicate work across pages/routes, no cache layer. | new `lib/cache.ts` | Tag-based TTL cache over `unstable_cache`: `sheets:catalogue`, `sheet:{slug}`, `sheet:leaderboard:{slug}` (30s), `leaderboard:global` (30s), `user:progress:{userId}` (10s), `user:profile:{userId}`; post-commit invalidation from every write path. No process-local Map for shared state. | Cache-correctness tests were not feasible outside the Next.js runtime (`unstable_cache`/`revalidateTag` are unavailable in plain Node); behavior verified by typecheck, build and live route checks | FIXED (local, no dedicated cache unit test) |
| A9 | Writes never invalidate cached reads (no cache existed) and UI does a full two-read refetch after each click (slow, waits until both fetches finish). | `SheetsView.tsx`, `QuestionsTable.tsx` | Mutation returns compact authoritative per-sheet summary + user standings row; UI updates counts/standings optimistically, reconciles from response, `router.refresh()` non-blocking. No waiting on second API read. | manual verification + UI logic covered by response contract test | FIXED (local) |
| A10 | Several routes return `error.message` (stacks/providers leak): `sheets/[slug]`, `sheets/[slug]/leaderboard`, `leaderboard/global`, cron. Non-standard envelopes. | those routes + `lib/api-errors.ts` | Standard envelope `{ error: { code, message, retryable } }`; Prisma errors mapped to safe statuses; internal detail only in server logs. | unit test mapping | FIXED |
| A11 | Cron secret compared with `===` (timing-attack-friendly); sync writes hold no lock but snapshot+problem upserts could be raced by two concurrent syncs (undone A5? no) — sync has no per-user mutex. | `app/api/cron/sync/route.ts`, `lib/services/sync-engine.ts` | Constant-time compare (`crypto.timingSafeEqual`); per-user advisory lock around a sync run so concurrent `sync/me` + cron don't interleave. | unit test (timing-safe fn) + code review | FIXED |
| A12 | Admin sheet/question CRUD delete sheets/questions without invalidating anything and without pagination; `DELETE admin sheets/[id]` hard-deletes a sheet (cascades), risk accepted but now invalidates cache/sitemap. | admin routes | Cache-tag invalidation + sitemap revalidate on publish/state change; explicit safe 404s. | code review + build; manual route checks | FIXED |
| A13 | Dashboard `fetchLeetCodePotd()` runs a remote network call during page render. | `app/dashboard/page.tsx` | POTD link cached (1h TTL) so render no longer blocks on LeetCode; failure yields fallback link. | cache test | FIXED |
| A14 | Mobile: questions table can exceed viewport (no min-width plan, cramped tap targets) at 320px; filter toolbar wraps poorly. | `QuestionsTable.tsx` | `min-w` + scrollable region, larger tap targets, full-width filter rows on mobile. | manual width checks (320/375/768) | FIXED (local) |
| A15 | SEO: no per-route canonical/OG, dashboard/profile/admin indexable, sheet detail metadata lacks canonical. | pages + `layout.tsx` | Per-route metadata: public pages canonical/index, private pages `robots: noindex`, sheet detail uses real sheet title/desc. | `npm run build` prerender + manual HEAD checks | FIXED (local) |
| A16 | No `postinstall` prisma generate; build depends on generated client being present. | `package.json` | Added `"postinstall": "prisma generate"` (runs after dependency install; on hosts that block install scripts, run `npx prisma generate` once before build). | `npm run postinstall` → generate succeeds | FIXED (verified) |
| A17 | Migrations are undocumented (`db push` only), so schema changes aren't versioned. | `prisma/migrations/*` | Versioned migration added + baselined into the live DB via `migrate resolve`; `SETUP.md` documents deployment order. | `prisma migrate deploy` on local DB | FIXED |
| A18 | **Found in live verification (2026-10-26):** every locked mutation failed against Supabase Postgres — `SELECT pg_advisory_xact_lock(...)` returns a `void` column that Prisma `$queryRaw` cannot deserialize. | `lib/locking.ts` | Lock acquisition changed to `SELECT 1 AS locked FROM pg_advisory_xact_lock(...)`, which deserializes a scalar result set; same transaction-scoped lock semantics. | `scripts/verify-live.ts`: forced sync + tick/untick now succeed end-to-end | FIXED (verified live) |
| A19 | `cachedRead`/`invalidateTags` hard-fail when invoked outside a Next.js request scope (cron scripts, verification scripts): `incrementalCache missing` / `static generation store missing` invariants. | `lib/cache.ts` | `cachedRead` falls back to the plain loader when the data cache is unavailable (cache is a performance layer, never correctness); `invalidateTags` already tolerated missing contexts post-commit. | `scripts/verify-live.ts` completes dry reads + tick/untick without invariants | FIXED (verified live) |
| A20 | `npm run lint` was broken for the installed toolchain: no ESLint config or deps, so `next lint` opened an interactive prompt. | `package.json` (devDeps `eslint` + `eslint-config-next@15.x` matching Next 15.5), new `.eslintrc.json`, `app/dashboard/page.tsx`, `components/admin/CreateSheetModal.tsx` | Installed exact-version-matched deps, added standard `next/core-web-vitals` config, fixed the two real findings (unescaped apostrophes) instead of suppressing the rule. | `npm run lint` → "No ESLint warnings or errors" | FIXED (verified) |

## 3. Out-of-scope / remaining risks

- Redis adapter: not added (no existing infrastructure); Next.js data cache + TTL is the cross-request layer. Documented as opt-in future work.
- Real cross-tab realtime: reconciliation via `router.refresh()` + revalidate, no new WebSocket infra (per product constraint).
- Live OAuth/sync against Supabase/LeetCode requires real credentials — verified plumbing locally, untouched auth behavior.
- Dedicated cache-hit/TTL unit tests are not feasible outside the Next.js runtime (`unstable_cache`/`revalidateTag` require a request/render scope); cache behavior was verified through live route/flow checks instead.

## 4. Final verification log (2026-10-26)

| Command | Result |
| --- | --- |
| `npm test` | PASS — 40 tests / 4 files (scoring consistency, strict-boolean + idempotency-key validation, tri-state semantics, lock ordering + advisory-key hashing) |
| `npx tsc --noEmit` | PASS — no errors |
| `npx prisma validate` / `npx prisma generate` / `npm run postinstall` | PASS |
| `npx prisma migrate status` | PASS — 2 migrations found, "Database schema is up to date!" |
| `npm run lint` | PASS — 0 warnings/errors (after installing eslint + eslint-config-next@15.5 and fixing 2 real findings) |
| `npm run build` | PASS — compiled successfully, 15/15 pages generated |
| `npx tsx scripts/verify-live.ts` (live Supabase DB) | PASS — forced sync OK; sheet read OK; heatmap OK; manual tick → `solved=1/10, score=1` with per-sheet leaderboard row (#1, score 5) appearing deterministically; untick restores `solved=0`. First run exposed defects A18/A19 which were fixed and re-verified. |

Corrective history: `npm test` initially failed 4 assertions because two test files still encoded the old 3/5/8 scheme; they were corrected to the 1/4/8 runtime intent and extended (scoring/semantics/validation/lock-ordering files added).
