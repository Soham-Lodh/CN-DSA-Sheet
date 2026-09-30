import type { Config } from "tailwindcss";

/** Obsidian Circuit. */
export const colorTokens = {
  brand: {
    primary: "#FF6A00",
    hover: "#E55F00",
    accent: "#FFA500",
    glow: "rgba(255, 106, 0, 0.15)",
  },
  surface: {
    base: "#0A0E16",
    page: "#0F131C",
    card: "#181C24",
    elevated: "#202634",
    input: "#262C3A",
  },
  content: {
    primary: "#FFFFFF",
    secondary: "#94A3B8",
    muted: "#64748B",
    inverse: "#0F131C",
  },
  outline: {
    subtle: "#2B3345",
    hairline: "rgba(255, 255, 255, 0.08)",
  },
  status: {
    success: { DEFAULT: "#10B981", subtle: "rgba(16, 185, 129, 0.15)" },
    warning: { DEFAULT: "#F59E0B", subtle: "rgba(245, 158, 11, 0.15)" },
    danger: { DEFAULT: "#EF4444", subtle: "rgba(239, 68, 68, 0.15)" },
    info: { DEFAULT: "#38BDF8", subtle: "rgba(56, 189, 248, 0.15)" },
  },
  rank: {
    gold: "#FFA500",
    silver: "#38BDF8",
    bronze: "#D97706",
  },
} as const;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ...colorTokens,
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-mono)", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
