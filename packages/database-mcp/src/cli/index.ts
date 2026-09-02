import { type StdioServerHandle, serveStdio } from "@modelcontextprotocol/server/stdio";

import { PACKAGE_NAME, VERSION } from "../constants";
import { createOwnedConnection } from "../database/connection-factory";
import { DatabaseService } from "../database/service";
import { safeErrorMessage, secretsFromDsn } from "../redact";
import { createMcpServer } from "../server";
import { HELP_TEXT, parseCliOptions } from "./options";

interface ProcessEnvironment {
  [key: string]: string | undefined;
}

export async function runCli(argv: string[], environment: ProcessEnvironment): Promise<void> {
  const options = parseCliOptions(argv);
  if (options.mode === "help") {
    process.stdout.write(HELP_TEXT);
    return;
  }
  if (options.mode === "version") {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const dsn = environment[options.databaseUrlEnv];
  if (dsn === undefined || dsn.trim().length === 0) {
    throw new Error(`Environment variable ${options.databaseUrlEnv} is not set or is empty.`);
  }
  const secrets = secretsFromDsn(dsn);

  const owned = await createOwnedConnection(dsn).catch((error: unknown) => {
    throw new Error(safeErrorMessage(error, secrets));
  });
  const service = new DatabaseService({
    connection: owned.connection,
    defaultMaxRows: options.defaultMaxRows,
    driver: owned.driver,
  });

  if (options.mode === "check") {
    try {
      process.stdout.write(`${JSON.stringify(await service.getDatabaseInfo())}\n`);
    } finally {
      await service.close();
    }
    return;
  }

  process.stderr.write(`${PACKAGE_NAME} ${VERSION} connected; serving MCP over stdio.\n`);
  let handle: StdioServerHandle | undefined;
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      await handle?.close();
    } finally {
      await service.close();
    }
  };

  handle = serveStdio(() => createMcpServer(service, secrets), {
    onerror: (error) => {
      process.stderr.write(`MCP transport error: ${safeErrorMessage(error, secrets)}\n`);
    },
  });

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.stdin.once("end", () => {
    void shutdown();
  });
}

runCli(process.argv.slice(2), process.env).catch((error: unknown) => {
  process.stderr.write(`Error: ${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
});
