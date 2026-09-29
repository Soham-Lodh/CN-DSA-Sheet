import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileRoleSchema, deleteAdminUserSchema } from "@/lib/validations";
import { Role } from "@prisma/client";

/**
 * Admin management endpoint.
 *
 * Mirrors what SETUP.md documents as raw SQL in the Supabase SQL editor:
 * UPDATE public.profiles SET role = 'ADMIN' WHERE ...
 * DELETE FROM public.profiles WHERE ...
 */
export async function GET() {
  try {
    await requireAdmin();

    const profiles = await prisma.profile.findMany({
      orderBy: [{ role: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        rollNumber: true,
        role: true,
        createdAt: true,
        platformAccount: { select: { username: true } },
        _count: { select: { solvedProblems: true } },
      },
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    return handleAuthError(error);
  }
}

/** Promote an existing user to ADMIN. */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { userId } = updateProfileRoleSchema.extend({ role: Role.ADMIN }).parse(body);

    if (userId === admin.id) {
      return NextResponse.json(
        { error: "You are already an administrator" },
        { status: 400 }
      );
    }

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
    });

    return NextResponse.json({ profile });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Invalid request payload" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}

/** Promote or demote a user (USER <-> ADMIN). */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { userId, role } = updateProfileRoleSchema.parse(body);

    if (role === Role.USER) {
      const adminCount = await prisma.profile.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the only remaining administrator" },
          { status: 400 }
        );
      }
      if (userId === admin.id) {
        return NextResponse.json(
          { error: "You cannot demote yourself. Ask another admin to do it." },
          { status: 400 }
        );
      }
    }

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { role },
    });

    return NextResponse.json({ profile });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Invalid request payload" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}

/** Permanently delete a profile (and unlink its Supabase auth user). */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { userId } = deleteAdminUserSchema.parse(body);

    if (userId === admin.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account while signed in" },
        { status: 400 }
      );
    }

    const target = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Last-admin guard: never leave the system without an administrator.
    if (target.role === Role.ADMIN) {
      const adminCount = await prisma.profile.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the only remaining administrator" },
          { status: 400 }
        );
      }
    }

    // Ordered cleanup: platform data -> profile -> Supabase auth user.
    // (Profile cascades to platformAccounts/solvedProblems/snapshots/syncLogs.)
    await prisma.platformAccount.deleteMany({ where: { userId } });
    await prisma.solvedProblem.deleteMany({ where: { userId } });
    await prisma.platformSnapshot.deleteMany({ where: { userId } });
    await prisma.syncLog.deleteMany({ where: { userId } });
    await prisma.profile.delete({ where: { id: userId } });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (serviceKey && supabaseUrl) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authDeleteError) {
          console.error("Supabase auth user deletion failed:", authDeleteError.message);
        }
      } catch (authErr) {
        console.error("Supabase admin client error:", authErr);
      }
    }

    return NextResponse.json({ success: true, deletedUserId: userId });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
