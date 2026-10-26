import { Award } from "lucide-react";
import type { Achievement, UserAchievement } from "@prisma/client";

/** Achievement badges unlocked by total verified solves. */
export function AchievementsGrid({ totalSolved, achievements }: { totalSolved: number; achievements: (UserAchievement & { achievement: Achievement })[] }) {

  return (
    <div className="glass-card p-6 rounded-2xl space-y-4 border border-outline-subtle">
      <h3 className="font-bold text-base text-content-primary flex items-center gap-2">
        <Award className="w-5 h-5 text-brand-primary" />
        <span>Achievements & Badges</span>
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 text-center">
        {achievements.map(({ achievement, unlockedAt }) => {
          const isUnlocked = Boolean(unlockedAt);
          return (
            <div
              key={achievement.id}
              className={`p-4 rounded-xl flex flex-col items-center gap-2 transition ${
                isUnlocked
                  ? "bg-surface-elevated/80 border border-brand-primary/40"
                  : "bg-surface-page/40 border border-outline-subtle opacity-40"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center text-2xl">
                {achievement.icon || "🏆"}
              </div>
              <span className="text-xs font-bold text-content-primary">{achievement.title}</span>
              <span
                className={`text-[10px] font-semibold ${
                  isUnlocked ? "text-status-success" : "text-content-muted"
                }`}
              >
                {isUnlocked ? "Unlocked" : `${Math.max(achievement.threshold - totalSolved, 0)} Qs away`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
