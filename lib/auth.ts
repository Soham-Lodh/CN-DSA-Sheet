import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Profile, Role } from "@prisma/client";
import { NextResponse } from "next/server";

export const INSTITUTION_EMAIL_DOMAIN =
  process.env.INSTITUTION_EMAIL_DOMAIN || "kiit.ac.in";

/**
 * Derives the student's roll number from their institutional email.
 * Applies strict domain validation, regex pattern matching, and normalization.
 */
export function extractRollNumber(email: string): string | null {
  if (!email || typeof email !== "string") return null;

  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex === -1) return null;

  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);

  // Validate allowed institution domain
  if (domainPart !== INSTITUTION_EMAIL_DOMAIN.toLowerCase()) {
    return null;
  }

  // 1. Configurable regex extraction if defined and matches
  const regexPattern = process.env.ROLL_NUMBER_REGEX;
  const captureGroup = parseInt(process.env.ROLL_NUMBER_CAPTURE_GROUP || "1", 10);

  if (regexPattern && regexPattern !== "^([a-zA-Z0-9._-]+)") {
    try {
      const match = localPart.match(new RegExp(regexPattern));
      if (match && match[captureGroup]) {
        return match[captureGroup].trim();
      }
    } catch (e) {
      console.error("Invalid ROLL_NUMBER_REGEX:", e);
    }
  }

  // 2. Search for student roll number digits (5 to 10 consecutive digits) in local part
  // e.g. "21051234" in "21051234" or "aarav.2105999" -> "2105999"
  const digitsMatch = localPart.match(/(\d{5,10})/);
  if (digitsMatch && digitsMatch[1]) {
    return digitsMatch[1];
  }

  // 3. Safe fallback if localPart is alphanumeric identifier
  if (/^[a-z0-9._-]+$/i.test(localPart)) {
    return localPart;
  }

  return null;
}

/**
 * Retrieves the currently authenticated Supabase user.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }
  return user;
}

/** Why getCurrentProfile() returned null (null reason = a profile exists). */
export type ProfileResolutionReason = "NO_SESSION" | "INVALID_DOMAIN" | null;

/**
 * Like getCurrentProfile, but explains WHY there is no profile: the visitor
 * has no Supabase session at all, or they are signed in with a non-institution
 * Google account (the `hd` OAuth hint is only a hint - Google still lets users
 * pick any account). Pages use the reason to show a real error banner instead
 * of silently bouncing the user back to "/".
 */
export async function resolveCurrentProfile(): Promise<{
  profile: Profile | null;
  reason: ProfileResolutionReason;
}> {
  const user = await getCurrentUser();
  if (!user || !user.email) return { profile: null, reason: "NO_SESSION" };

  const normalizedEmail = user.email.trim().toLowerCase();
  const emailDomain = normalizedEmail.split("@")[1];

  // Enforce institutional domain restriction
  if (emailDomain !== INSTITUTION_EMAIL_DOMAIN.toLowerCase()) {
    return { profile: null, reason: "INVALID_DOMAIN" };
  }

  // Query profile from database
  let profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    // Check if user exists by email (in case id changed)
    profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
    });

    if (profile) {
      // Update ID to match auth ID if needed
      profile = await prisma.profile.update({
        where: { email: normalizedEmail },
        data: { id: user.id },
      });
    } else {
      // Auto-provision profile from Google OAuth user metadata
      const rawMeta = (user.user_metadata || {}) as Record<string, any>;
      const name =
        rawMeta.full_name ||
        rawMeta.name ||
        user.email.split("@")[0] ||
        "KIIT Coder";
      const avatarUrl = rawMeta.avatar_url || rawMeta.picture || null;
      const rollNumber = extractRollNumber(normalizedEmail);

      try {
        profile = await prisma.profile.create({
          data: {
            id: user.id,
            email: normalizedEmail,
            name,
            avatarUrl,
            rollNumber,
            role: Role.USER,
          },
        });
      } catch (err) {
        // If unique constraint on rollNumber fails, create without rollNumber
        profile = await prisma.profile.create({
          data: {
            id: user.id,
            email: normalizedEmail,
            name,
            avatarUrl,
            rollNumber: null,
            role: Role.USER,
          },
        });
      }
    }
  }

  return { profile, reason: profile ? null : "NO_SESSION" };
}

/**
 * Retrieves the database profile for the authenticated user, auto-creating/syncing if needed.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  return (await resolveCurrentProfile()).profile;
}

/**
 * Requires an authenticated user profile or throws/returns 401.
 */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("UNAUTHORIZED");
  }
  return profile;
}

/**
 * Requires an authenticated administrator profile or throws/returns 403.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== Role.ADMIN) {
    throw new Error("FORBIDDEN");
  }
  return profile;
}

/**
 * Helper to handle auth errors in Route Handlers.
 */
export function handleAuthError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }
  }
  console.error("Internal Server Error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
