import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const forwarded = [];
const env = { ...process.env };

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === "--platform" || arg === "-p") {
    const next = args[index + 1];
    if (next !== undefined) {
      env.DATAZEN_FUNCTIONAL_PLATFORM ??= next;
      index += 1;
      continue;
    }
  }

  if (arg.startsWith("--platform=")) {
    env.DATAZEN_FUNCTIONAL_PLATFORM ??= arg.slice("--platform=".length);
    continue;
  }

  forwarded.push(arg);
}

const bunCommand = "bun";
const vitestArgs = [
  "x",
  "vitest",
  "run",
  "--fileParallelism=false",
  "src/__tests__/functional",
  "--exclude",
  "src/__tests__/functional/_helpers/**/*.test.ts",
  ...forwarded,
];

console.log(
  `Running functional tests for platform=${env.DATAZEN_FUNCTIONAL_PLATFORM ?? "sqlite3"} (${vitestArgs.join(" ")})`,
);

const spawnCommand = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : bunCommand;
const spawnArgs =
  process.platform === "win32" ? ["/d", "/s", "/c", bunCommand, ...vitestArgs] : vitestArgs;

const child = spawn(spawnCommand, spawnArgs, {
  cwd: process.cwd(),
  env: Object.fromEntries(
    Object.entries(env).filter((entry) => entry[1] !== undefined && entry[1] !== null),
  ),
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
