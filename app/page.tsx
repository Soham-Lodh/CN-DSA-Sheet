import { SignInPanel } from "@/components/home/SignInPanel";
import { Code2, ShieldCheck, Trophy } from "lucide-react";

// Fully static landing page: no DB, no auth cookie reads -> served as instant HTML.
export const dynamic = "force-static";

const features = [
  {
    icon: Code2,
    iconClasses: "bg-brand-primary/10 border border-brand-primary/30 text-brand-primary",
    title: "Automated Sheet Tracking",
    description:
      "Solve curated questions on LeetCode. Our background engine automatically checks your accepted submissions and ticks sheet questions without manual checkboxes.",
  },
  {
    icon: Trophy,
    iconClasses: "bg-brand-accent/10 border border-brand-accent/30 text-brand-accent",
    title: "KIIT Chapter Leaderboard",
    description:
      "Compete with batchmates with deterministic scoring: Easy 1 pt, Medium 4 pts, Hard 8 pts. Global standings plus a leaderboard for every sheet.",
  },
  {
    icon: ShieldCheck,
    iconClasses: "bg-status-info/10 border border-status-info/30 text-status-info",
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
            <h3 className="font-bold text-lg text-content-primary">{feature.title}</h3>
            <p className="text-xs text-content-muted leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
