/**
 * Read-only snapshot of everything relevant to "nothing is being stored":
 * profiles+roles, the LeetCode account, sheets, questions, sync logs (with the
 * exact error messages). Prints no credentials.
 * Run: npx tsx scripts/db-inspect.ts
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
  const profiles = await prisma.profile.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      rollNumber: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      platformAccount: { select: { username: true, lastError: true, lastSuccessfulSyncAt: true } },
      _count: { select: { solvedProblems: true, snapshots: true } },
    },
  });
  console.log(`== profiles (${profiles.length}) ==`);
  for (const p of profiles) {
    console.log(
      `   ${p.email} | role=${p.role} | roll=${p.rollNumber ?? "-"} | avatar=${p.avatarUrl ? "yes" : "NULL"} | leetcode=${p.platformAccount?.username ?? "not connected"} solved=${p._count.solvedProblems} snapshots=${p._count.snapshots}`
    );
    if (p.platformAccount?.lastError) {
      console.log(`      lastError=${p.platformAccount.lastError.slice(0, 150)}`);
    }
  }

  const sheets = await prisma.sheet.findMany({
    select: {
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      _count: { select: { sheetQuestions: true } },
    },
  });
  console.log(`\n== sheets (${sheets.length}) ==`);
  for (const s of sheets) {
    console.log(`   ${s.name} (${s.slug}) | ${s.status} | questions=${s._count.sheetQuestions}`);
  }

  const [questionCount, solvedCount, snapCount] = await Promise.all([
    prisma.question.count(),
    prisma.solvedProblem.count(),
    prisma.platformSnapshot.count(),
  ]);
  console.log(
    `\n== counts == questions=${questionCount} solvedProblems=${solvedCount} snapshots=${snapCount}`
  );

  const logs = await prisma.syncLog.findMany({
    take: 10,
    orderBy: { startedAt: "desc" },
    select: {
      status: true,
      startedAt: true,
      recordsProcessed: true,
      errorMessage: true,
      user: { select: { email: true } },
    },
  });
  console.log(`\n== recent sync_logs (${logs.length} latest) ==`);
  for (const l of logs) {
    console.log(
      `   ${l.user.email} | ${l.status} | records=${l.recordsProcessed}${l.errorMessage ? ` | err=${l.errorMessage.slice(0, 200)}` : ""}`
    );
  }
}

main()
  .catch((e) => {
    console.error("Inspect failed:", String(e?.message || e).slice(0, 500));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
