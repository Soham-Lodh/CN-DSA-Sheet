import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();

  return createBrowserClient(url, anonKey);
}

/**
 * Single source of truth for starting Google OAuth.
 * Used by both the landing page panel and the navbar so the `hd` hint,
 * account chooser prompt and PKCE callback URL can never drift apart.
 */
export async function startGoogleSignIn() {
  const { error } = await createClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: "select_account", hd: "kiit.ac.in" },
    },
  });
  return error;
}
