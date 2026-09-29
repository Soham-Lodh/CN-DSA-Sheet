"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, startGoogleSignIn } from "@/lib/supabase/client";
import { ArrowRight, CheckCircle, Lock, Sparkles } from "lucide-react";

const authErrorMessages: Record<string, string> = {
  invalid_domain:
    "Access Denied: Only institutional emails ending in @kiit.ac.in are permitted to register.",
  auth_failed: "Authentication failed. Please try again.",
  config_error:
    "Server configuration error: Supabase keys are missing on the server. Double-check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file, then fully restart the dev server.",
  missing_email:
    "Your Google account did not return an email address, so we could not verify your KIIT identity.",
  db_error:
    "We could not save your profile to the database. Check the server logs and your DATABASE_URL configuration.",
  server_error:
    "Sign-up rejected by the auth server (server_error). This is almost always the institutional-domain trigger failing in Supabase — re-run the SQL in SETUP.md section 3, then try again.",
};

/**
 * Reads error params from BOTH ?error=... (query) and #error=... (hash).
 * Supabase redirects with a hash fragment on server-side OAuth failures
 * (e.g. "Database error saving new user"), which URLSearchParams misses.
 */
function readAuthError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return query.get("error") ?? hash.get("error") ?? null;
}

/** Normalizes a raw error param to a key in authErrorMessages. */
function authErrorKey(raw: string | null): string | null {
  if (!raw) return null;
  if (authErrorMessages[raw]) return raw;
  if (raw.includes("server_error") || /database error/i.test(raw)) return "server_error";
  return "auth_failed";
}

/**
 * Interactive part of the landing page: resolves the `?error=` banner,
 * redirects signed-in users to the dashboard and starts Google OAuth.
 */
export function SignInPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Render immediately on the server; only signed-in users see a swap to the spinner.
  const [checkingAuth, setCheckingAuth] = useState(false);

  useEffect(() => {
    const key = authErrorKey(readAuthError());
    if (key) setAuthError(authErrorMessages[key]);

    const checkUser = async () => {
      const { data } = await createClient().auth.getUser();
      if (data.user) router.push("/dashboard");
      else setCheckingAuth(false);
    };
    checkUser();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const error = await startGoogleSignIn();
      if (error) {
        setAuthError(error.message);
        setLoading(false);
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to initiate sign in");
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-cnOrange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 md:p-12 rounded-3xl relative overflow-hidden border-l-4 border-l-cnOrange-500 text-center md:text-left">
      <div className="max-w-3xl space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cnOrange-500/10 border border-cnOrange-500/30 text-cnOrange-400 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>EXCLUSIVELY FOR KIIT UNIVERSITY STUDENTS</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
          Level Up Your DSA with <span className="gradient-orange-text">Automated Sync</span> & KIIT Rankings
        </h1>

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          The official competitive programming and interview preparation tracker for KIITians. Connect your LeetCode account — sheet progress, streaks and rankings update automatically from your verified submissions (Easy 1 · Medium 4 · Hard 8 pts).
        </p>

        {authError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3 text-left">
            <Lock className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cnOrange-600 to-amber-500 hover:from-cnOrange-500 hover:to-amber-400 text-white font-black text-sm shadow-xl shadow-cnOrange-600/30 transition flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
              <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
            </svg>
            <span>{loading ? "Redirecting to Google..." : "Sign In with KIIT Google Account"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-400 pt-2">
          {["Restricted to @kiit.ac.in", "Zero manual checkboxes", "Live LeetCode Rankings"].map((label) => (
            <span key={label} className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
