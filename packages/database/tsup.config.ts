import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/_index.ts",
    connections: "src/connections/_index.ts",
    driver: "src/driver/_index.ts",
    exception: "src/exception/_index.ts",
    logging: "src/logging/_index.ts",
    platforms: "src/platforms/_index.ts",
    portability: "src/portability/_index.ts",
    query: "src/query/_index.ts",
    tools: "src/tools/_index.ts",
    types: "src/types/_index.ts",
  },
  clean: true,
  format: ["cjs", "esm"],
  dts: true,
});
