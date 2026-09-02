import { McpServer } from "@modelcontextprotocol/server";

import { PACKAGE_NAME, VERSION } from "./constants";
import { DatabaseService } from "./database/service";
import { METADATA_ANNOTATIONS, QUERY_ANNOTATIONS } from "./tools/annotations";
import { callTool } from "./tools/result";
import {
  databaseInfoOutputSchema,
  describeTableInputSchema,
  describeTableOutputSchema,
  emptyInputSchema,
  executeQueryInputSchema,
  executeQueryOutputSchema,
  listDatabasesOutputSchema,
  listNamesOutputSchema,
  listSchemasOutputSchema,
  schemaFilterInputSchema,
} from "./tools/schemas";

export const SERVER_INSTRUCTIONS =
  "Inspect one configured database. Metadata tools are read-only. execute_query sends arbitrary SQL unchanged and may modify data if the configured database account permits it; Row limits bound returned MCP output only and do not limit database work.";

export function createMcpServer(service: DatabaseService, secrets: string[] = []): McpServer {
  const server = new McpServer(
    { name: PACKAGE_NAME, version: VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "get_database_info",
    {
      title: "Get database information",
      description: "Return the driver, database, server version, capabilities, and row limits.",
      inputSchema: emptyInputSchema,
      outputSchema: databaseInfoOutputSchema,
      annotations: METADATA_ANNOTATIONS,
    },
    () => callTool(() => service.getDatabaseInfo(), secrets),
  );

  server.registerTool(
    "list_databases",
    {
      title: "List databases",
      description: "List visible databases, or report that this operation is unsupported.",
      inputSchema: emptyInputSchema,
      outputSchema: listDatabasesOutputSchema,
      annotations: METADATA_ANNOTATIONS,
    },
    () => callTool(() => service.listDatabases(), secrets),
  );

  server.registerTool(
    "list_schemas",
    {
      title: "List schemas",
      description: "List visible schemas, or report that this operation is unsupported.",
      inputSchema: emptyInputSchema,
      outputSchema: listSchemasOutputSchema,
      annotations: METADATA_ANNOTATIONS,
    },
    () => callTool(() => service.listSchemas(), secrets),
  );

  server.registerTool(
    "list_tables",
    {
      title: "List tables",
      description: "List visible qualified table names, optionally filtered by schema.",
      inputSchema: schemaFilterInputSchema,
      outputSchema: listNamesOutputSchema("tables"),
      annotations: METADATA_ANNOTATIONS,
    },
    ({ schema }) => callTool(() => service.listTables(schema), secrets),
  );

  server.registerTool(
    "list_views",
    {
      title: "List views",
      description: "List visible qualified view names, optionally filtered by schema.",
      inputSchema: schemaFilterInputSchema,
      outputSchema: listNamesOutputSchema("views"),
      annotations: METADATA_ANNOTATIONS,
    },
    ({ schema }) => callTool(() => service.listViews(schema), secrets),
  );

  server.registerTool(
    "describe_table",
    {
      title: "Describe table",
      description:
        "Return columns, Datazen types, keys, indexes, foreign keys, comments, and options.",
      inputSchema: describeTableInputSchema,
      outputSchema: describeTableOutputSchema,
      annotations: METADATA_ANNOTATIONS,
    },
    ({ table, schema }) => callTool(() => service.describeTable(table, schema), secrets),
  );

  server.registerTool(
    "execute_query",
    {
      title: "Execute SQL query",
      description:
        "Send arbitrary SQL unchanged to the configured account. Database permissions are the safety boundary.",
      inputSchema: executeQueryInputSchema,
      outputSchema: executeQueryOutputSchema,
      annotations: QUERY_ANNOTATIONS,
    },
    ({ sql, parameters, max_rows }) =>
      callTool(() => service.executeQuery(sql, parameters, max_rows), secrets),
  );

  return server;
}
