import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ApiError, noStoreHeaders, withApiErrors } from "@/lib/api-errors";
import { buildSheetReport } from "@/lib/services/reports";
import { buildReportWorkbook, reportFileName } from "@/lib/services/report-workbook";
import { xlsxResponse } from "@/lib/services/report-response";

/**
 * Per-sheet student report (admin only): for one sheet, roll number, name,
 * email, LeetCode username and how many of that sheet's easy/medium/hard
 * questions each student has solved.
 *
 * GET /api/admin/reports/sheets/[id]             -> JSON preview
 * GET /api/admin/reports/sheets/[id]?format=xlsx -> Excel download
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> => {
    await requireAdmin();

    const { id } = await params;
    const format = new URL(request.url).searchParams.get("format");
    const report = await buildSheetReport(id);
    if (!report) {
      throw new ApiError("NOT_FOUND", 404, "Sheet not found.");
    }

    if (format === "xlsx") {
      const generatedAt = new Date(report.generatedAt);
      const file = await buildReportWorkbook({
        title: `${report.sheet.name} — Sheet Report`,
        subtitle: `${report.totalStudents} students · ${report.totalQuestions} questions in this sheet · generated ${generatedAt.toLocaleString("en-IN")}`,
        columns: [
          { header: "Roll No", key: "rollNumber", width: 18 },
          { header: "Name", key: "name", width: 28 },
          { header: "Email", key: "email", width: 34 },
          { header: "LeetCode Username", key: "leetcodeUsername", width: 24 },
          { header: "Easy Solved", key: "easySolved", width: 13 },
          { header: "Medium Solved", key: "mediumSolved", width: 15 },
          { header: "Hard Solved", key: "hardSolved", width: 13 },
        ],
        rows: report.rows,
        footNote:
          "Counts are this sheet's questions only, split by each question's difficulty (verified sync or the student's own tick).",
      });
      return xlsxResponse(
        file,
        reportFileName("dsa-sheet-report", report.sheet.slug, generatedAt)
      );
    }

    return NextResponse.json(report, { headers: noStoreHeaders() });
  }
);
