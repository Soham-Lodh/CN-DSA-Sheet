export interface ParsedProblemUrl {
  externalKey: string;
  normalizedUrl: string;
  rawSlug: string;
}

/** Parses a LeetCode problem URL into its canonical externalKey. */
export function parseProblemUrl(urlStr: string): ParsedProblemUrl {
  if (!urlStr || typeof urlStr !== "string") {
    throw new Error("Invalid URL: string is empty or undefined");
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    throw new Error("Invalid URL format");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "leetcode.com" && hostname !== "www.leetcode.com") {
    throw new Error(
      `Unsupported host '${hostname}'. This platform tracks LeetCode problems only — expected a URL like https://leetcode.com/problems/two-sum/`
    );
  }

  const slug = parsed.pathname.match(/\/problems\/([^/]+)/i)?.[1]?.toLowerCase();
  if (!slug) {
    throw new Error(
      "Invalid LeetCode problem URL. Expected format: https://leetcode.com/problems/{title-slug}/"
    );
  }

  return {
    externalKey: `leetcode:${slug}`,
    normalizedUrl: `https://leetcode.com/problems/${slug}/`,
    rawSlug: slug,
  };
}
