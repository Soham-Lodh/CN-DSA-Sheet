import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { noStoreHeaders, withApiErrors } from "@/lib/api-errors";
import { buildGlobalReport } from "@/lib/services/reports";
import { buildReportWorkbook, reportFileName } from "@/lib/services/report-workbook";
import { xlsxResponse } from "@/lib/services/report-response";

/**
 * Global student report (admin only): roll number, email, name, LeetCode
 * username and LeetCode easy/medium/hard solved counts for every student.
 *
 * GET /api/admin/reports/global            -> JSON preview
 * GET /api/admin/reports/global?format=xlsx -> Excel download
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiErrors(
  async (request: NextRequest): Promise<NextResponse> => {
    await requireAdmin();

    const format = new URL(request.url).searchParams.get("format");
    const report = await buildGlobalReport();

    if (format === "xlsx") {
      const generatedAt = new Date(report.generatedAt);
      const file = await buildReportWorkbook({
        title: "LeetCode Global Report — KIIT DSA Tracker",
        subtitle: `${report.totalStudents} students (${report.linkedStudents} with a linked LeetCode account) · generated ${generatedAt.toLocaleString("en-IN")}`,
        columns: [
          { header: "Roll No", key: "rollNumber", width: 18 },
          { header: "Email", key: "email", width: 34 },
          { header: "Name", key: "name", width: 28 },
          { header: "LeetCode Username", key: "leetcodeUsername", width: 24 },
          { header: "Easy Solved", key: "easySolved", width: 13 },
          { header: "Medium Solved", key: "mediumSolved", width: 15 },
          { header: "Hard Solved", key: "hardSolved", width: 13 },
        ],
        rows: report.rows,
        footNote:
          "Counts are the student's LeetCode totals from their most recent verified sync.",
      });
      return xlsxResponse(file, reportFileName("dsa-global-report", "", generatedAt));
    }

    return NextResponse.json(report, { headers: noStoreHeaders() });
  }
);
