/** Thin gradient progress bar for sheet completion. */
export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden p-0.5 border border-slate-700">
      <div
        className="bg-gradient-to-r from-cnOrange-600 to-amber-500 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, percent)}%` }}
      ></div>
    </div>
  );
}
