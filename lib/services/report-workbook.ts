import ExcelJS from "exceljs";

/** Server-side .xlsx generation for admin reports (never imported by clients). */

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface ReportColumn {
  header: string;
  key: string;
  width: number;
}

export type ReportCell = string | number | null;

export interface ReportWorkbookInput<Row extends object = Record<string, ReportCell>> {
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: Row[];
  footNote?: string;
}

/**
 * Title row, generated-at row, styled header row, data rows, optional note.
 * The header row is frozen and filtered so large rosters stay usable.
 */
export async function buildReportWorkbook<Row extends object>(
  input: ReportWorkbookInput<Row>
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KIIT DSA Tracker";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Report", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const lastColumn = Math.max(input.columns.length, 1);

  worksheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = input.title;
  titleCell.font = { size: 14, bold: true, color: { argb: "FFF97316" } };
  titleCell.alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 24;

  worksheet.mergeCells(2, 1, 2, lastColumn);
  const subtitleCell = worksheet.getCell(2, 1);
  subtitleCell.value = input.subtitle;
  subtitleCell.font = { size: 10, italic: true, color: { argb: "FF64748B" } };

  const headerRow = worksheet.getRow(4);
  input.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF334155" } } };
    worksheet.getColumn(index + 1).width = column.width;
  });
  headerRow.height = 20;

  worksheet.addRows(
    input.rows.map((row) =>
      input.columns.map((column) => {
        const value = (row as Record<string, ReportCell | undefined>)[column.key];
        return value === null || value === undefined ? "" : value;
      })
    )
  );

  if (input.rows.length > 0) {
    worksheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + input.rows.length, column: lastColumn },
    };
  }

  if (input.footNote) {
    const noteRow = worksheet.getRow(6 + input.rows.length);
    noteRow.getCell(1).value = input.footNote;
    noteRow.getCell(1).font = { size: 9, italic: true, color: { argb: "FF64748B" } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

/** ASCII-safe download name: <prefix>-<slug>-<yyyy-mm-dd>.xlsx */
export function reportFileName(prefix: string, slug: string, at: Date): string {
  const date = at.toISOString().slice(0, 10);
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
  return `${prefix}-${safeSlug ? `${safeSlug}-` : ""}${date}.xlsx`;
}
