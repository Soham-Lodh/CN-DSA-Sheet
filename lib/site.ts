export const siteConfig = {
  name: "Coding Ninjas KIIT Chapter",
  shortName: "CN KIIT",
  title: "DSA Tracker & Leaderboard",
  description:
    "Official DSA Sheet tracker, automated platform sync, and competitive programming leaderboard for KIIT University students.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
} as const;
