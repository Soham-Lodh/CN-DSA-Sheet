import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractRollNumber, INSTITUTION_EMAIL_DOMAIN } from "@/lib/auth";
import { SUPABASE_ENV_ERROR } from "@/lib/supabase/env";
import { Role } from "@prisma/client";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  // Validate redirect target to prevent open redirect vulnerability
  let safeRedirect = "/dashboard";
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    safeRedirect = next;
  }

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      // Fail loudly with a redirect the landing page can render, instead of
      // attempting OAuth against a placeholder project URL.
      console.error(SUPABASE_ENV_ERROR);
      return NextResponse.redirect(new URL("/?error=config_error", requestUrl.origin));
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in route handlers if cookies are already sent
          }
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      console.error("OAuth session exchange error:", error);
      return NextResponse.redirect(new URL("/?error=auth_failed", requestUrl.origin));
    }

    const email = data.user.email?.toLowerCase().trim();
    if (!email) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/?error=missing_email", requestUrl.origin));
    }

    // Defense-in-depth: enforce institutional domain
    const emailDomain = email.split("@")[1];
    if (emailDomain !== INSTITUTION_EMAIL_DOMAIN.toLowerCase()) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL(`/?error=invalid_domain&allowed=${INSTITUTION_EMAIL_DOMAIN}`, requestUrl.origin)
      );
    }

    // Provision or update profile in PostgreSQL
    const rawMeta = (data.user.user_metadata || {}) as Record<string, any>;
    const name =
      rawMeta.full_name || rawMeta.name || email.split("@")[0] || "KIIT Coder";
    const avatarUrl = rawMeta.avatar_url || rawMeta.picture || null;
    const rollNumber = extractRollNumber(email);

    try {
      await prisma.profile.upsert({
        where: { id: data.user.id },
        create: {
          id: data.user.id,
          email,
          name,
          avatarUrl,
          rollNumber,
          role: Role.USER,
        },
        update: {
          email,
          name: name || undefined,
          avatarUrl: avatarUrl || undefined,
        },
      });
    } catch (dbErr) {
      console.error("Profile sync error on login:", dbErr);
      // A profile save failure must not look like a successful login: send the
      // user back with an explicit error instead of a broken dashboard.
      return NextResponse.redirect(new URL("/?error=db_error", requestUrl.origin));
    }

    return NextResponse.redirect(new URL(safeRedirect, requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
