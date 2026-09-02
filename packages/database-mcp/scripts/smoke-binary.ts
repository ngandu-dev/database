import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import sqlite3 from "sqlite3";

const binaryArgument = process.argv[2];
if (binaryArgument === undefined) {
  throw new Error("Pass the compiled executable path as the first argument.");
}

const binary = resolve(binaryArgument);
const directory = await mkdtemp(join(tmpdir(), "ngandu-database-mcp-smoke-"));
const databasePath = join(directory, "smoke.sqlite");

try {
  await createFixture(databasePath);
  const transport = new StdioClientTransport({
    command: binary,
    env: {
      ...stringEnvironment(process.env),
      DATABASE_URL: pathToFileURL(databasePath).href,
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "native-smoke-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    if (!tools.some((tool) => tool.name === "list_tables")) {
      throw new Error("The MCP handshake did not expose list_tables.");
    }
    const result = await client.callTool({ name: "list_tables", arguments: {} });
    const structured = result.structuredContent;
    if (
      result.isError === true ||
      structured === null ||
      typeof structured !== "object" ||
      !("tables" in structured) ||
      !Array.isArray(structured.tables) ||
      !structured.tables.includes("smoke")
    ) {
      throw new Error("The native SQLite MCP smoke call returned an unexpected result.");
    }
  } finally {
    await client.close();
    await transport.close();
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

async function createFixture(path: string): Promise<void> {
  const database = await new Promise<sqlite3.Database>((resolveDatabase, reject) => {
    const opened = new sqlite3.Database(path, (error) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolveDatabase(opened);
    });
  });
  await new Promise<void>((resolveExec, reject) => {
    database.exec("CREATE TABLE smoke (id INTEGER PRIMARY KEY, value TEXT NOT NULL);", (error) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolveExec();
    });
  });
  await new Promise<void>((resolveClose, reject) => {
    database.close((error) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
}

function stringEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}
