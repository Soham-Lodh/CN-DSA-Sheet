import { UserAvatar } from "@/components/UserAvatar";
import type { GlobalLeaderboardEntry } from "@/lib/services/leaderboard";

type Entry = GlobalLeaderboardEntry;

const ranks = [
  {
    badge: "🥇 1st Rank (Champion)",
    badgeClasses: "bg-brand-accent text-content-inverse text-xs shadow-lg shadow-brand-accent/30",
    cardClasses:
      "border-2 border-brand-accent/60 order-1 md:order-2 bg-gradient-to-b from-brand-accent/10 to-transparent p-6",
    avatar: {
      classes: "border-2 border-brand-accent shadow-lg shadow-brand-accent/20",
      size: "w-20 h-20",
    },
    nameClasses: "font-extrabold text-lg",
    rollClasses: "text-xs text-brand-accent",
    footerClasses: "bg-brand-accent/20 border border-brand-accent/30 p-2.5",
  },
  {
    badge: "🥈 2nd Rank",
    badgeClasses: "bg-rank-silver text-content-inverse text-[10px]",
    cardClasses: "border border-rank-silver/30 order-2 md:order-1 p-5",
    avatar: {
      classes: "border-2 border-rank-silver",
      size: "w-16 h-16",
    },
    nameClasses: "font-bold text-base",
    rollClasses: "text-[11px] text-content-muted",
    footerClasses: "bg-surface-page/80 p-2",
  },
  {
    badge: "🥉 3rd Rank",
    badgeClasses: "bg-rank-bronze text-content-primary text-[10px]",
    cardClasses: "border border-rank-bronze/40 order-3 p-5",
    avatar: {
      classes: "border-2 border-rank-bronze",
      size: "w-16 h-16",
    },
    nameClasses: "font-bold text-base",
    rollClasses: "text-[11px] text-content-muted",
    footerClasses: "bg-surface-page/80 p-2",
  },
] as const;

/** Top-3 podium cards (gold/silver/bronze), ordered gold → silver → bronze on mobile. */
export function Podium({ top3 }: { top3: Entry[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
      {ranks.map((rank, index) => {
        const entry = top3[index];
        if (!entry) return null;

        return (
          <div
            key={rank.badge}
            className={`glass-card glass-card-hover rounded-2xl text-center relative overflow-hidden flex flex-col justify-between ${rank.cardClasses}`}
          >
            <div
              className={`absolute top-2 left-1/2 -translate-x-1/2 font-black px-3 py-0.5 rounded-full uppercase tracking-widest ${rank.badgeClasses}`}
            >
              {rank.badge}
            </div>
            <div className="mt-4">
              <UserAvatar
                avatarUrl={entry.avatarUrl}
                name={entry.name}
                sizeClasses={rank.avatar.size}
                className={`mx-auto ${rank.avatar.classes}`}
              />
              <h3 className={`${rank.nameClasses} text-content-primary mt-2`}>{entry.name}</h3>
              <p className={`${rank.rollClasses} font-mono`}>
                {entry.rollNumber || "KIIT Student"}
              </p>
            </div>
            <div className={`mt-3 rounded-xl text-xs ${rank.footerClasses}`}>
              <span className="font-black text-rank-gold text-sm">{entry.totalSolved} Solved</span>
              <span className="text-brand-accent ml-2 font-mono font-bold">• {entry.score} pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
