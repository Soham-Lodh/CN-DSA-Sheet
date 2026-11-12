import { NextResponse } from "next/server";
import { XLSX_MIME } from "@/lib/services/report-workbook";

/** Download response for a generated workbook (private, never edge-cached). */
export function xlsxResponse(file: Uint8Array, fileName: string): NextResponse {
  // Copy into a fresh Uint8Array so the Blob always owns an ArrayBuffer.
  const bytes = new Uint8Array(file);
  return new NextResponse(new Blob([bytes], { type: XLSX_MIME }), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
