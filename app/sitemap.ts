import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SheetStatus } from "@prisma/client";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteConfig.url, changeFrequency: "weekly", priority: 1 },
    { url: `${siteConfig.url}/leaderboard`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteConfig.url}/sheets`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const sheets = await prisma.sheet.findMany({
      where: { status: SheetStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
    });
    return [
      ...staticRoutes,
      ...sheets.map((sheet) => ({
        url: `${siteConfig.url}/sheets/${sheet.slug}`,
        lastModified: sheet.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    // Database unavailable (e.g. prerendering without env): ship static routes only.
    return staticRoutes;
  }
}
