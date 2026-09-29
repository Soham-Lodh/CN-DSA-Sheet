import { describe, it, expect, afterEach } from "vitest";
import { extractRollNumber } from "../lib/auth";
import { requireSupabaseEnv, SUPABASE_ENV_ERROR } from "../lib/supabase/env";
import { parseProblemUrl } from "../lib/platform/url-parser";
import { tallyDifficulty } from "../lib/scoring/global";

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
});
