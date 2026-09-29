import { Difficulty } from "@prisma/client";
import {
  PlatformProvider,
  ProviderValidationResult,
  PlatformProfile,
  PlatformStats,
  SolvedProblemRecord,
  PlatformProblemMetadata,
} from "./types";

const LEETCODE_API_URL =
  process.env.LEETCODE_API_BASE_URL || "https://leetcode.com/graphql";

function mapLeetCodeDifficulty(diff?: string): Difficulty {
  if (!diff) return Difficulty.UNKNOWN;
  const d = diff.toUpperCase();
  if (d === "EASY") return Difficulty.EASY;
  if (d === "MEDIUM") return Difficulty.MEDIUM;
  if (d === "HARD") return Difficulty.HARD;
  return Difficulty.UNKNOWN;
}

export class LeetCodeProvider implements PlatformProvider {

  private async graphqlQuery(query: string, variables: Record<string, any>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(LEETCODE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://leetcode.com",
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`LeetCode API returned HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message || "LeetCode GraphQL error");
      }
      return json.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async validateUsername(username: string): Promise<ProviderValidationResult> {
    const cleanUsername = username.trim();
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
        }
      }
    `;

    try {
      const data = await this.graphqlQuery(query, { username: cleanUsername });
      if (data?.matchedUser?.username) {
        return {
          valid: true,
          username: data.matchedUser.username,
          normalizedUsername: cleanUsername.toLowerCase(),
        };
      }
      return {
        valid: false,
        username: cleanUsername,
        normalizedUsername: cleanUsername.toLowerCase(),
        error: "LeetCode user not found",
      };
    } catch (err: any) {
      return {
        valid: false,
        username: cleanUsername,
        normalizedUsername: cleanUsername.toLowerCase(),
        error: err.message || "Failed to connect to LeetCode API",
      };
    }
  }

  async fetchProfile(username: string): Promise<PlatformProfile> {
    const cleanUsername = username.trim();
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            userAvatar
            ranking
          }
        }
        userContestRanking(username: $username) {
          rating
          globalRanking
        }
      }
    `;

    const data = await this.graphqlQuery(query, { username: cleanUsername });
    const user = data?.matchedUser;
    if (!user) {
      throw new Error(`LeetCode user '${cleanUsername}' not found`);
    }

    return {
      username: user.username,
      name: user.profile?.realName || undefined,
      avatarUrl: user.profile?.userAvatar || undefined,
      ranking: user.profile?.ranking || undefined,
      rating: data?.userContestRanking?.rating ? Math.round(data.userContestRanking.rating) : undefined,
      rank: data?.userContestRanking?.globalRanking ? `#${data.userContestRanking.globalRanking}` : undefined,
    };
  }

  /** Fetch one year's submissionCalendar as a epoch-seconds -> count map. */
  private async fetchCalendar(username: string, year: number): Promise<Record<string, number>> {
    const query = `
      query getUserCalendar($username: String!, $year: Int!) {
        matchedUser(username: $username) {
          userCalendar(year: $year) {
            submissionCalendar
          }
        }
      }
    `;
    try {
      const data = await this.graphqlQuery(query, { username, year });
      const raw = data?.matchedUser?.userCalendar?.submissionCalendar;
      if (typeof raw === "string") return JSON.parse(raw);
      if (raw && typeof raw === "object") return raw as Record<string, number>;
    } catch {
      // Calendar is non-critical - never fail the sync over it.
    }
    return {};
  }

  async fetchStats(username: string): Promise<PlatformStats> {
    const cleanUsername = username.trim();
    const query = `
      query getUserStats($username: String!, $year: Int!) {
        matchedUser(username: $username) {
          submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
          userCalendar(year: $year) {
            streak
            totalActiveDays
            submissionCalendar
          }
          profile {
            ranking
          }
        }
        userContestRanking(username: $username) {
          rating
          globalRanking
          topPercentage
        }
      }
    `;

    // This year + last year in parallel: the app's heatmap window is a
    // trailing 365 days, which usually spans two calendar years.
    const currentYear = new Date().getFullYear();
    const [data, lastYearCalendar] = await Promise.all([
      this.graphqlQuery(query, { username: cleanUsername, year: currentYear }),
      this.fetchCalendar(cleanUsername, currentYear - 1),
    ]);
    const user = data?.matchedUser;
    if (!user) {
      throw new Error(`LeetCode user '${cleanUsername}' not found`);
    }

    const acList = user.submitStatsGlobal?.acSubmissionNum || [];
    let totalSolved = 0;
    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;

    for (const item of acList) {
      const diff = item.difficulty?.toLowerCase();
      if (diff === "all") totalSolved = item.count;
      else if (diff === "easy") easySolved = item.count;
      else if (diff === "medium") mediumSolved = item.count;
      else if (diff === "hard") hardSolved = item.count;
    }

    // This year's calendar (from the main query) merged with last year's.
    // Keys are epoch-seconds at UTC midnight; values are daily submission
    // counts - stored verbatim so the app heatmap matches leetcode.com exactly.
    let submissionCalendar: Record<string, number> = {};
    try {
      const raw = user.userCalendar?.submissionCalendar;
      if (typeof raw === "string") submissionCalendar = JSON.parse(raw);
      else if (raw && typeof raw === "object") submissionCalendar = raw;
    } catch {
      submissionCalendar = {};
    }
    submissionCalendar = { ...lastYearCalendar, ...submissionCalendar };

    const rating = data?.userContestRanking?.rating ? Math.round(data.userContestRanking.rating) : undefined;
    const rank = data?.userContestRanking?.globalRanking ? `#${data.userContestRanking.globalRanking}` : undefined;

    return {
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      rating,
      rank,
      rawMetadata: {
        ranking: user.profile?.ranking,
        contestStats: data?.userContestRanking,
        submissionCalendar,
        streak: user.userCalendar?.streak,
        totalActiveDays: user.userCalendar?.totalActiveDays,
      },
    };
  }

  async fetchSolvedProblems(username: string): Promise<SolvedProblemRecord[]> {
    const cleanUsername = username.trim();
    const query = `
      query getRecentAcSubmissions($username: String!) {
        recentAcSubmissionList(username: $username, limit: 100) {
          id
          title
          titleSlug
          timestamp
        }
      }
    `;

    const data = await this.graphqlQuery(query, { username: cleanUsername });
    const list = data?.recentAcSubmissionList || [];

    const solvedRecords: SolvedProblemRecord[] = [];
    const seen = new Set<string>();

    for (const sub of list) {
      if (!sub.titleSlug) continue;
      const slug = sub.titleSlug.toLowerCase();
      const externalKey = `leetcode:${slug}`;

      if (seen.has(externalKey)) continue;
      seen.add(externalKey);

      solvedRecords.push({
        externalKey,
        title: sub.title,
        solvedAt: sub.timestamp ? new Date(parseInt(sub.timestamp, 10) * 1000) : undefined,
        sourceSubmissionId: sub.id ? String(sub.id) : undefined,
        source: "leetcode_ac_list",
      });
    }

    return solvedRecords;
  }

  async fetchProblemMetadata(
    externalKey: string
  ): Promise<PlatformProblemMetadata | null> {
    const slug = externalKey.startsWith("leetcode:")
      ? externalKey.replace("leetcode:", "")
      : externalKey;

    const query = `
      query getQuestionDetails($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          title
          titleSlug
          difficulty
          topicTags {
            name
          }
        }
      }
    `;

    try {
      const data = await this.graphqlQuery(query, { titleSlug: slug });
      const q = data?.question;
      if (!q) return null;

      const tags = (q.topicTags || []).map((t: any) => t.name);
      const mainTopic = tags[0] || "General";

    return {
      externalKey: `leetcode:${slug.toLowerCase()}`,
      title: q.title,
      difficulty: mapLeetCodeDifficulty(q.difficulty),
      topic: mainTopic,
      tags,
      url: `https://leetcode.com/problems/${slug.toLowerCase()}/`,
    };
    } catch {
      return null;
    }
  }
}
