import { SignInPanel } from "@/components/home/SignInPanel";
import { Code2, ShieldCheck, Trophy } from "lucide-react";

// Fully static landing page: no DB, no auth cookie reads -> served as instant HTML.
export const dynamic = "force-static";

const features = [
  {
    icon: Code2,
    iconClasses: "bg-cnOrange-500/10 border border-cnOrange-500/30 text-cnOrange-500",
    title: "Automated Sheet Tracking",
    description:
      "Solve curated questions on LeetCode. Our background engine automatically checks your accepted submissions and ticks sheet questions without manual checkboxes.",
  },
  {
    icon: Trophy,
    iconClasses: "bg-amber-500/10 border border-amber-500/30 text-amber-500",
    title: "KIIT Chapter Leaderboard",
    description:
      "Compete with batchmates with deterministic scoring: Easy 1 pt, Medium 4 pts, Hard 8 pts. Global standings plus a leaderboard for every sheet.",
  },
  {
    icon: ShieldCheck,
    iconClasses: "bg-blue-500/10 border border-blue-500/30 text-blue-400",
    title: "Verified KIIT Credentials",
    description:
      "Student roll numbers and emails are securely extracted and verified with Google OAuth and PostgreSQL security policies. No fake profiles or impersonations.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12 py-6">
      {/* Hero Banner */}
      <SignInPanel />

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature) => (
          <div key={feature.title} className="glass-card p-6 rounded-2xl space-y-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${feature.iconClasses}`}>
              <feature.icon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white">{feature.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
