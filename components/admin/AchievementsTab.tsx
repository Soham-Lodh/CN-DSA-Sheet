"use client";
import { useEffect, useState } from "react";

type Achievement = { id: string; key: string; title: string; description: string; threshold: number; icon: string | null };

export function AchievementsTab() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [form, setForm] = useState({ key: "", title: "", description: "", threshold: "", icon: "🏆" });
  const [error, setError] = useState<string | null>(null);
  const load = () => fetch("/api/admin/achievements").then((r) => r.json()).then((d) => setItems(d.achievements || []));
  useEffect(() => { load(); }, []);
  const create = async () => {
    setError(null);
    const response = await fetch("/api/admin/achievements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, threshold: Number(form.threshold) }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "Could not create achievement");
    setForm({ key: "", title: "", description: "", threshold: "", icon: "🏆" }); load();
  };
  return <div className="glass-card p-6 rounded-2xl space-y-5">
    <div><h2 className="font-bold text-lg">Achievements</h2><p className="text-xs text-content-muted">Unlocks are calculated automatically during platform sync.</p></div>
    <div className="grid gap-2 md:grid-cols-5">
      {(["key", "title", "description", "threshold", "icon"] as const).map((field) => <input key={field} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} placeholder={field} className="rounded-lg bg-surface-page border border-outline-subtle px-3 py-2 text-xs" />)}
      <button onClick={create} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold">Create</button>
    </div>
    {error && <p className="text-xs text-status-danger">{error}</p>}
    <div className="grid gap-2">{items.map((item) => <div key={item.id} className="flex justify-between rounded-lg border border-outline-subtle p-3 text-xs"><span>{item.icon} {item.title}</span><span className="text-content-muted">{item.threshold} solved</span></div>)}</div>
  </div>;
}
