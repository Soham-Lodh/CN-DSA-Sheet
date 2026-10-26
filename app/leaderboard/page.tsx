import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth";
import { getGlobalLeaderboard, rankOfUser } from "@/lib/services/leaderboard";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KIIT Chapter Leaderboard",
  description:
    "University-wide competitive programming standings for KIIT students, ranked from verified LeetCode submissions with deterministic Easy/Medium/Hard scoring.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: `KIIT Chapter Leaderboard | ${siteConfig.shortName}`,
    description: "All-time KIIT competitive programming rankings, updated from verified LeetCode syncs.",
    url: `${siteConfig.url}/leaderboard`,
  },
};

export default async function LeaderboardPage() {
  const profile = await getCurrentProfile().catch(() => null);
  const globalData = await getGlobalLeaderboard();

  // Reuse the already-computed ranking instead of recomputing it.
  const userRank = rankOfUser(profile?.id, globalData);

  return (
    <LeaderboardView
      globalData={globalData}
      currentUserId={profile?.id}
      currentUserRank={userRank}
    />
  );
}
