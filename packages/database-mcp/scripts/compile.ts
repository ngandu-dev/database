import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeSqliteBinding = resolve(
  packageDirectory,
  "node_modules/sqlite3/build/Release/node_sqlite3.node",
);
const outputPath = process.env.MCP_BINARY_OUTFILE
  ? resolve(packageDirectory, process.env.MCP_BINARY_OUTFILE)
  : resolve(packageDirectory, "dist/bin/ngandu-database-mcp");

if (!existsSync(nativeSqliteBinding)) {
  throw new Error(
    "The sqlite3 native binding is missing. Install dependencies on the target runner before compiling.",
  );
}

const result = await Bun.build({
  entrypoints: [resolve(packageDirectory, "src/cli/index.ts")],
  target: "bun",
  format: "esm",
  minify: true,
  sourcemap: "inline",
  compile: {
    outfile: outputPath,
    autoloadDotenv: false,
    autoloadBunfig: false,
  },
  plugins: [
    {
      name: "embed-sqlite3-native-binding",
      setup(builder) {
        builder.onLoad({ filter: /sqlite3-binding\.js$/ }, () => ({
          contents: `module.exports = require(${JSON.stringify(nativeSqliteBinding)});`,
          loader: "js",
        }));
      },
    },
  ],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exitCode = 1;
}
