/** Thin gradient progress bar for sheet completion. */
export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden p-0.5 border border-outline-subtle">
      <div
        className="bg-gradient-to-r from-brand-primary to-brand-accent h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, percent)}%` }}
      ></div>
    </div>
  );
}
