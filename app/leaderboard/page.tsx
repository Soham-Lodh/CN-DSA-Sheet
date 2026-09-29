import { getCurrentProfile } from "@/lib/auth";
import { getGlobalLeaderboard, rankOfUser } from "@/lib/services/leaderboard";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leaderboard" };

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
