import { describe, it, expect, afterEach } from "vitest";
import { extractRollNumber } from "../lib/auth";
import { requireSupabaseEnv, SUPABASE_ENV_ERROR } from "../lib/supabase/env";
import { parseProblemUrl } from "../lib/platform/url-parser";
import {
  tallyDifficulty,
  pointsForDifficulty,
  DEFAULT_SHEET_SCORING,
} from "../lib/scoring/global";

describe("Roll Number Extraction Unit Tests", () => {
  it("extracts roll number from standard KIIT email", () => {
    const roll = extractRollNumber("21051234@kiit.ac.in");
    expect(roll).toBe("21051234");
  });

  it("extracts alphanumeric roll number from name format", () => {
    const roll = extractRollNumber("aarav.2105999@kiit.ac.in");
    expect(roll).toBe("2105999");
  });

  it("rejects non-institutional emails", () => {
    expect(extractRollNumber("student@gmail.com")).toBeNull();
    expect(extractRollNumber("hacker@othercollege.edu")).toBeNull();
  });

  it("handles malformed inputs safely", () => {
    expect(extractRollNumber("")).toBeNull();
    expect(extractRollNumber("no-at-sign")).toBeNull();
  });
});

describe("Supabase env validation", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws an actionable error when Supabase credentials are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => requireSupabaseEnv()).toThrow(SUPABASE_ENV_ERROR);
  });

  it("passes through credentials when both env vars are present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    expect(requireSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "test-anon-key",
    });
  });
});

describe("LeetCode URL Parsing Unit Tests", () => {
  it("parses LeetCode problem URLs into canonical keys", () => {
    const res = parseProblemUrl("https://leetcode.com/problems/two-sum/");
    expect(res.externalKey).toBe("leetcode:two-sum");
    expect(res.normalizedUrl).toBe("https://leetcode.com/problems/two-sum/");

    const www = parseProblemUrl("https://www.leetcode.com/problems/3SUM/description");
    expect(www.externalKey).toBe("leetcode:3sum");
  });

  it("rejects non-LeetCode domains", () => {
    expect(() => parseProblemUrl("https://evil-site.com/problems/hack")).toThrow(
      /tracks LeetCode problems only/
    );
    expect(() => parseProblemUrl("https://codeforces.com/problemset/problem/4/A")).toThrow(
      /tracks LeetCode problems only/
    );
  });

  it("rejects LeetCode URLs without a problem slug", () => {
    expect(() => parseProblemUrl("https://leetcode.com/contest/weekly/")).toThrow(
      /Invalid LeetCode problem URL/
    );
    expect(() => parseProblemUrl("not a url")).toThrow(/Invalid URL/);
  });
});

describe("Fixed Scoring Engine (1/4/8)", () => {
  it("computes leaderboard tallies from difficulty counts", () => {
    const tally = tallyDifficulty([
      { difficulty: "EASY" },
      { difficulty: "MEDIUM" },
      { difficulty: "MEDIUM" },
      { difficulty: "HARD" },
      { difficulty: "HARD" },
      { difficulty: "HARD" },
      { difficulty: "UNKNOWN" },
    ]);

    expect(tally.easySolved).toBe(1);
    expect(tally.mediumSolved).toBe(2);
    expect(tally.hardSolved).toBe(3);
    // 1*1 + 2*4 + 3*8 = 33
    expect(tally.score).toBe(33);
  });

  it("defaults to the global 1/4/8 scheme", () => {
    expect(DEFAULT_SHEET_SCORING).toEqual({ easyPoints: 1, mediumPoints: 4, hardPoints: 8 });
  });

  it("scores with a sheet-specific Easy/Medium/Hard config", () => {
    const config = { easyPoints: 2, mediumPoints: 10, hardPoints: 20 };
    expect(pointsForDifficulty("EASY", config)).toBe(2);
    expect(pointsForDifficulty("MEDIUM", config)).toBe(10);
    expect(pointsForDifficulty("HARD", config)).toBe(20);
    expect(pointsForDifficulty("UNKNOWN", config)).toBe(0);
    expect(pointsForDifficulty("HARD")).toBe(8); // no config -> global default
  });

  it("falls back gracefully for unknown difficulties with custom configs", () => {
    const config = { easyPoints: 5, mediumPoints: 5, hardPoints: 5 };
    expect(pointsForDifficulty(undefined, config)).toBe(0);
    expect(pointsForDifficulty(null, config)).toBe(0);
  });
});
