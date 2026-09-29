import { Award } from "lucide-react";

/** Achievement badges unlocked by total verified solves. */
export function AchievementsGrid({ totalSolved }: { totalSolved: number }) {
  const badges = [
    { title: "First Solved", icon: "🚀", threshold: 1 },
    { title: "10 Solved", icon: "⚡", threshold: 10 },
    { title: "25 Solved", icon: "🔥", threshold: 25 },
    { title: "50 Solved", icon: "🎯", threshold: 50 },
    { title: "75 Master", icon: "💎", threshold: 75 },
    { title: "100 Solved", icon: "🏆", threshold: 100 },
    { title: "150 Legend", icon: "👑", threshold: 150 },
  ];

  return (
    <div className="glass-card p-6 rounded-2xl space-y-4 border border-slate-800">
      <h3 className="font-bold text-base text-white flex items-center gap-2">
        <Award className="w-5 h-5 text-cnOrange-500" />
        <span>Achievements & Badges</span>
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 text-center">
        {badges.map((badge) => {
          const isUnlocked = totalSolved >= badge.threshold;
          return (
            <div
              key={badge.title}
              className={`p-4 rounded-xl flex flex-col items-center gap-2 transition ${
                isUnlocked
                  ? "bg-slate-800/80 border border-cnOrange-500/40"
                  : "bg-slate-900/40 border border-slate-800 opacity-40"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-cnOrange-500/10 flex items-center justify-center text-2xl">
                {badge.icon}
              </div>
              <span className="text-xs font-bold text-white">{badge.title}</span>
              <span
                className={`text-[10px] font-semibold ${
                  isUnlocked ? "text-emerald-400" : "text-slate-500"
                }`}
              >
                {isUnlocked ? "Unlocked" : `${badge.threshold - totalSolved} Qs away`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
