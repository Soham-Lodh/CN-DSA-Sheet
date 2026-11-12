import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ExcelJS is a Node-only library used by the admin import/report routes.
  // Keeping it external avoids webpack bundling its dynamic requires.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
