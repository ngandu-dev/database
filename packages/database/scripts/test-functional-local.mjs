import { spawn } from "node:child_process";

const forwardedArgs = process.argv.slice(2);

const targets = [
  {
    name: "sqlite3",
    env: {
      DATAZEN_FUNCTIONAL_PLATFORM: "sqlite3",
      DATAZEN_FUNCTIONAL_CONFIG_FILE: "ci/github/vitest/sqlite3.json",
    },
  },
  {
    name: "mysql",
    env: {
      DATAZEN_FUNCTIONAL_PLATFORM: "mysql",
      DATAZEN_FUNCTIONAL_CONFIG_FILE: "ci/github/vitest/mysql.json",
      DATAZEN_FUNCTIONAL_MARIADB_PORT: "3308",
      DATAZEN_FUNCTIONAL_MARIADB_PRIVILEGED_PORT: "3308",
    },
  },
  {
    name: "mariadb",
    env: {
      DATAZEN_FUNCTIONAL_PLATFORM: "mariadb",
      DATAZEN_FUNCTIONAL_CONFIG_FILE: "ci/github/vitest/mariadb.json",
      DATAZEN_FUNCTIONAL_MARIADB_PORT: "3307",
      DATAZEN_FUNCTIONAL_MARIADB_PRIVILEGED_PORT: "3307",
    },
  },
  {
    name: "postgresql",
    env: {
      DATAZEN_FUNCTIONAL_PLATFORM: "postgresql",
      DATAZEN_FUNCTIONAL_CONFIG_FILE: "ci/github/vitest/postgresql.json",
    },
  },
  {
    name: "sqlserver",
    env: {
      DATAZEN_FUNCTIONAL_PLATFORM: "sqlserver",
      DATAZEN_FUNCTIONAL_CONFIG_FILE: "ci/github/vitest/sqlserver.json",
    },
  },
];

for (const target of targets) {
  //eslint-disable-next-line no-await-in-loop
  await runTarget(target.name, target.env, forwardedArgs);
}

async function runTarget(name, targetEnv, args) {
  console.log(`\n=== Functional tests (${name}) ===`);

  const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "node";
  const nodeArgs = ["scripts/test-functional.mjs", ...args];
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "node", ...nodeArgs] : nodeArgs;

  const code = await new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...targetEnv,
      },
      stdio: "inherit",
    });

    child.on("exit", (exitCode, signal) => {
      if (signal !== null) {
        process.kill(process.pid, signal);
        return;
      }

      resolve(exitCode ?? 1);
    });
  });

  if (code !== 0) {
    process.exit(code);
  }
}
