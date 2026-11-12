/**
 * Live verification for the admin Excel import + report features, run against
 * the real database in .env. It creates a DRAFT temporary sheet, imports a
 * generated .xlsx (valid rows, an in-file duplicate, a duplicate serial, and
 * several invalid rows), checks both report builders, writes real .xlsx files
 * to the OS temp folder, then removes everything it created.
 *
 * Run: npx tsx scripts/verify-admin-reporting.ts
 */
import { PrismaClient, SheetStatus } from "@prisma/client";
import ExcelJS from "exceljs";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function loadEnvFile() {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    console.error("Could not read .env - run from the project root.");
  }
}
loadEnvFile();

// Uses the configured URL verbatim: rewriting the connection string can make
// the pooler refuse the session, and this script must exercise the same path
// the application uses.
const prisma = new PrismaClient({ log: ["error"] });

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function buildWorkbook(rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Questions");
  rows.forEach((row) => worksheet.addRow(row));
  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

const HEADERS = ["S.No", "LC No", "Question Name", "Slug", "Link", "Difficulty", "Topic"];

async function main() {
  const admin = await prisma.profile.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  const actor = admin ?? (await prisma.profile.findFirst());
  if (!actor) {
    console.log("No profile rows in the database - cannot exercise the import path.");
    process.exitCode = 1;
    return;
  }
  console.log(`actor: ${actor.email} role=${actor.role}`);
  console.log(`profiles in DB: ${await prisma.profile.count()}`);

  const { parseQuestionWorkbook, importQuestionsForSheet } = await import(
    "../lib/services/question-import"
  );
  const { buildGlobalReport, buildSheetReport } = await import("../lib/services/reports");
  const { buildReportWorkbook } = await import("../lib/services/report-workbook");

  const slug = `verify-bulk-import-${Date.now()}`;
  const sheet = await prisma.sheet.create({
    data: {
      name: "Verification Sheet (temporary)",
      slug,
      description: "Created by scripts/verify-admin-reporting.ts - safe to delete.",
      status: SheetStatus.DRAFT,
    },
  });

  const createdKeys: string[] = [];
  const preExistingKeys = new Set(
    (
      await prisma.question.findMany({
        where: {
          externalKey: {
            in: [
              "leetcode:two-sum",
              "leetcode:3sum",
              "leetcode:valid-parentheses",
              "leetcode:invert-binary-tree",
              "leetcode:contains-duplicate",
              "leetcode:climbing-stairs",
            ],
          },
        },
        select: { externalKey: true },
      })
    ).map((row) => row.externalKey)
  );

  try {
    // ---------------------------------------------------------------------
    // 1. First upload: valid rows + duplicates + rejected rows
    // ---------------------------------------------------------------------
    const firstFile = await buildWorkbook([
      HEADERS,
      [1, 1, "Two Sum", "two-sum", "https://leetcode.com/problems/two-sum/", "Easy", "Arrays"],
      [2, 1, "Two Sum (again)", "two-sum", "", "Easy", ""],
      [3, 15, "3Sum", "3sum", "", "Medium", "Arrays"],
      [
        4,
        20,
        "Valid Parentheses",
        "valid-parentheses",
        "https://leetcode.com/problems/valid-parentheses/",
        "Easy",
        "Stack",
      ],
      [5, "", "", "no-title", "https://leetcode.com/problems/climbing-stairs/", "", ""],
      [6, "", "Broken Slug", "!!!", "", "", ""],
      [7, "", "Codeforces Problem", "", "https://codeforces.com/problemset/problem/4/A", "", ""],
      [1.5, "", "Bad Serial", "climbing-stairs", "", "", ""],
      [9, 217, "Contains Duplicate", "contains-duplicate", "", "", ""],
      [10, 226, "Invert Binary Tree", "invert-binary-tree", "", "Easy", "Trees"],
    ]);

    const parsed = await parseQuestionWorkbook(firstFile, "verification.xlsx");

    const first = await importQuestionsForSheet({
      sheetId: sheet.id,
      adminId: actor.id,
      fileName: "verification.xlsx",
      rows: parsed.rows,
    });

    console.log(
      `\nImport #1: total=${first.totalRows} imported=${first.imported} duplicates=${first.duplicates} rejected=${first.rejected} failed=${first.failed}`
    );
    for (const row of first.rows) {
      console.log(
        `   row ${String(row.rowNumber).padStart(2)} ${row.status.padEnd(9)} ${row.title || "(no name)"}${
          row.reason ? ` :: ${row.reason}` : ""
        }${row.warning ? ` (warn: ${row.warning})` : ""}`
      );
    }

    check("imports the valid rows", first.imported === 5, `${first.imported} imported`);
    check("skips the duplicate inside the file", first.duplicates === 1, `${first.duplicates} duplicate`);
    check("rejects invalid rows", first.rejected === 4, `${first.rejected} rejected`);
    check("no unexpected failures", first.failed === 0);
    check(
      "not-imported count matches",
      first.notImported === first.totalRows - first.imported,
      `${first.notImported}/${first.totalRows}`
    );

    const rejectedReasons = first.rows
      .filter((row) => row.status === "REJECTED")
      .map((row) => row.reason ?? "");
    check("missing title reported", rejectedReasons.some((r) => /name is missing/i.test(r)));
    check("bad slug reported", rejectedReasons.some((r) => /not a valid LeetCode slug/i.test(r)));
    check("foreign host reported", rejectedReasons.some((r) => /tracks LeetCode problems only/i.test(r)));
    check("bad serial reported", rejectedReasons.some((r) => /Serial number/i.test(r)));

    const fetched = first.rows.find((row) => row.slug === "contains-duplicate");
    check(
      "difficulty resolved from LeetCode when the sheet omits it",
      Boolean(fetched && (fetched.difficulty !== "UNKNOWN" || fetched.warning)),
      `${fetched?.difficulty}${fetched?.warning ? " (fallback warning)" : ""}`
    );

    const inSheet = await prisma.sheetQuestion.count({ where: { sheetId: sheet.id } });
    check("sheet now holds exactly the imported rows", inSheet === first.imported, `${inSheet} rows`);

    // ---------------------------------------------------------------------
    // 2. Second upload: already-in-sheet duplicate + a new question + serial clash
    // ---------------------------------------------------------------------
    const secondFile = await buildWorkbook([
      HEADERS,
      [1, 1, "Two Sum", "two-sum", "", "Easy", ""],
      [3, 70, "Climbing Stairs", "climbing-stairs", "", "Easy", "DP"],
      [4, 999, "Serial Clash", "valid-anagram", "", "Easy", ""],
    ]);
    const secondParsed = await parseQuestionWorkbook(secondFile, "verification-2.xlsx");
    const second = await importQuestionsForSheet({
      sheetId: sheet.id,
      adminId: actor.id,
      fileName: "verification-2.xlsx",
      rows: secondParsed.rows,
    });

    console.log(
      `\nImport #2: total=${second.totalRows} imported=${second.imported} duplicates=${second.duplicates} rejected=${second.rejected} failed=${second.failed}`
    );
    for (const row of second.rows) {
      console.log(
        `   row ${row.rowNumber} ${row.status} ${row.title}${row.reason ? ` :: ${row.reason}` : ""}${
          row.warning ? ` (warn: ${row.warning})` : ""
        }`
      );
    }

    check("skips a question already in this sheet", second.duplicates === 1, `${second.duplicates}`);
    check("adds the new question", second.imported === 2, `${second.imported}`);
    check(
      "keeps the canonical question shared (one row per slug)",
      (
        await prisma.question.count({ where: { externalKey: "leetcode:two-sum" } })
      ) === 1
    );
    const clash = second.rows.find((row) => row.title === "Serial Clash");
    check("serial clash is appended with a warning", Boolean(clash?.warning), clash?.warning ?? "");

    // ---------------------------------------------------------------------
    // 3. Reports
    // ---------------------------------------------------------------------
    const profileCount = await prisma.profile.count();
    const global = await buildGlobalReport();
    check("global report covers every student", global.rows.length === profileCount, `${global.rows.length}/${profileCount}`);
    check(
      "global report has the required columns",
      global.rows.every(
        (row) =>
          typeof row.rollNumber === "string" &&
          typeof row.name === "string" &&
          typeof row.email === "string" &&
          typeof row.leetcodeUsername === "string" &&
          typeof row.easySolved === "number" &&
          typeof row.mediumSolved === "number" &&
          typeof row.hardSolved === "number"
      )
    );

    const sheetReport = await buildSheetReport(sheet.id);
    check("sheet report exists", sheetReport !== null);
    check(
      "sheet report covers every student",
      sheetReport?.rows.length === profileCount,
      `${sheetReport?.rows.length}/${profileCount}`
    );
    const liveQuestionCount = await prisma.sheetQuestion.count({ where: { sheetId: sheet.id } });
    check(
      "sheet report knows its question count",
      sheetReport?.totalQuestions === liveQuestionCount,
      `${sheetReport?.totalQuestions}/${liveQuestionCount}`
    );

    // Tri-state proof: tick one question this actor has NOT auto-solved, verify
    // the sheet report counts it, then remove the override and verify it is gone.
    const autoKeys = new Set(
      (
        await prisma.solvedProblem.findMany({
          where: { userId: actor.id },
          select: { externalKey: true },
        })
      ).map((row) => row.externalKey)
    );
    const manualTarget = (
      await prisma.sheetQuestion.findMany({
        where: { sheetId: sheet.id },
        select: { questionId: true, question: { select: { externalKey: true, difficulty: true } } },
      })
    ).find((link) => !autoKeys.has(link.question.externalKey));

    if (!manualTarget) {
      console.log("  SKIP  manual override check — every question is already auto-solved for this actor");
    } else {
      const field: "easySolved" | "mediumSolved" | "hardSolved" =
        manualTarget.question.difficulty === "MEDIUM"
          ? "mediumSolved"
          : manualTarget.question.difficulty === "HARD"
            ? "hardSolved"
            : "easySolved";
      const baseline = (await buildSheetReport(sheet.id))?.rows.find(
        (row) => row.email === actor.email
      );

      await prisma.manualProgress.upsert({
        where: { userId_questionId: { userId: actor.id, questionId: manualTarget.questionId } },
        create: { userId: actor.id, questionId: manualTarget.questionId, markedSolved: true },
        update: { markedSolved: true },
      });
      const ticked = (await buildSheetReport(sheet.id))?.rows.find((row) => row.email === actor.email);
      check(
        "manual tick is reflected in the sheet report",
        (ticked?.[field] ?? 0) === (baseline?.[field] ?? 0) + 1,
        `${baseline?.[field]} -> ${ticked?.[field]}`
      );

      await prisma.manualProgress.deleteMany({
        where: { userId: actor.id, questionId: manualTarget.questionId },
      });
      const restored = (await buildSheetReport(sheet.id))?.rows.find(
        (row) => row.email === actor.email
      );
      check(
        "removing the override returns the report to the synced state",
        (restored?.[field] ?? 0) === (baseline?.[field] ?? 0)
      );
    }

    // ---------------------------------------------------------------------
    // 4. Excel generation
    // ---------------------------------------------------------------------
    const globalFile = await buildReportWorkbook({
      title: "LeetCode Global Report — verification",
      subtitle: `${global.totalStudents} students`,
      columns: [
        { header: "Roll No", key: "rollNumber", width: 18 },
        { header: "Email", key: "email", width: 34 },
        { header: "Name", key: "name", width: 28 },
        { header: "LeetCode Username", key: "leetcodeUsername", width: 24 },
        { header: "Easy Solved", key: "easySolved", width: 13 },
        { header: "Medium Solved", key: "mediumSolved", width: 15 },
        { header: "Hard Solved", key: "hardSolved", width: 13 },
      ],
      rows: global.rows,
    });
    const sheetFile = await buildReportWorkbook({
      title: "Sheet report — verification",
      subtitle: `${sheetReport?.totalStudents ?? 0} students`,
      columns: [
        { header: "Roll No", key: "rollNumber", width: 18 },
        { header: "Name", key: "name", width: 28 },
        { header: "Email", key: "email", width: 34 },
        { header: "LeetCode Username", key: "leetcodeUsername", width: 24 },
        { header: "Easy Solved", key: "easySolved", width: 13 },
        { header: "Medium Solved", key: "mediumSolved", width: 15 },
        { header: "Hard Solved", key: "hardSolved", width: 13 },
      ],
      rows: sheetReport?.rows ?? [],
    });

    const globalPath = path.join(tmpdir(), "verify-global-report.xlsx");
    const sheetPath = path.join(tmpdir(), "verify-sheet-report.xlsx");
    writeFileSync(globalPath, globalFile);
    writeFileSync(sheetPath, sheetFile);
    check("global workbook has content", globalFile.byteLength > 2000, `${globalFile.byteLength} bytes`);
    check("sheet workbook has content", sheetFile.byteLength > 2000, `${sheetFile.byteLength} bytes`);

    // Round-trip: the generated workbook must be readable by the importer.
    const rereadWorkbook = new ExcelJS.Workbook();
    await rereadWorkbook.xlsx.load(
      Buffer.from(globalFile) as unknown as Parameters<typeof rereadWorkbook.xlsx.load>[0]
    );
    check("generated workbook re-opens in ExcelJS", Boolean(rereadWorkbook.getWorksheet(1)));
    console.log(`\nworkbooks written: ${globalPath}, ${sheetPath}`);
  } finally {
    // ---------------------------------------------------------------------
    // 5. Cleanup: temp sheet, its links, and questions this run created
    // ---------------------------------------------------------------------
    await prisma.manualProgress.deleteMany({
      where: { question: { sheetQuestions: { some: { sheetId: sheet.id } } } },
    });
    await prisma.sheet.delete({ where: { id: sheet.id } }).catch(() => null);

    const orphanCandidates = await prisma.question.findMany({
      where: {
        externalKey: {
          in: [
            "leetcode:two-sum",
            "leetcode:3sum",
            "leetcode:valid-parentheses",
            "leetcode:invert-binary-tree",
            "leetcode:contains-duplicate",
            "leetcode:climbing-stairs",
            "leetcode:valid-anagram",
          ],
        },
        sheetQuestions: { none: {} },
      },
      select: { externalKey: true },
    });
    for (const question of orphanCandidates) {
      if (preExistingKeys.has(question.externalKey)) continue;
      createdKeys.push(question.externalKey);
      await prisma.question.delete({ where: { externalKey: question.externalKey } }).catch(() => null);
    }
    console.log(
      `cleanup: temp sheet removed; ${createdKeys.length} question(s) created by this run deleted${
        createdKeys.length ? ` (${createdKeys.join(", ")})` : ""
      }`
    );
  }

  console.log(failures === 0 ? "\nALL LIVE CHECKS PASSED" : `\n${failures} LIVE CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error("verify-admin-reporting failed:", String(error?.stack || error).slice(0, 1200));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
