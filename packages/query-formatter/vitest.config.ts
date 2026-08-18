import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["references/**", "dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      exclude: ["references/**", "dist/**", "node_modules/**", "src/**/*.test.ts"],
    },
  },
});
