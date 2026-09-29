import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ENV_ERROR } from "@/lib/supabase/env";

const SUPABASE_COOKIE_OPTIONS = {
  maxAge: 100 * 365 * 24 * 60 * 60, // ~100 years; @supabase/ssr requires maxAge for chunked auth cookies
};

/**
 * Session-refresh middleware.
 *
 * This is the root-cause fix for "authentication failed": Supabase SSR
 * sessions live in cookies whose access token expires after ~1 hour. Without
 * this middleware nothing refreshes the token between page loads, so
 * `supabase.auth.getUser()` in Server Components starts failing on every
 * request and every page silently redirects back to "/". The official
 * @supabase/ssr pattern below forwards request cookies into a client, lets
 * Supabase rotate/refresh the session, and copies the updated cookies onto
 * the outgoing response.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Surface a loud, actionable error instead of a silent auth failure.
    console.error(SUPABASE_ENV_ERROR);
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, { ...SUPABASE_COOKIE_OPTIONS, ...options })
        );
      },
    },
  });

  // getUser() contacts the Supabase auth server and triggers a token refresh
  // (reissuing the cookie set) when the stored access token has expired.
  // Anonymous visitors simply get no user back - no logging needed here.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on all routes except Next.js internals and static assets.
     * Includes /auth/callback so the exchanged session cookies are written
     * with maxAge (chunked-cookie safe) on the way through.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
