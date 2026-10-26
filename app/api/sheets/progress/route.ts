import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { setQuestionProgress } from "@/lib/services/sheets";
import {
  progressMutationSchema,
  progressMutationHeadersSchema,
  PROGRESS_BODY_MAX_BYTES,
} from "@/lib/validations";
import { withApiErrors, noStoreHeaders, ApiError } from "@/lib/api-errors";

/**
 * Set-state progress mutation (never a toggle).
 *
 * - Body: { questionId: string, solved: boolean } validated with Zod
 *   (strict boolean; `Boolean(body.solved)` coercion is not used).
 * - Optional `Idempotency-Key` header makes the mutation durably idempotent:
 *   the same key+payload replays the recorded authoritative response, so a
 *   retry after an ambiguous timeout is always safe.
 * - userId is derived server-side only; request bodies can never write
 *   another user's progress.
 * - Response: compact authoritative data for every affected published sheet
 *   (counts, score, difficulty splits, the user's own standings row), so the
 *   UI reconciles without extra full reads.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiErrors(
  async (request: NextRequest): Promise<NextResponse> => {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw ApiError.unauthorized();
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > PROGRESS_BODY_MAX_BYTES) {
      throw new ApiError("PAYLOAD_TOO_LARGE", 413, "Request body is too large.");
    }

    const raw = await request.text();
    if (raw.length > PROGRESS_BODY_MAX_BYTES) {
      throw new ApiError("PAYLOAD_TOO_LARGE", 413, "Request body is too large.");
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      throw new ApiError("MALFORMED_JSON", 400, "Request body is not valid JSON.");
    }
    const body = progressMutationSchema.parse(parsedJson);

    const headers = progressMutationHeadersSchema.parse(
      Object.fromEntries(request.headers.entries())
    );
    const idempotencyKey = headers["idempotency-key"];

    const result = await setQuestionProgress(
      profile.id,
      {
        name: profile.name,
        rollNumber: profile.rollNumber,
        avatarUrl: profile.avatarUrl,
      },
      body.questionId,
      body.solved,
      idempotencyKey
    );

    return NextResponse.json(result, { headers: noStoreHeaders() });
  }
);
