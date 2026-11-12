import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, noStoreHeaders, withApiErrors } from "@/lib/api-errors";
import {
  ImportFileError,
  MAX_IMPORT_FILE_BYTES,
  importQuestionsForSheet,
  parseQuestionWorkbook,
} from "@/lib/services/question-import";

/**
 * Bulk add questions to ONE sheet from an Excel (.xlsx) or CSV upload.
 *
 * Admin-only: requireAdmin() runs before the file is read, so anonymous (401)
 * and non-admin (403) callers never reach the parser or the database.
 *
 * Every row is processed individually: duplicates inside the file or already
 * in this sheet are skipped, invalid rows are rejected with a reason, and the
 * rest are inserted. The response reports the counts plus the full per-row
 * outcome so the admin console can show exactly what was not added and why.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> => {
    const admin = await requireAdmin();
    const { id } = await params;

    const sheet = await prisma.sheet.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!sheet) {
      throw new ApiError("NOT_FOUND", 404, "Sheet not found.");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiError(
        "BAD_REQUEST",
        400,
        "Expected a multipart form upload with a 'file' field."
      );
    }

    const file = form.get("file");
    if (!file || typeof file === "string" || typeof (file as Blob).arrayBuffer !== "function") {
      throw new ApiError("BAD_REQUEST", 400, "Attach an .xlsx or .csv file in the 'file' field.");
    }
    const upload = file as File;

    if (upload.size === 0) {
      throw new ApiError("BAD_REQUEST", 400, "The uploaded file is empty.");
    }
    if (upload.size > MAX_IMPORT_FILE_BYTES) {
      throw new ApiError(
        "PAYLOAD_TOO_LARGE",
        413,
        `The file is larger than ${Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} MB.`
      );
    }

    const buffer = Buffer.from(await upload.arrayBuffer());

    try {
      const parsed = await parseQuestionWorkbook(buffer, upload.name);
      const summary = await importQuestionsForSheet({
        sheetId: sheet.id,
        adminId: admin.id,
        fileName: upload.name,
        rows: parsed.rows,
      });

      return NextResponse.json(
        { ...summary, ignoredRows: parsed.ignoredRows, headers: parsed.headers },
        { headers: noStoreHeaders() }
      );
    } catch (error) {
      if (error instanceof ImportFileError) {
        throw new ApiError("BAD_REQUEST", 400, error.message);
      }
      throw error;
    }
  }
);
