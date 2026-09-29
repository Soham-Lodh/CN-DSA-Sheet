import { getCurrentProfile } from "@/lib/auth";
import {
  getAllSheetsWithUserProgress,
  getSheetWithUserProgress,
} from "@/lib/services/sheets";
import { getSheetLeaderboard } from "@/lib/services/leaderboard";
import { SheetsView } from "@/components/sheets/SheetsView";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sheet = await getSheetWithUserProgress(slug);
  return sheet ? { title: sheet.sheet.name } : { title: "Sheet not found" };
}

export default async function SheetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getCurrentProfile().catch(() => null);

  const [sheets, activeSheetData] = await Promise.all([
    getAllSheetsWithUserProgress(profile?.id),
    getSheetWithUserProgress(slug, profile?.id),
  ]);

  if (!activeSheetData) {
    notFound();
  }

  const sheetLeaderboard = await getSheetLeaderboard(activeSheetData.sheet.id);

  return (
    <SheetsView
      initialSheets={sheets}
      activeSheetData={activeSheetData}
      sheetLeaderboard={sheetLeaderboard}
    />
  );
}
