/**
 * Report computation + API auth-error mapping. Pure logic: no database, no
 * network. `withApiErrors` is exercised directly to prove the guards used by
 * every new admin route surface 401/403 instead of a generic 500.
 */
process.env.DATABASE_URL ??= "postgresql://placeholder:placeholder@localhost:5432/placeholder";

import { describe, it, expect } from "vitest";
import { Difficulty } from "@prisma/client";
import {
  computeSheetReportRows,
  type SheetReportQuestion,
  type SheetReportStudent,
} from "../lib/services/reports";
import { withApiErrors } from "../lib/api-errors";
import { reportFileName } from "../lib/services/report-workbook";

const questions: SheetReportQuestion[] = [
  { id: "q1", externalKey: "leetcode:two-sum", difficulty: Difficulty.EASY },
  { id: "q2", externalKey: "leetcode:3sum", difficulty: Difficulty.MEDIUM },
  { id: "q3", externalKey: "leetcode:median-of-two-sorted-arrays", difficulty: Difficulty.HARD },
  { id: "q4", externalKey: "leetcode:valid-anagram", difficulty: Difficulty.EASY },
];

const students: SheetReportStudent[] = [
  { id: "u1", name: "Aarav", email: "aarav@kiit.ac.in", rollNumber: "2105001", leetcodeUsername: "aarav" },
  { id: "u2", name: "Bhavna", email: "bhavna@kiit.ac.in", rollNumber: "2105002", leetcodeUsername: null },
  { id: "u3", name: "Chitra", email: "chitra@kiit.ac.in", rollNumber: null, leetcodeUsername: "chitra" },
];

describe("Sheet report computation", () => {
  it("builds one row per student including students with nothing solved", () => {
    const rows = computeSheetReportRows(
      students,
      questions,
      [{ userId: "u1", externalKey: "leetcode:two-sum" }],
      []
    );

    expect(rows).toHaveLength(3);
    const aarav = rows.find((row) => row.email === "aarav@kiit.ac.in")!;
    expect(aarav).toEqual({
      rollNumber: "2105001",
      name: "Aarav",
      email: "aarav@kiit.ac.in",
      leetcodeUsername: "aarav",
      easySolved: 1,
      mediumSolved: 0,
      hardSolved: 0,
    });

    const bhavna = rows.find((row) => row.email === "bhavna@kiit.ac.in")!;
    expect(bhavna.easySolved + bhavna.mediumSolved + bhavna.hardSolved).toBe(0);
    // A missing handle/roll number is rendered as an empty cell, never "null".
    expect(bhavna.leetcodeUsername).toBe("");
    expect(rows.find((row) => row.email === "chitra@kiit.ac.in")!.rollNumber).toBe("");
  });

  it("splits counts by the difficulty of the sheet's own questions", () => {
    const rows = computeSheetReportRows(
      students,
      questions,
      [
        { userId: "u3", externalKey: "leetcode:two-sum" },
        { userId: "u3", externalKey: "leetcode:3sum" },
        { userId: "u3", externalKey: "leetcode:median-of-two-sorted-arrays" },
        { userId: "u3", externalKey: "leetcode:unrelated-problem" },
      ],
      []
    );

    const chitra = rows.find((row) => row.email === "chitra@kiit.ac.in")!;
    expect(chitra.easySolved).toBe(1);
    expect(chitra.mediumSolved).toBe(1);
    expect(chitra.hardSolved).toBe(1);
  });

  it("honours tri-state manual overrides (true adds, false removes an auto solve)", () => {
    const rows = computeSheetReportRows(
      students,
      questions,
      [
        { userId: "u1", externalKey: "leetcode:two-sum" },
        { userId: "u1", externalKey: "leetcode:valid-anagram" },
      ],
      [
        { userId: "u1", questionId: "q4", markedSolved: false },
        { userId: "u1", questionId: "q3", markedSolved: true },
      ]
    );

    const aarav = rows.find((row) => row.email === "aarav@kiit.ac.in")!;
    expect(aarav.easySolved).toBe(1); // two-sum auto only; valid-anagram explicitly unsolved
    expect(aarav.mediumSolved).toBe(0);
    expect(aarav.hardSolved).toBe(1); // manual tick
  });

  it("orders rows by total solved desc, then roll number", () => {
    const rows = computeSheetReportRows(
      students,
      questions,
      [
        { userId: "u2", externalKey: "leetcode:two-sum" },
        { userId: "u2", externalKey: "leetcode:3sum" },
        { userId: "u1", externalKey: "leetcode:two-sum" },
      ],
      []
    );
    expect(rows.map((row) => row.name)).toEqual(["Bhavna", "Aarav", "Chitra"]);
  });

  it("returns an empty roster for an empty student list", () => {
    expect(computeSheetReportRows([], questions, [], [])).toEqual([]);
  });
});

describe("Admin API auth error mapping", () => {
  it("maps requireUser() failures to a 401 envelope", async () => {
    const handler = withApiErrors(async () => {
      throw new Error("UNAUTHORIZED");
    });
    const response = await handler();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toMatch(/sign in/i);
  });

  it("maps requireAdmin() failures to a 403 envelope", async () => {
    const handler = withApiErrors(async () => {
      throw new Error("FORBIDDEN");
    });
    const response = await handler();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toMatch(/admin/i);
  });

  it("never leaks internal error text for unexpected failures", async () => {
    const handler = withApiErrors(async () => {
      throw new Error("postgres password=hunter2 at SELECT * FROM profiles");
    });
    const response = await handler();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/hunter2|SELECT/);
    expect(body.error.code).toBe("INTERNAL");
  });
});

describe("Report download file names", () => {
  it("is ASCII-safe and always ends in .xlsx", () => {
    const at = new Date("2026-11-12T10:20:30.000Z");
    expect(reportFileName("dsa-global-report", "", at)).toBe("dsa-global-report-2026-11-12.xlsx");
    expect(reportFileName("dsa-sheet-report", "KIIT DSA 75", at)).toBe(
      "dsa-sheet-report-kiit-dsa-75-2026-11-12.xlsx"
    );
  });
});
