import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectPlatformSchema } from "@/lib/validations";
import { getProvider } from "@/lib/platform/registry";
import { syncUserPlatformAccount } from "@/lib/services/sync-engine";
import { VerificationStatus } from "@prisma/client";

/** Connect the signed-in user's LeetCode handle and run an initial sync. */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = connectPlatformSchema.parse(body);

    const provider = getProvider();

    // 1. Validate the handle upstream.
    const validation = await provider.validateUsername(validated.username);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid LeetCode username" },
        { status: 400 }
      );
    }

    const normalizedUsername = validation.normalizedUsername;

    // 2. A handle can only belong to one student.
    const existing = await prisma.platformAccount.findUnique({
      where: { normalizedUsername },
    });
    if (existing && existing.userId !== profile.id) {
      return NextResponse.json(
        { error: "This LeetCode account is already connected to another student profile." },
        { status: 409 }
      );
    }

    // 3. Upsert this user's single platform account.
    const account = await prisma.platformAccount.upsert({
      where: { userId: profile.id },
      create: {
        userId: profile.id,
        username: validation.username,
        normalizedUsername,
        verificationStatus: VerificationStatus.VERIFIED,
      },
      update: {
        username: validation.username,
        normalizedUsername,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    // 4. Immediate initial sync so the UI populates right away.
    const syncResult = await syncUserPlatformAccount(profile.id, true);

    return NextResponse.json({ account, syncResult });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return handleAuthError(error);
  }
}

export async function DELETE() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.platformAccount.deleteMany({ where: { userId: profile.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
