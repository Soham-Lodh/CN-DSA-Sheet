import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile, handleAuthError } from "@/lib/auth";
import { toggleQuestionProgress } from "@/lib/services/sheets";

/**
 * Toggle the signed-in user's manual "solved" tick on a sheet question.
 * Body: { questionId: string, solved: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const questionId = typeof body.questionId === "string" ? body.questionId : null;
    if (!questionId) {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }
    const solved = Boolean(body.solved);

    const result = await toggleQuestionProgress(profile.id, questionId, solved);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.message === "Question not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleAuthError(error);
  }
}
