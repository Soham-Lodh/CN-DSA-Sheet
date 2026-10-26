import { unstable_cache, revalidateTag } from "next/cache";
import { SheetStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Server-side cache layer (see docs/implementation-audit.md, A8).
 *
 * - Built on Next.js `unstable_cache` (the Next 15 data cache), so cached
 *   entries survive across requests, cold starts within an instance, and are
 *   dropped/revalidated by explicit tags. No process-local Map participates
 *   in correctness — each instance's data cache is bounded by short TTLs for
 *   cross-instance consistency, and every write path invalidates post-commit.
 * - Personal data is keyed by the authenticated user id and tagged per user;
 *   it can never be served from another user's cache entry.
 * - TTL is a safety net only; all user-visible staleness is bounded by
 *   invalidation after the database commit.
 *
 * TTLs are configurable via env with conservative defaults and strict caps.
 */

function ttlFromEnv(name: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

export const TTL = {
  /** Published sheet/question catalogue metadata (public, stable). */
  sheetCatalogue: ttlFromEnv("CACHE_TTL_SHEET_CATALOGUE_SECONDS", 300, 3600),
  /** Computed per-sheet leaderboard rows (shared). */
  sheetLeaderboard: ttlFromEnv("CACHE_TTL_SHEET_LEADERBOARD_SECONDS", 30, 300),
  /** Global leaderboard (shared). */
  globalLeaderboard: ttlFromEnv("CACHE_TTL_GLOBAL_LEADERBOARD_SECONDS", 30, 300),
  /** Per-user sheet progress summaries (private). */
  userProgress: ttlFromEnv("CACHE_TTL_USER_PROGRESS_SECONDS", 10, 60),
  /** Per-user profile aggregation (dashboard metrics). */
  userProfile: ttlFromEnv("CACHE_TTL_USER_PROFILE_SECONDS", 10, 60),
  /** LeetCode POTD link (external, expensive). */
  potd: ttlFromEnv("CACHE_TTL_POTD_SECONDS", 1800, 43200),
} as const;

export const CACHE_TAGS = {
  sheetsCatalogue: "sheets:catalogue",
  sitemap: "sitemap",
  sheet: (slug: string) => `sheet:${slug}`,
  sheetLeaderboard: (slug: string) => `sheet-leaderboard:${slug}`,
  leaderboardGlobal: "leaderboard:global",
  userProgress: (userId: string) => `user:progress:${userId}`,
  userProfile: (userId: string) => `user:profile:${userId}`,
  potd: "potd:leetcode",
} as const;

/** Read-through cached loader. keyParts must fully determine the payload. */
export function cachedRead<T>(
  keyParts: readonly (string | number)[],
  tags: readonly string[],
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  let read: Promise<T>;
  try {
    read = unstable_cache(loader, keyParts.map(String), {
      revalidate: ttlSeconds,
      tags: [...tags],
    })();
  } catch {
    // No data cache in scope (scripts/tests, no Next.js request context):
    // the cache is a performance layer, never correctness — serve directly.
    return loader();
  }
  return read.catch((error: unknown) => {
    if (
      error instanceof Error &&
      /incrementalCache missing|unstable_cache/i.test(error.message)
    ) {
      // Same fallback for the async form of the invariant.
      return loader();
    }
    throw error;
  });
}

/** Post-commit invalidation. Never called before the transaction ends. */
export async function invalidateTags(tags: readonly string[]): Promise<void> {
  const unique = [...new Set(tags)];
  if (unique.length === 0) return;
  for (const tag of unique) {
    try {
      revalidateTag(tag);
    } catch (error) {
      // Never fabricate a mutation failure: the DB commit already happened.
      // Bounded TTLs on every tag keep staleness safe until reconciliation.
      console.error(`[cache] revalidateTag("${tag}") failed after commit`, error);
    }
  }
}

/** Cache tags to drop when a user's progress changes for the given sheet slugs. */
export function progressInvalidationTags(userId: string, sheetSlugs?: string[]): string[] {
  return [
    CACHE_TAGS.userProgress(userId),
    CACHE_TAGS.userProfile(userId),
    CACHE_TAGS.leaderboardGlobal, // per-sheet ticks don't change global aggregates, but profile sync does; cheap to keep consistent
    ...(sheetSlugs ?? []).flatMap((slug) => [CACHE_TAGS.sheet(slug), CACHE_TAGS.sheetLeaderboard(slug)]),
  ];
}

/** All published sheet slugs (cheap; used by sync invalidation paths). */
export async function publishedSheetSlugs(): Promise<string[]> {
  const sheets = await prisma.sheet.findMany({
    where: { status: SheetStatus.PUBLISHED },
    select: { slug: true },
  });
  return sheets.map((s) => s.slug);
}

/** Cache tag set to drop when platform sync changes a user's snapshot/solves. */
export async function syncInvalidationTags(userId: string): Promise<string[]> {
  const slugs = await publishedSheetSlugs();
  return [
    CACHE_TAGS.userProgress(userId),
    CACHE_TAGS.userProfile(userId),
    CACHE_TAGS.leaderboardGlobal,
    ...slugs.map((slug) => CACHE_TAGS.sheetLeaderboard(slug)),
    ...slugs.map((slug) => CACHE_TAGS.sheet(slug)),
  ];
}

/** Cache tag set to drop when sheet/question catalogue data changes (admin CRUD). */
export async function sheetCatalogueInvalidationTags(slug?: string): Promise<string[]> {
  const slugs = slug ? [slug] : await publishedSheetSlugs();
  return [
    CACHE_TAGS.sheetsCatalogue,
    CACHE_TAGS.sitemap,
    ...slugs.flatMap((s) => [CACHE_TAGS.sheet(s), CACHE_TAGS.sheetLeaderboard(s)]),
  ];
}
