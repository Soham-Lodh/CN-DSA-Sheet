import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cnOrange-500/10 border border-cnOrange-500/30 flex items-center justify-center text-cnOrange-500">
        <Compass className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-white">404 — Page not found</h1>
        <p className="text-sm text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cnOrange-600 to-amber-500 hover:from-cnOrange-500 hover:to-amber-400 text-white font-bold text-sm shadow-lg shadow-cnOrange-600/25 transition"
      >
        Back to Home
      </Link>
    </div>
  );
}
