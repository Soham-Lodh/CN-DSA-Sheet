import ExcelJS from "exceljs";
import { Difficulty, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/platform/registry";
import { parseProblemUrl } from "@/lib/platform/url-parser";
import type { PlatformProblemMetadata } from "@/lib/platform/types";
import { invalidateTags, sheetCatalogueInvalidationTags } from "@/lib/cache";
import { ApiError } from "@/lib/api-errors";

/**
 * Bulk question import for one sheet (admin console).
 *
 * Flow: parse workbook -> validate each row -> drop duplicates (inside the
 * file and already assigned to that sheet) -> resolve LeetCode metadata only
 * when the row cannot supply a difficulty -> insert accepted rows one by one,
 * so a single bad row can never abort the batch. Every row is reported back
 * with its outcome and, when it was not imported, the reason.
 */

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;

/** Raised for problems with the file itself (unreadable, no headers, too big). */
export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

export type ImportColumn =
  | "serial"
  | "leetcodeNumber"
  | "title"
  | "slug"
  | "url"
  | "topic"
  | "difficulty";

const HEADER_ALIASES: Record<ImportColumn, string[]> = {
  serial: [
    "serial",
    "serial number",
    "serial no",
    "sl no",
    "s no",
    "sno",
    "no",
    "index",
    "problem index",
    "problem no",
    "problem number",
    "position",
    "order",
  ],
  leetcodeNumber: [
    "leetcode question number",
    "leetcode number",
    "leetcode no",
    "leetcode id",
    "leetcode question no",
    "leetcode q no",
    "lc number",
    "lc no",
    "lc question number",
    "question number",
    "question no",
  ],
  title: ["name", "question name", "problem name", "title", "question title", "problem title", "question", "problem"],
  slug: ["slug", "field", "question slug", "problem slug", "title slug", "leetcode slug", "slug field"],
  url: ["link", "url", "question link", "problem link", "leetcode link", "leetcode url", "href"],
  topic: ["topic", "category", "topics", "tag", "tags", "topic category"],
  difficulty: ["difficulty", "difficulty level", "level"],
};

export function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_LOOKUP = new Map<string, ImportColumn>();
for (const [column, aliases] of Object.entries(HEADER_ALIASES) as [ImportColumn, string[]][]) {
  for (const alias of aliases) HEADER_LOOKUP.set(normalizeHeader(alias), column);
}

/** Maps a spreadsheet header cell to a known import column (or null). */
export function mapHeader(raw: string): ImportColumn | null {
  const key = normalizeHeader(raw);
  if (!key) return null;
  return HEADER_LOOKUP.get(key) ?? null;
}

/** One spreadsheet row, still as raw text (validation happens separately). */
export interface RawImportRow {
  rowNumber: number;
  serial: string;
  leetcodeNumber: string;
  title: string;
  slug: string;
  url: string;
  topic: string;
  difficulty: string;
}

export interface ParsedImportFile {
  rows: RawImportRow[];
  headers: Partial<Record<ImportColumn, string>>;
  ignoredRows: number;
}

interface SheetMatrix {
  cells: string[][];
  hyperlinks: (string | null)[][];
}

/**
 * Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). Kept in
 * house so the .csv path never depends on stream semantics.
 */
export function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      endField();
      continue;
    }
    if (char === "\r") continue;
    if (char === "\n") {
      endRow();
      continue;
    }
    field += char;
  }
  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  const cell = value as unknown as Record<string, unknown>;
  if (typeof cell.text === "string") return cell.text.trim();
  if (Array.isArray(cell.richText)) {
    return (cell.richText as { text?: string }[]).map((part) => part.text ?? "").join("").trim();
  }
  if (cell.result !== undefined && cell.result !== null) return String(cell.result).trim();
  if (typeof cell.hyperlink === "string") return cell.hyperlink.trim();
  return "";
}

function cellHyperlink(value: ExcelJS.CellValue): string | null {
  if (!value || typeof value !== "object") return null;
  const cell = value as { hyperlink?: unknown };
  return typeof cell.hyperlink === "string" ? cell.hyperlink.trim() : null;
}

function matrixFromWorksheet(worksheet: ExcelJS.Worksheet): SheetMatrix {
  const rowCount = worksheet.rowCount;
  const columnCount = Math.max(worksheet.columnCount, 1);
  const cells: string[][] = [];
  const hyperlinks: (string | null)[][] = [];

  for (let r = 1; r <= rowCount; r += 1) {
    const row = worksheet.getRow(r);
    const rowCells: string[] = [];
    const rowLinks: (string | null)[] = [];
    for (let c = 1; c <= columnCount; c += 1) {
      const cell = row.getCell(c);
      rowCells.push(cellToText(cell.value));
      rowLinks.push(cellHyperlink(cell.value));
    }
    cells.push(rowCells);
    hyperlinks.push(rowLinks);
  }

  return { cells, hyperlinks };
}

function detectHeaderRow(cells: string[][]): { index: number; columns: Map<ImportColumn, number> } | null {
  const limit = Math.min(cells.length, 10);
  let best: { index: number; columns: Map<ImportColumn, number>; count: number } | null = null;

  for (let r = 0; r < limit; r += 1) {
    const columns = new Map<ImportColumn, number>();
    (cells[r] ?? []).forEach((text, c) => {
      const column = mapHeader(text);
      if (column && !columns.has(column)) columns.set(column, c);
    });
    if (columns.size >= 2 && (!best || columns.size > best.count)) {
      best = { index: r, columns, count: columns.size };
    }
  }

  return best ? { index: best.index, columns: best.columns } : null;
}

function buildRawRows(
  matrix: SheetMatrix,
  header: { index: number; columns: Map<ImportColumn, number> }
): { rows: RawImportRow[]; ignoredRows: number } {
  const { cells, hyperlinks } = matrix;
  const columnIndex = header.columns;
  const rows: RawImportRow[] = [];
  let ignoredRows = 0;

  const pick = (row: string[], column: ImportColumn): string => {
    const index = columnIndex.get(column);
    if (index === undefined) return "";
    return (row[index] ?? "").trim();
  };

  for (let r = header.index + 1; r < cells.length; r += 1) {
    const row = cells[r] ?? [];
    const linkColumn = columnIndex.get("url");
    const linkCell = linkColumn === undefined ? null : (hyperlinks[r]?.[linkColumn] ?? null);
    const urlText = pick(row, "url");
    const url = /^https?:\/\//i.test(urlText) ? urlText : (linkCell ?? urlText);

    const raw: RawImportRow = {
      // Spreadsheet row number (1-based, header included) so the admin can
      // find the row in Excel without guessing.
      rowNumber: r + 1,
      serial: pick(row, "serial"),
      leetcodeNumber: pick(row, "leetcodeNumber"),
      title: pick(row, "title"),
      slug: pick(row, "slug"),
      url,
      topic: pick(row, "topic"),
      difficulty: pick(row, "difficulty"),
    };

    if (!raw.title && !raw.slug && !raw.url) {
      ignoredRows += 1;
      continue;
    }
    rows.push(raw);
  }

  return { rows, ignoredRows };
}

/**
 * Reads the first worksheet (or the CSV body) and maps it to raw rows.
 * Throws ImportFileError when the file itself cannot be used.
 */
export async function parseQuestionWorkbook(
  buffer: Buffer,
  fileName: string
): Promise<ParsedImportFile> {
  const lower = (fileName || "").toLowerCase();
  let matrix: SheetMatrix;

  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const cells = parseCsvMatrix(text);
    matrix = { cells, hyperlinks: cells.map((row) => row.map(() => null)) };
    if (cells.length === 0) {
      throw new ImportFileError("The CSV file is empty.");
    }
  } else if (lower.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw new ImportFileError("Could not read the Excel file. Re-save it as .xlsx and try again.");
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount === 0) {
      throw new ImportFileError("The workbook has no worksheet with data.");
    }
    matrix = matrixFromWorksheet(worksheet);
  } else if (lower.endsWith(".xls")) {
    throw new ImportFileError("Legacy .xls files are not supported. Save the file as .xlsx or .csv.");
  } else {
    throw new ImportFileError("Unsupported file type. Upload an .xlsx or .csv file.");
  }

  const header = detectHeaderRow(matrix.cells);
  if (!header) {
    throw new ImportFileError(
      "No header row found. The first row must name the columns: Question Name plus LeetCode Link or Slug."
    );
  }

  const headers: Partial<Record<ImportColumn, string>> = {};
  for (const [column, index] of header.columns.entries()) {
    headers[column] = (matrix.cells[header.index]?.[index] ?? "").trim();
  }

  if (!header.columns.has("title")) {
    throw new ImportFileError('Missing "Question Name" column (accepted headers: Name, Title, Question).');
  }
  if (!header.columns.has("url") && !header.columns.has("slug")) {
    throw new ImportFileError(
      'The sheet needs either a "LeetCode Link" column or a "Slug" column so each question can be identified.'
    );
  }

  const { rows, ignoredRows } = buildRawRows(matrix, header);

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(
      `This file has ${rows.length} question rows; the limit is ${MAX_IMPORT_ROWS} per import. Split it into smaller files.`
    );
  }

  return { rows, headers, ignoredRows };
}

// ---------------------------------------------------------------------------
// Validation (pure)
// ---------------------------------------------------------------------------

export type ImportRejectCode =
  | "MISSING_TITLE"
  | "TITLE_TOO_LONG"
  | "MISSING_SLUG_AND_URL"
  | "INVALID_URL"
  | "INVALID_SLUG"
  | "INVALID_SERIAL"
  | "INVALID_LEETCODE_NUMBER"
  | "INVALID_DIFFICULTY"
  | "MALFORMED_ROW";

export interface ValidatedImportRow {
  rowNumber: number;
  title: string;
  slug: string;
  externalKey: string;
  url: string;
  topic: string | null;
  serial: number | null;
  leetcodeNumber: number | null;
  difficulty: Difficulty | null;
  warning: string | null;
}

export type ValidateRowResult =
  | { ok: true; value: ValidatedImportRow }
  | { ok: false; code: ImportRejectCode; reason: string };

/** Lowercases and hyphenates a slug; strict validity is checked separately. */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function parsePositiveInt(raw: string): number | null | "INVALID" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return "INVALID";
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(value) || value < 1) return "INVALID";
  return value;
}

function parseDifficultyColumn(raw: string): Difficulty | null | "INVALID" {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  if (trimmed === "EASY" || trimmed === Difficulty.EASY) return Difficulty.EASY;
  if (trimmed === "MEDIUM" || trimmed === Difficulty.MEDIUM) return Difficulty.MEDIUM;
  if (trimmed === "HARD" || trimmed === Difficulty.HARD) return Difficulty.HARD;
  return "INVALID";
}

/**
 * Validates one spreadsheet row. Slugs are normalized (spaces/underscores ->
 * hyphen) before strict validation; anything that still fails is rejected with
 * a human-readable reason instead of being written.
 */
export function validateImportRow(row: RawImportRow): ValidateRowResult {
  const title = row.title.trim();
  if (!title) {
    return { ok: false, code: "MISSING_TITLE", reason: "Question name is missing." };
  }
  if (title.length > 300) {
    return { ok: false, code: "TITLE_TOO_LONG", reason: "Question name is longer than 300 characters." };
  }
  if (!row.url.trim() && !row.slug.trim()) {
    return {
      ok: false,
      code: "MISSING_SLUG_AND_URL",
      reason: "No LeetCode link or slug on this row.",
    };
  }

  let slug: string;
  let externalKey: string;
  let url: string;
  let warning: string | null = null;

  if (row.url.trim()) {
    try {
      const parsed = parseProblemUrl(row.url.trim());
      slug = parsed.rawSlug;
      externalKey = parsed.externalKey;
      url = parsed.normalizedUrl;
      if (row.slug.trim() && normalizeSlug(row.slug) !== slug) {
        warning = `Slug column ("${row.slug.trim()}") did not match the link; used "${slug}".`;
      }
    } catch (error) {
      return {
        ok: false,
        code: "INVALID_URL",
        reason: error instanceof Error ? error.message : "Invalid LeetCode URL.",
      };
    }
  } else {
    slug = normalizeSlug(row.slug);
    if (!isValidSlug(slug)) {
      return {
        ok: false,
        code: "INVALID_SLUG",
        reason: `Slug "${row.slug.trim()}" is not a valid LeetCode slug (lowercase letters, numbers and single hyphens).`,
      };
    }
    externalKey = `leetcode:${slug}`;
    url = `https://leetcode.com/problems/${slug}/`;
  }

  const serial = parsePositiveInt(row.serial);
  if (serial === "INVALID") {
    return {
      ok: false,
      code: "INVALID_SERIAL",
      reason: `Serial number "${row.serial.trim()}" is not a whole number greater than zero.`,
    };
  }

  const leetcodeNumber = parsePositiveInt(row.leetcodeNumber);
  if (leetcodeNumber === "INVALID") {
    return {
      ok: false,
      code: "INVALID_LEETCODE_NUMBER",
      reason: `LeetCode question number "${row.leetcodeNumber.trim()}" is not a whole number greater than zero.`,
    };
  }

  const difficulty = parseDifficultyColumn(row.difficulty);
  if (difficulty === "INVALID") {
    return {
      ok: false,
      code: "INVALID_DIFFICULTY",
      reason: `Difficulty "${row.difficulty.trim()}" is not one of Easy, Medium or Hard.`,
    };
  }

  return {
    ok: true,
    value: {
      rowNumber: row.rowNumber,
      title,
      slug,
      externalKey,
      url,
      topic: row.topic.trim() || null,
      serial,
      leetcodeNumber,
      difficulty,
      warning,
    },
  };
}

/**
 * Picks the position for a row: its serial number when free, otherwise the
 * next free slot (reported as a warning so the admin can reorder if needed).
 */
export function resolvePosition(
  serial: number | null,
  usedPositions: Set<number>,
  nextPosition: number
): { position: number; next: number; warning: string | null } {
  let position = nextPosition;
  let warning: string | null = null;

  if (serial !== null) {
    if (!usedPositions.has(serial)) {
      position = serial;
    } else {
      warning = `Serial ${serial} is already used in this sheet — appended at position ${nextPosition}.`;
    }
  }

  usedPositions.add(position);
  return { position, next: Math.max(nextPosition, position + 1), warning };
}

// ---------------------------------------------------------------------------
// Import (database)
// ---------------------------------------------------------------------------

export type ImportRowStatus = "IMPORTED" | "DUPLICATE" | "REJECTED" | "FAILED";

export interface ImportRowOutcome {
  rowNumber: number;
  status: ImportRowStatus;
  serial: number | null;
  leetcodeNumber: number | null;
  title: string;
  slug: string | null;
  url: string | null;
  difficulty: Difficulty | null;
  position: number | null;
  reason: string | null;
  warning: string | null;
}

export interface QuestionImportSummary {
  sheet: { id: string; name: string; slug: string };
  fileName: string;
  totalRows: number;
  imported: number;
  duplicates: number;
  rejected: number;
  failed: number;
  notImported: number;
  durationMs: number;
  rows: ImportRowOutcome[];
}

export interface ImportQuestionsInput {
  sheetId: string;
  adminId: string;
  fileName: string;
  rows: RawImportRow[];
  /** Injectable for tests; defaults to the LeetCode provider. */
  resolveMetadata?: (externalKey: string) => Promise<PlatformProblemMetadata | null>;
}

function outcomeFromRaw(row: RawImportRow, status: ImportRowStatus, reason: string): ImportRowOutcome {
  return {
    rowNumber: row.rowNumber,
    status,
    serial: /^\d+$/.test(row.serial.trim()) ? Number(row.serial.trim()) : null,
    leetcodeNumber: /^\d+$/.test(row.leetcodeNumber.trim()) ? Number(row.leetcodeNumber.trim()) : null,
    title: row.title.trim(),
    slug: row.slug.trim() || null,
    url: row.url.trim() || null,
    difficulty: null,
    position: null,
    reason,
    warning: null,
  };
}

function outcomeFromValidated(
  row: ValidatedImportRow,
  status: ImportRowStatus,
  reason: string | null
): ImportRowOutcome {
  return {
    rowNumber: row.rowNumber,
    status,
    serial: row.serial,
    leetcodeNumber: row.leetcodeNumber,
    title: row.title,
    slug: row.slug,
    url: row.url,
    difficulty: row.difficulty,
    position: null,
    reason,
    warning: row.warning,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const current = items[cursor];
      cursor += 1;
      await worker(current);
    }
  });
  await Promise.all(workers);
}

export async function importQuestionsForSheet(
  input: ImportQuestionsInput
): Promise<QuestionImportSummary> {
  const startedAt = Date.now();
  const { sheetId, adminId, fileName, rows } = input;
  const resolveMetadata =
    input.resolveMetadata ??
    ((externalKey: string) => getProvider().fetchProblemMetadata(externalKey));

  if (rows.length === 0) {
    throw new ImportFileError("The file has no question rows. Add a header row and at least one question.");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(
      `This file has ${rows.length} rows; the limit is ${MAX_IMPORT_ROWS} per import. Split it into smaller files.`
    );
  }

  const sheet = await prisma.sheet.findUnique({
    where: { id: sheetId },
    select: { id: true, name: true, slug: true },
  });
  if (!sheet) throw new ApiError("NOT_FOUND", 404, "Sheet not found.");

  const outcomes = new Map<number, ImportRowOutcome>();

  // 1. Validate every row independently.
  const validRows: ValidatedImportRow[] = [];
  for (const row of rows) {
    const result = validateImportRow(row);
    if (result.ok) {
      validRows.push(result.value);
    } else {
      outcomes.set(row.rowNumber, outcomeFromRaw(row, "REJECTED", result.reason));
    }
  }

  // 2. Duplicates inside the uploaded file.
  const firstSeenAt = new Map<string, number>();
  const candidates: ValidatedImportRow[] = [];
  for (const row of validRows) {
    const firstRow = firstSeenAt.get(row.externalKey);
    if (firstRow !== undefined) {
      outcomes.set(
        row.rowNumber,
        outcomeFromValidated(row, "DUPLICATE", `Duplicate of row ${firstRow} in this file.`)
      );
      continue;
    }
    firstSeenAt.set(row.externalKey, row.rowNumber);
    candidates.push(row);
  }

  // 3. Duplicates already in THIS sheet (other sheets are irrelevant).
  const existingLinks = await prisma.sheetQuestion.findMany({
    where: { sheetId },
    select: { position: true, question: { select: { externalKey: true } } },
  });

  const usedPositions = new Set<number>();
  const existingPositionByKey = new Map<string, number>();
  for (const link of existingLinks) {
    usedPositions.add(link.position);
    if (link.question?.externalKey) {
      existingPositionByKey.set(link.question.externalKey, link.position);
    }
  }
  let nextPosition = usedPositions.size > 0 ? Math.max(...usedPositions) + 1 : 1;

  const toInsert: ValidatedImportRow[] = [];
  for (const row of candidates) {
    const position = existingPositionByKey.get(row.externalKey);
    if (position !== undefined) {
      outcomes.set(
        row.rowNumber,
        outcomeFromValidated(row, "DUPLICATE", `Already in this sheet at position ${position}.`)
      );
      continue;
    }
    toInsert.push(row);
  }

  // 4. Ask LeetCode only where the sheet itself cannot supply a difficulty.
  const metadata = new Map<string, PlatformProblemMetadata | null>();
  const keysNeedingMetadata = [
    ...new Set(toInsert.filter((row) => row.difficulty === null).map((row) => row.externalKey)),
  ];
  await mapWithConcurrency(keysNeedingMetadata, 5, async (externalKey) => {
    const resolved = await resolveMetadata(externalKey).catch(() => null);
    metadata.set(externalKey, resolved);
  });

  // 5. Insert one by one; a failed row never aborts the batch.
  for (const row of toInsert) {
    const meta = metadata.get(row.externalKey) ?? null;
    const warnings: string[] = [];
    if (row.warning) warnings.push(row.warning);

    const difficulty: Difficulty = row.difficulty ?? meta?.difficulty ?? Difficulty.UNKNOWN;
    const topic = row.topic ?? meta?.topic ?? "General";
    const tags = meta?.tags ?? [];

    if (row.difficulty === null && difficulty === Difficulty.UNKNOWN) {
      warnings.push(
        "LeetCode difficulty could not be resolved — set it in the Questions tab (it scores 0 until then)."
      );
    }

    try {
      const existingQuestion = await prisma.question.findUnique({
        where: { externalKey: row.externalKey },
        select: { id: true, difficulty: true, topic: true, tags: true, metadata: true },
      });

      let questionId: string;
      if (existingQuestion) {
        const data: Prisma.QuestionUpdateInput = {};
        if (existingQuestion.difficulty === Difficulty.UNKNOWN && difficulty !== Difficulty.UNKNOWN) {
          data.difficulty = difficulty;
        }
        if ((!existingQuestion.topic || existingQuestion.topic === "General") && topic !== "General") {
          data.topic = topic;
        }
        if ((existingQuestion.tags?.length ?? 0) === 0 && tags.length > 0) {
          data.tags = tags;
        }
        if (row.leetcodeNumber !== null) {
          const previous = (existingQuestion.metadata ?? {}) as Record<string, unknown>;
          if (previous.leetcodeNumber !== row.leetcodeNumber) {
            data.metadata = { ...previous, leetcodeNumber: row.leetcodeNumber };
          }
        }
        if (Object.keys(data).length > 0) {
          await prisma.question.update({ where: { id: existingQuestion.id }, data });
        }
        questionId = existingQuestion.id;
      } else {
        const created = await prisma.question.create({
          data: {
            externalKey: row.externalKey,
            title: row.title,
            url: row.url,
            difficulty,
            topic,
            tags,
            createdById: adminId,
            metadata: row.leetcodeNumber !== null ? { leetcodeNumber: row.leetcodeNumber } : undefined,
          },
          select: { id: true },
        });
        questionId = created.id;
      }

      const plan = resolvePosition(row.serial, usedPositions, nextPosition);
      nextPosition = plan.next;
      if (plan.warning) warnings.push(plan.warning);

      await prisma.sheetQuestion.create({ data: { sheetId, questionId, position: plan.position } });

      outcomes.set(row.rowNumber, {
        ...outcomeFromValidated(row, "IMPORTED", null),
        difficulty,
        position: plan.position,
        warning: warnings.length > 0 ? warnings.join(" ") : null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        outcomes.set(row.rowNumber, outcomeFromValidated(row, "DUPLICATE", "Already in this sheet."));
      } else {
        console.error(`[question-import] row ${row.rowNumber} (${row.externalKey}) failed`, error);
        outcomes.set(
          row.rowNumber,
          outcomeFromValidated(
            row,
            "FAILED",
            "Could not be saved. Retry this row; if it keeps failing the question data is invalid."
          )
        );
      }
    }
  }

  // Post-commit: sheet catalogue, sheet view and leaderboards must refresh.
  await invalidateTags(await sheetCatalogueInvalidationTags(sheet.slug));

  const ordered = [...outcomes.values()].sort((a, b) => a.rowNumber - b.rowNumber);
  const imported = ordered.filter((row) => row.status === "IMPORTED").length;
  const duplicates = ordered.filter((row) => row.status === "DUPLICATE").length;
  const rejected = ordered.filter((row) => row.status === "REJECTED").length;
  const failed = ordered.filter((row) => row.status === "FAILED").length;

  return {
    sheet,
    fileName,
    totalRows: rows.length,
    imported,
    duplicates,
    rejected,
    failed,
    notImported: rows.length - imported,
    durationMs: Date.now() - startedAt,
    rows: ordered,
  };
}
