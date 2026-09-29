import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  footer: React.ReactNode;
  icon: LucideIcon;
  iconClasses: string;
}

/** Dashboard stat card with label, headline value, caption row and icon tile. */
export function MetricCard({ label, value, footer, icon: Icon, iconClasses }: MetricCardProps) {
  return (
    <div className="glass-card glass-card-hover p-5 rounded-xl flex items-center justify-between">
      <div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
        <h3 className="text-2xl font-black text-white mt-1">{value}</h3>
        {footer}
      </div>
      <div
        className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl ${iconClasses}`}
      >
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}
