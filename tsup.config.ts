import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "sql-forge": "src/sql-forge.ts",
  },
  clean: true,
  format: ["cjs", "esm"],
  dts: true,
});
