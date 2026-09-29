/**
 * Live check: forced sync (fetches LeetCode submissionCalendar), heatmap data,
 * sheet progress (auto + manual), and leaderboards.
 * Run: npx tsx scripts/verify-live.ts <email> [leetcode-handle]
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

function loadEnvFile() {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    console.error("Could not read .env - run from the project root.");
  }
}
loadEnvFile();

const baseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || "";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        baseUrl +
        (/[?&]connection_limit=/.test(baseUrl)
          ? ""
          : baseUrl.includes("?")
            ? "&connection_limit=1"
            : "?connection_limit=1"),
    },
  },
});

async function main() {
  const email = process.argv[2];
  const profile = await prisma.profile.findFirst({
    where: email ? { email } : undefined,
    include: { platformAccount: true, snapshots: true },
  });
  if (!profile) {
    console.log("No profile found");
    return;
  }

  console.log(`profile: ${profile.email} role=${profile.role}`);

  if (!profile.platformAccount && process.argv[3]) {
    const handle = process.argv[3];
    console.log(`connecting ${handle}...`);
    const { getProvider } = await import("../lib/platform/registry");
    const v = await getProvider().validateUsername(handle);
    if (!v.valid) {
      console.log(`validation failed: ${v.error}`);
      return;
    }
    await prisma.platformAccount.upsert({
      where: { userId: profile.id },
      create: { userId: profile.id, username: v.username, normalizedUsername: v.normalizedUsername },
      update: { username: v.username, normalizedUsername: v.normalizedUsername },
    });
  }

  process.stdout.write("forced sync... ");
  const { syncUserPlatformAccount } = await import("../lib/services/sync-engine");
  const started = Date.now();
  const result = await syncUserPlatformAccount(profile.id, true);
  console.log(`${result.status} records=${result.recordsProcessed} in ${Date.now() - started}ms${result.error ? ` err=${result.error.slice(0, 200)}` : ""}`);

  const snapshot = await prisma.platformSnapshot.findUnique({ where: { userId: profile.id } });
  const meta = snapshot?.rawMetadata as { submissionCalendar?: Record<string, number> } | null;
  const calSize = meta?.submissionCalendar ? Object.keys(meta.submissionCalendar).length : 0;
  console.log(`snapshot: total=${snapshot?.totalSolved} e=${snapshot?.easySolved} m=${snapshot?.mediumSolved} h=${snapshot?.hardSolved} calendarDays=${calSize}`);

  const { getCombinedActivity } = await import("../lib/services/activity");
  const activity = await getCombinedActivity(profile.id);
  const sample = activity.days.filter((d) => d.count > 0).slice(-8);
  console.log(`heatmap: activeDays=${activity.activeDays} total=${activity.totalSubmissions} streak=${activity.currentStreak} longest=${activity.longestStreak}`);
  console.log(`  recent active days: ${sample.map((d) => `${d.date}=${d.count}`).join(", ")}`);

  const { getSheetWithUserProgress, toggleQuestionProgress } = await import("../lib/services/sheets");
  const sheet = await prisma.sheet.findFirst({ orderBy: { createdAt: "asc" } });
  if (sheet) {
    const progress = await getSheetWithUserProgress(sheet.slug, profile.id);
    console.log(`\nsheet "${progress?.sheet.name}": solved=${progress?.solvedQuestions}/${progress?.totalQuestions} score=${progress?.score}`);

    // Manual tick round-trip test on the first question.
    const q = progress?.questions[0];
    if (q) {
      console.log(`manual tick test on "${q.title}":`);
      await toggleQuestionProgress(profile.id, q.id, true);
      const after = await getSheetWithUserProgress(sheet.slug, profile.id);
      console.log(`  after tick: solved=${after?.solvedQuestions} (score=${after?.score})`);
      const { getSheetLeaderboard } = await import("../lib/services/leaderboard");
      const rows = await getSheetLeaderboard(sheet.id);
      console.log(`  sheet leaderboard rows: ${rows.length} ${rows[0] ? `-> #${rows[0].rank} ${rows[0].name} solved=${rows[0].totalSheetSolved} score=${rows[0].score}` : ""}`);
      // Untick to restore state.
      await toggleQuestionProgress(profile.id, q.id, false);
      const restored = await getSheetWithUserProgress(sheet.slug, profile.id);
      console.log(`  after untick (restored): solved=${restored?.solvedQuestions}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("verify-live failed:", String(e?.message || e).slice(0, 600));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
