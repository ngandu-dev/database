import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import sqlite3 from "sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SERVER_INSTRUCTIONS } from "../server";

describe("database MCP stdio protocol", () => {
  let directory: string;
  let databasePath: string;
  let client: Client;
  let transport: StdioClientTransport;
  let stderr = "";

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "ngandu-database-mcp-"));
    databasePath = join(directory, "fixture.sqlite");
    await createFixture(databasePath);

    const cliPath = resolve(import.meta.dirname, "../../dist/cli.js");
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [cliPath],
      env: {
        ...stringEnvironment(process.env),
        DATABASE_URL: `file://${databasePath}`,
      },
      stderr: "pipe",
    });
    transport.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    client = new Client({ name: "database-mcp-test", version: "1.0.0" });
    await client.connect(transport);
  }, 20_000);

  afterAll(async () => {
    await client?.close();
    await transport?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("initializes with instructions and the intended annotations", async () => {
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "get_database_info",
      "list_databases",
      "list_schemas",
      "list_tables",
      "list_views",
      "describe_table",
      "execute_query",
    ]);
    expect(tools.find((tool) => tool.name === "list_tables")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((tool) => tool.name === "execute_query")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
  });

  it("returns metadata as text and structured content", async () => {
    const databases = await client.callTool({ name: "list_databases", arguments: {} });
    expect(databases.structuredContent).toEqual({ supported: false });

    const schemas = await client.callTool({ name: "list_schemas", arguments: {} });
    expect(schemas.structuredContent).toEqual({ supported: false });

    const tables = await client.callTool({ name: "list_tables", arguments: {} });
    expect(tables.isError).not.toBe(true);
    expect(tables.structuredContent).toMatchObject({ tables: ["users"], count: 1 });
    expect(JSON.parse(textContent(tables))).toEqual(tables.structuredContent);

    const views = await client.callTool({ name: "list_views", arguments: {} });
    expect(views.structuredContent).toMatchObject({ views: ["active_users"], count: 1 });

    const description = await client.callTool({
      name: "describe_table",
      arguments: { table: "users" },
    });
    expect(description.structuredContent).toMatchObject({
      table: "users",
      primary_key: ["id"],
    });
  });

  it("supports parameters and applies the 200/1000 output limits", async () => {
    const defaultLimit = await client.callTool({
      name: "execute_query",
      arguments: { sql: "SELECT id, name FROM users WHERE id > ? ORDER BY id", parameters: [0] },
    });
    expect(defaultLimit.structuredContent).toMatchObject({
      columns: ["id", "name"],
      returned_row_count: 200,
      truncated: true,
    });

    const ceiling = await client.callTool({
      name: "execute_query",
      arguments: { sql: "SELECT id FROM users ORDER BY id", max_rows: 1000 },
    });
    expect(ceiling.structuredContent).toMatchObject({
      returned_row_count: 1000,
      truncated: true,
    });
  });

  it("lets the database reject writes", async () => {
    const result = await client.callTool({
      name: "execute_query",
      arguments: { sql: "INSERT INTO users(name) VALUES (?)", parameters: ["Grace"] },
    });
    expect(result.isError).toBe(true);
    expect(textContent(result).toLowerCase()).toContain("readonly");
  });

  it("keeps diagnostics on stderr", () => {
    expect(stderr).toContain("serving MCP over stdio");
    expect(stderr).not.toContain(databasePath);
  });
});

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

  const values = Array.from(
    { length: 1_205 },
    (_, index) => `(${index + 1}, 'user-${index + 1}')`,
  ).join(",");
  await new Promise<void>((resolveExec, reject) => {
    database.exec(
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE VIEW active_users AS SELECT id, name FROM users WHERE active = 1;
      INSERT INTO users(id, name) VALUES ${values};`,
      (error) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolveExec();
      },
    );
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

function textContent(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content.find((item) => item.type === "text");
  return content?.type === "text" ? content.text : "";
}
