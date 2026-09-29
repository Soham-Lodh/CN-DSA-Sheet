import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/leaderboard", "/sheets"],
        disallow: ["/admin", "/dashboard", "/profile", "/api/", "/auth/"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
