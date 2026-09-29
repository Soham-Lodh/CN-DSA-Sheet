/**
 * Shared Supabase environment validation.
 *
 * Previously the server/browser clients silently fell back to
 * `https://placeholder-project.supabase.co` / `placeholder-anon-key` when the
 * env vars were missing, which produced cryptic "authentication failed"
 * errors with no hint of the real cause. Every Supabase entry point now goes
 * through this check so a misconfiguration fails loudly with a fixable
 * message instead of failing silently.
 */
export const SUPABASE_ENV_ERROR =
  "[config] Supabase environment variables are missing: set NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env (values from Supabase Dashboard -> Settings -> API), " +
  "then FULLY stop and restart the dev server - Next.js only reads .env at startup.";

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(SUPABASE_ENV_ERROR);
  }

  return { url, anonKey };
}
