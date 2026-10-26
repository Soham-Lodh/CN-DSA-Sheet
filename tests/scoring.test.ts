import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "path";
import { describe, it, expect } from "vitest";
import { DEFAULT_SHEET_SCORING, SCORING_POINTS, pointsForDifficulty } from "../lib/scoring/global";
import { difficultyEnum, progressMutationSchema } from "../lib/validations";

const repoRoot = path.resolve(__dirname, "..");

function schemaDefaultsFromPrisma() {
  const text = readFileSync(path.join(repoRoot, "prisma", "schema.prisma"), "utf8");
  const easy = Number(text.match(/easyPoints\s+Int\s+@default\((\d+)\)/)?.[1]);
  const medium = Number(text.match(/mediumPoints\s+Int\s+@default\((\d+)\)/)?.[1]);
  const hard = Number(text.match(/hardPoints\s+Int\s+@default\((\d+)\)/)?.[1]);
  return { easy, medium, hard };
}

function zodSheetDefaultsFromSource() {
  const text = readFileSync(
    path.join(repoRoot, "lib", "validations", "index.ts"),
    "utf8"
  );
  // Fields appear in declaration order: easy, medium, hard.
  const matches = [...text.matchAll(/(?:easy|medium|hard)Points:\s*(?:z\.\w+\(\)|pointsField\("\w+"\))\.default\((\d+)\)/g)].map((m) => Number(m[1]));
  expect(matches.length).toBe(3);
  return { easy: matches[0], medium: matches[1], hard: matches[2] };
}

describe("Scoring consistency (audit item A1)", () => {
  it("uses the single runtime intent: Easy 1 / Medium 4 / Hard 8", () => {
    expect(SCORING_POINTS).toEqual({ EASY: 1, MEDIUM: 4, HARD: 8 });
    expect(DEFAULT_SHEET_SCORING).toEqual({ easyPoints: 1, mediumPoints: 4, hardPoints: 8 });
  });

  it("matches the Prisma schema defaults", () => {
    const prismaDefaults = schemaDefaultsFromPrisma();
    expect(prismaDefaults).toEqual({ easy: 1, medium: 4, hard: 8 });
  });

  it("matches the Zod sheet-validation defaults", () => {
    const zodDefaults = zodSheetDefaultsFromSource();
    expect(zodDefaults).toEqual({ easy: 1, medium: 4, hard: 8 });
  });

  it("scores unknown/null difficulties as zero", () => {
    expect(pointsForDifficulty("UNKNOWN")).toBe(0);
    expect(pointsForDifficulty(null)).toBe(0);
    expect(pointsForDifficulty(undefined)).toBe(0);
  });

  it("honours per-sheet overrides above the global defaults", () => {
    expect(pointsForDifficulty("HARD", { easyPoints: 2, mediumPoints: 10, hardPoints: 20 })).toBe(20);
    expect(pointsForDifficulty("HARD")).toBe(8);
  });
});

describe("Progress mutation validation (audit item A3)", () => {
  it("requires a real boolean for solved — the string \"false\" is rejected", () => {
    expect(progressMutationSchema.safeParse({ questionId: "q1", solved: "false" }).success).toBe(false);
    expect(progressMutationSchema.safeParse({ questionId: "q1", solved: 1 }).success).toBe(false);
    expect(progressMutationSchema.safeParse({ questionId: "q1", solved: true }).success).toBe(true);
    expect(progressMutationSchema.safeParse({ questionId: "q1", solved: false }).success).toBe(true);
  });

  it("requires a non-empty questionId", () => {
    expect(progressMutationSchema.safeParse({ questionId: "", solved: true }).success).toBe(false);
    expect(progressMutationSchema.safeParse({ solved: true }).success).toBe(false);
  });

  it("validates the difficulty enum", () => {
    expect(difficultyEnum.safeParse("EASY").success).toBe(true);
    expect(difficultyEnum.safeParse("NOPE").success).toBe(false);
  });
});
