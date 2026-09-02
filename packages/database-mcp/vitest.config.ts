import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@ngandu-dev/database": fileURLToPath(new URL("../database/src/_index.ts", import.meta.url)),
      "@ngandu-dev/database/types": fileURLToPath(
        new URL("../database/src/types/_index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      exclude: ["dist/**", "node_modules/**", "src/**/*.test.ts"],
    },
  },
});
