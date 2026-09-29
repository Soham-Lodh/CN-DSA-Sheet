import { resolveCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGlobalLeaderboard, rankOfUser } from "@/lib/services/leaderboard";
import { getAllSheetsWithFullProgress } from "@/lib/services/sheets";
import { getCombinedActivity } from "@/lib/services/activity";
import { ProfileView } from "@/components/profile/ProfileView";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const { profile, reason } = await resolveCurrentProfile().catch(() => ({
    profile: null,
    reason: "NO_SESSION" as const,
  }));

  if (!profile) {
    redirect(reason === "INVALID_DOMAIN" ? "/?error=invalid_domain" : "/");
  }

  const [platformAccount, snapshot, leaderboard, sheetProgress, activity] = await Promise.all([
    prisma.platformAccount.findUnique({ where: { userId: profile.id } }),
    prisma.platformSnapshot.findUnique({ where: { userId: profile.id } }),
    getGlobalLeaderboard(),
    getAllSheetsWithFullProgress(profile.id),
    getCombinedActivity(profile.id),
  ]);

  const globalRank = rankOfUser(profile.id, leaderboard);
  const totalSolved = snapshot?.totalSolved ?? 0;

  return (
    <ProfileView
      profile={{
        id: profile.id,
        email: profile.email,
        name: profile.name,
        rollNumber: profile.rollNumber,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt,
        role: profile.role,
      }}
      globalRank={globalRank}
      totalSolved={totalSolved}
      platformAccount={platformAccount}
      snapshot={snapshot}
      sheetProgress={sheetProgress}
      activity={activity}
    />
  );
}
