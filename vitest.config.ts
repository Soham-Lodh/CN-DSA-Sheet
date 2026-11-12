import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Tests import .tsx components (admin UI render checks); Next's tsconfig
  // keeps jsx=preserve for its own compiler, so set the transform here.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
