import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.MCP_READER_DATABASE_URL;
const driver = process.env.MCP_TEST_DRIVER;
const hasSchemas = driver === "postgresql" || driver === "sqlserver";

describe.skipIf(databaseUrl === undefined)("database MCP vendor protocol", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    const cliPath = resolve(import.meta.dirname, "../../dist/cli.js");
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [cliPath],
      env: {
        ...stringEnvironment(process.env),
        DATABASE_URL: databaseUrl ?? "",
      },
      stderr: "pipe",
    });
    client = new Client({ name: "vendor-integration-test", version: "1.0.0" });
    await client.connect(transport);
  }, 30_000);

  afterAll(async () => {
    await client?.close();
    await transport?.close();
  });

  it("discovers databases, schemas, tables, and views", async () => {
    const databases = await callStructured(client, "list_databases", {});
    expect(databases.supported).toBe(true);

    const schemas = await callStructured(client, "list_schemas", {});
    expect(schemas.supported).toBe(hasSchemas);

    const schemaArguments = hasSchemas ? { schema: "mcp_context" } : {};
    const tables = await callStructured(client, "list_tables", schemaArguments);
    expect(stringArray(tables.tables).some((name) => name.toLowerCase().includes("items"))).toBe(
      true,
    );

    const views = await callStructured(client, "list_views", schemaArguments);
    expect(stringArray(views.views).some((name) => name.toLowerCase().includes("item_names"))).toBe(
      true,
    );
  });

  it("describes and queries the fixture", async () => {
    const description = await callStructured(client, "describe_table", {
      table: "items",
      ...(hasSchemas ? { schema: "mcp_context" } : {}),
    });
    expect(description.primary_key).toEqual(["id"]);

    const table = hasSchemas ? "mcp_context.items" : "items";
    const query = await callStructured(client, "execute_query", {
      sql: `SELECT id, name FROM ${table} WHERE id > ? ORDER BY id`,
      parameters: [0],
    });
    expect(query.columns).toEqual(["id", "name"]);
    expect(query.returned_row_count).toBe(2);
  });

  it("relies on reader permissions to reject writes", async () => {
    const table = hasSchemas ? "mcp_context.items" : "items";
    const result = await client.callTool({
      name: "execute_query",
      arguments: { sql: `UPDATE ${table} SET name = ? WHERE id = ?`, parameters: ["changed", 1] },
    });
    expect(result.isError).toBe(true);
  });
});

async function callStructured(
  client: Client,
  name: string,
  argumentsValue: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await client.callTool({ name, arguments: argumentsValue });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toBeTypeOf("object");
  return result.structuredContent as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}
