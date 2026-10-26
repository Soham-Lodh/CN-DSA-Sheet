import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LeetCodeProvider } from "../lib/platform/leetcode";
import { tallyDifficulty, pointsForDifficulty, SCORING_POINTS } from "../lib/scoring/global";
import { Difficulty } from "@prisma/client";

describe("LeetCode Provider Tests", () => {
  const lcProvider = new LeetCodeProvider();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("validates existing LeetCode user", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          matchedUser: { username: "tourist_kiit" },
        },
      }),
    });

    const result = await lcProvider.validateUsername("tourist_kiit");
    expect(result.valid).toBe(true);
    expect(result.username).toBe("tourist_kiit");
  });

  it("handles non-existent user cleanly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { matchedUser: null },
      }),
    });

    const result = await lcProvider.validateUsername("nonexistent_user_123");
    expect(result.valid).toBe(false);
  });

  it("fetches canonical solved problems deduplicated by slug", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          recentAcSubmissionList: [
            { id: "1001", title: "Two Sum", titleSlug: "two-sum", timestamp: "1672531199" },
            { id: "1002", title: "Two Sum", titleSlug: "two-sum", timestamp: "1672531200" }, // duplicate submission
            { id: "1003", title: "3Sum", titleSlug: "3sum", timestamp: "1672531300" },
          ],
        },
      }),
    });

    const solved = await lcProvider.fetchSolvedProblems("tourist_kiit");
    expect(solved.length).toBe(2);
    expect(solved[0].externalKey).toBe("leetcode:two-sum");
    expect(solved[1].externalKey).toBe("leetcode:3sum");
  });

  it("extracts difficulty counts from submitStatsGlobal", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          matchedUser: {
            submitStatsGlobal: {
              acSubmissionNum: [
                { difficulty: "All", count: 265 },
                { difficulty: "Easy", count: 151 },
                { difficulty: "Medium", count: 103 },
                { difficulty: "Hard", count: 11 },
              ],
            },
            profile: { ranking: 12345 },
          },
          userContestRanking: { rating: 1577.4, globalRanking: 98765 },
        },
      }),
    });

    const stats = await lcProvider.fetchStats("tourist_kiit");
    expect(stats.totalSolved).toBe(265);
    expect(stats.easySolved).toBe(151);
    expect(stats.mediumSolved).toBe(103);
    expect(stats.hardSolved).toBe(11);
    expect(stats.rating).toBe(1577);
  });

  it("builds canonical problem metadata from an external key", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          question: {
            questionId: "1",
            title: "Two Sum",
            titleSlug: "two-sum",
            difficulty: "Easy",
            topicTags: [{ name: "Array" }, { name: "Hash Table" }],
          },
        },
      }),
    });

    const metadata = await lcProvider.fetchProblemMetadata("leetcode:two-sum");
    expect(metadata).not.toBeNull();
    expect(metadata!.externalKey).toBe("leetcode:two-sum");
    expect(metadata!.title).toBe("Two Sum");
    expect(metadata!.difficulty).toBe(Difficulty.EASY);
    expect(metadata!.url).toBe("https://leetcode.com/problems/two-sum/");
  });
});

describe("Fixed Scoring (Easy 1 / Medium 4 / Hard 8)", () => {
  it("assigns the fixed point values", () => {
    expect(SCORING_POINTS.EASY).toBe(1);
    expect(SCORING_POINTS.MEDIUM).toBe(4);
    expect(SCORING_POINTS.HARD).toBe(8);
    expect(pointsForDifficulty("UNKNOWN")).toBe(0);
    expect(pointsForDifficulty(null)).toBe(0);
  });

  it("tallies counts and score in one pass", () => {
    const tally = tallyDifficulty([
      { difficulty: "EASY" },
      { difficulty: "EASY" },
      { difficulty: "MEDIUM" },
      { difficulty: "HARD" },
      { difficulty: "UNKNOWN" },
    ]);

    expect(tally.easySolved).toBe(2);
    expect(tally.mediumSolved).toBe(1);
    expect(tally.hardSolved).toBe(1);
    // 2*1 + 1*4 + 1*8 = 14
    expect(tally.score).toBe(14);
  });

  it("scores an empty list as zero", () => {
    expect(tallyDifficulty([]).score).toBe(0);
  });
});
