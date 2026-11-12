/**
 * Bulk question import (Excel/CSV) — pure-logic tests: header mapping, CSV
 * parsing, per-row validation, position planning, and the workbook reader.
 * No database is touched.
 */
process.env.DATABASE_URL ??= "postgresql://placeholder:placeholder@localhost:5432/placeholder";

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  ImportFileError,
  isValidSlug,
  mapHeader,
  normalizeSlug,
  parseCsvMatrix,
  parseQuestionWorkbook,
  resolvePosition,
  validateImportRow,
  type RawImportRow,
} from "../lib/services/question-import";

const row = (overrides: Partial<RawImportRow> = {}): RawImportRow => ({
  rowNumber: 2,
  serial: "",
  leetcodeNumber: "",
  title: "",
  slug: "",
  url: "",
  topic: "",
  difficulty: "",
  ...overrides,
});

describe("Spreadsheet header mapping", () => {
  it("recognizes the documented column names and common aliases", () => {
    expect(mapHeader("S.No")).toBe("serial");
    expect(mapHeader("problem index")).toBe("serial");
    expect(mapHeader("Serial Number")).toBe("serial");
    expect(mapHeader("LC No")).toBe("leetcodeNumber");
    expect(mapHeader("LeetCode Question Number")).toBe("leetcodeNumber");
    expect(mapHeader("Question Name")).toBe("title");
    expect(mapHeader("Problem Name")).toBe("title");
    expect(mapHeader("Slug")).toBe("slug");
    expect(mapHeader("Field")).toBe("slug");
    expect(mapHeader("LeetCode Link")).toBe("url");
    expect(mapHeader("URL")).toBe("url");
    expect(mapHeader("Topic")).toBe("topic");
    expect(mapHeader("Difficulty")).toBe("difficulty");
  });

  it("ignores unknown columns", () => {
    expect(mapHeader("Notes")).toBeNull();
    expect(mapHeader("")).toBeNull();
  });
});

describe("CSV parsing", () => {
  it("handles quoted fields, escaped quotes and CRLF", () => {
    const matrix = parseCsvMatrix(
      'S.No,Question Name,Link\r\n1,"Two Sum, classic",https://leetcode.com/problems/two-sum/\r\n2,"He said ""hi""",https://leetcode.com/problems/3sum/\r\n'
    );
    expect(matrix).toHaveLength(3);
    expect(matrix[1][1]).toBe("Two Sum, classic");
    expect(matrix[2][1]).toBe('He said "hi"');
  });
});

describe("Row validation", () => {
  it("accepts a row identified by its LeetCode link", () => {
    const result = validateImportRow(
      row({
        title: "Two Sum",
        url: "https://leetcode.com/problems/two-sum/",
        serial: "1",
        leetcodeNumber: "1",
        difficulty: "Easy",
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.externalKey).toBe("leetcode:two-sum");
    expect(result.value.url).toBe("https://leetcode.com/problems/two-sum/");
    expect(result.value.serial).toBe(1);
    expect(result.value.leetcodeNumber).toBe(1);
    expect(result.value.difficulty).toBe("EASY");
  });

  it("accepts a row identified only by its slug and builds the canonical URL", () => {
    const result = validateImportRow(row({ title: "3Sum", slug: "3sum" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.externalKey).toBe("leetcode:3sum");
    expect(result.value.url).toBe("https://leetcode.com/problems/3sum/");
    expect(result.value.difficulty).toBeNull();
  });

  it("normalizes a messy slug and rejects one that cannot be salvaged", () => {
    expect(normalizeSlug("  Two_Sum ")).toBe("two-sum");
    expect(isValidSlug("two-sum")).toBe(true);
    expect(isValidSlug("-two-sum-")).toBe(false);
    expect(isValidSlug("two sum")).toBe(false);

    expect(validateImportRow(row({ title: "Two Sum", slug: "Two_Sum" })).ok).toBe(true);
    const rejected = validateImportRow(row({ title: "Bad", slug: "!!!" }));
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.code).toBe("INVALID_SLUG");
  });

  it("warns when the slug column disagrees with the link and prefers the link", () => {
    const result = validateImportRow(
      row({ title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", slug: "two-sum-ii" })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.externalKey).toBe("leetcode:two-sum");
    expect(result.value.warning).toContain("did not match");
  });

  it("rejects rows with no name, no identifier, a foreign URL or bad numeric fields", () => {
    const noTitle = validateImportRow(row({ url: "https://leetcode.com/problems/two-sum/" }));
    expect(noTitle.ok).toBe(false);
    if (!noTitle.ok) expect(noTitle.code).toBe("MISSING_TITLE");

    const noId = validateImportRow(row({ title: "Two Sum" }));
    expect(noId.ok).toBe(false);
    if (!noId.ok) expect(noId.code).toBe("MISSING_SLUG_AND_URL");

    const foreign = validateImportRow(row({ title: "Hack", url: "https://evil.com/problems/x" }));
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.code).toBe("INVALID_URL");
      expect(foreign.reason).toMatch(/tracks LeetCode problems only/);
    }

    const badSerial = validateImportRow(row({ title: "A", slug: "a", serial: "1.5" }));
    expect(badSerial.ok).toBe(false);
    if (!badSerial.ok) expect(badSerial.code).toBe("INVALID_SERIAL");

    const badNumber = validateImportRow(row({ title: "A", slug: "a", leetcodeNumber: "abc" }));
    expect(badNumber.ok).toBe(false);
    if (!badNumber.ok) expect(badNumber.code).toBe("INVALID_LEETCODE_NUMBER");

    const badDifficulty = validateImportRow(row({ title: "A", slug: "a", difficulty: "brutal" }));
    expect(badDifficulty.ok).toBe(false);
    if (!badDifficulty.ok) expect(badDifficulty.code).toBe("INVALID_DIFFICULTY");
  });
});

describe("Position planning", () => {
  it("uses the serial number when it is free", () => {
    const used = new Set<number>();
    expect(resolvePosition(3, used, 1)).toEqual({ position: 3, next: 4, warning: null });
    expect(used.has(3)).toBe(true);
  });

  it("appends and warns when the serial number is already taken", () => {
    const used = new Set<number>([1, 2, 3]);
    const plan = resolvePosition(2, used, 4);
    expect(plan.position).toBe(4);
    expect(plan.next).toBe(5);
    expect(plan.warning).toMatch(/Serial 2 is already used/);
  });

  it("appends sequentially when no serial number is given", () => {
    const used = new Set<number>();
    const first = resolvePosition(null, used, 1);
    const second = resolvePosition(null, used, first.next);
    expect([first.position, second.position]).toEqual([1, 2]);
  });
});

async function workbookBuffer(rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Questions");
  rows.forEach((values) => sheet.addRow(values));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

describe("Workbook reading", () => {
  it("reads headers and rows from a real .xlsx buffer", async () => {
    const buffer = await workbookBuffer([
      ["S.No", "LC No", "Question Name", "Slug", "Link", "Difficulty"],
      [1, 1, "Two Sum", "two-sum", "https://leetcode.com/problems/two-sum/", "Easy"],
      [2, 15, "3Sum", "3sum", "https://leetcode.com/problems/3sum/", "Medium"],
    ]);

    const parsed = await parseQuestionWorkbook(buffer, "questions.xlsx");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].title).toBe("Two Sum");
    expect(parsed.rows[0].serial).toBe("1");
    expect(parsed.rows[1].leetcodeNumber).toBe("15");
    expect(parsed.headers.title).toBe("Question Name");
  });

  it("reads a hyperlink-only cell as the link", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Questions");
    sheet.addRow(["Question Name", "Link"]);
    const hyperlinkRow = sheet.addRow(["Two Sum", "Two Sum on LeetCode"]);
    hyperlinkRow.getCell(2).value = {
      text: "Two Sum on LeetCode",
      hyperlink: "https://leetcode.com/problems/two-sum/",
    };
    const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);

    const parsed = await parseQuestionWorkbook(buffer, "links.xlsx");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].url).toBe("https://leetcode.com/problems/two-sum/");
  });

  it("ignores blank rows instead of treating them as questions", async () => {
    const csv = "Question Name,Slug\nTwo Sum,two-sum\n\n\n3Sum,3sum\n";
    const parsed = await parseQuestionWorkbook(Buffer.from(csv, "utf8"), "rows.csv");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.ignoredRows).toBe(2);
  });

  it("rejects a file without the required identifier columns", async () => {
    const buffer = await workbookBuffer([["Question Name", "Topic"], ["Two Sum", "Arrays"]]);
    await expect(parseQuestionWorkbook(buffer, "bad.xlsx")).rejects.toBeInstanceOf(ImportFileError);
  });

  it("rejects unsupported extensions", async () => {
    const buffer = await workbookBuffer([["Question Name", "Slug"], ["Two Sum", "two-sum"]]);
    await expect(parseQuestionWorkbook(buffer, "questions.xls")).rejects.toThrow(/\.xlsx or \.csv/);
    await expect(parseQuestionWorkbook(buffer, "questions.pdf")).rejects.toThrow(/Unsupported/);
  });

  it("parses a .csv upload end to end", async () => {
    const csv =
      "S.No,Question Name,Slug\n1,Two Sum,two-sum\n2,3Sum,3sum\n";
    const parsed = await parseQuestionWorkbook(Buffer.from(csv, "utf8"), "questions.csv");
    expect(parsed.rows.map((r) => r.slug)).toEqual(["two-sum", "3sum"]);
    expect(validateImportRow(parsed.rows[0]).ok).toBe(true);
  });
});
