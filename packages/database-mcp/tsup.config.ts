import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli/index.ts" },
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  dts: false,
  format: ["esm"],
  minify: true,
  platform: "node",
  sourcemap: true,
  target: "node20",
});
