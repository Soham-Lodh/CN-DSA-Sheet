import { getCurrentProfile } from "@/lib/auth";
import {
  getAllSheetsWithUserProgress,
  getSheetWithUserProgress,
} from "@/lib/services/sheets";
import type { SheetProgressSummary } from "@/lib/services/sheets";
import { getSheetLeaderboard } from "@/lib/services/leaderboard";
import type { SheetLeaderboardEntry } from "@/lib/services/leaderboard";
import { SheetsView } from "@/components/sheets/SheetsView";

export const dynamic = "force-dynamic";

export const metadata = { title: "DSA Sheets" };

export default async function SheetsPage() {
  const profile = await getCurrentProfile().catch(() => null);
  const sheets = await getAllSheetsWithUserProgress(profile?.id);

  let activeSheetData: SheetProgressSummary | null = null;
  let sheetLeaderboard: SheetLeaderboardEntry[] = [];

  if (sheets.length > 0) {
    activeSheetData = await getSheetWithUserProgress(sheets[0].slug, profile?.id);
    if (activeSheetData) {
      sheetLeaderboard = await getSheetLeaderboard(activeSheetData.sheet.id);
    }
  }

  return (
    <SheetsView
      initialSheets={sheets}
      activeSheetData={activeSheetData}
      sheetLeaderboard={sheetLeaderboard}
    />
  );
}
