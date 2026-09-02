import { type Connection, type DriverName } from "@ngandu-dev/database";

import { MAX_ROWS_LIMIT } from "../constants";
import type { JsonValue } from "./json";
import type { SerialExecutor } from "./serial-executor";
import type { DatabaseServiceOptions } from "./service-options";
import { serializeTable } from "./table-serializer";

export class MetadataService {
  private readonly connection: Connection;
  private readonly defaultMaxRows: number;
  private readonly driver: DriverName;

  constructor(
    options: DatabaseServiceOptions,
    private readonly queue: SerialExecutor,
  ) {
    this.connection = options.connection;
    this.defaultMaxRows = options.defaultMaxRows;
    this.driver = options.driver;
  }

  public getDatabaseInfo(): Promise<Record<string, JsonValue>> {
    return this.queue.run(async () => ({
      driver: this.driver,
      database: this.connection.getDatabase(),
      server_version: await this.connection.getServerVersion(),
      capabilities: {
        list_databases: this.driver !== "sqlite3",
        list_schemas: this.driver === "pg" || this.driver === "mssql",
        list_tables: true,
        list_views: true,
        describe_table: true,
        execute_query: true,
      },
      result_limits: {
        default_max_rows: this.defaultMaxRows,
        maximum_max_rows: MAX_ROWS_LIMIT,
      },
    }));
  }

  public listDatabases(): Promise<Record<string, JsonValue>> {
    return this.queue.run(async () => {
      if (this.driver === "sqlite3") {
        return { supported: false } as Record<string, JsonValue>;
      }
      const manager = await this.connection.createSchemaManager();
      return {
        supported: true,
        databases: await manager.listDatabases(),
      };
    });
  }

  public listSchemas(): Promise<Record<string, JsonValue>> {
    return this.queue.run(async () => {
      const platform = await this.connection.getDatabasePlatform();
      if (!platform.supportsSchemas()) {
        return { supported: false } as Record<string, JsonValue>;
      }
      const manager = await this.connection.createSchemaManager();
      return { supported: true, schemas: await manager.listSchemaNames() };
    });
  }

  public listTables(schema?: string): Promise<Record<string, JsonValue>> {
    return this.queue.run(async () => {
      const manager = await this.connection.createSchemaManager();
      const tables = filterBySchema(await manager.listTableNames(), schema);
      return { tables, count: tables.length };
    });
  }

  public listViews(schema?: string): Promise<Record<string, JsonValue>> {
    return this.queue.run(async () => {
      const manager = await this.connection.createSchemaManager();
      const views = filterBySchema(await manager.listViewNames(), schema);
      return { views, count: views.length };
    });
  }

  public describeTable(table: string, schema?: string): Promise<Record<string, JsonValue>> {
    return this.queue.run(async () => {
      const manager = await this.connection.createSchemaManager();
      return serializeTable(await manager.introspectTable(qualifyTable(table, schema)));
    });
  }
}

function filterBySchema(names: string[], schema: string | undefined): string[] {
  if (schema === undefined) {
    return names;
  }
  const normalizedSchema = normalizeIdentifier(schema);
  return names.filter((name) => {
    const separator = name.indexOf(".");
    return separator !== -1 && normalizeIdentifier(name.slice(0, separator)) === normalizedSchema;
  });
}

function normalizeIdentifier(identifier: string): string {
  return identifier.replaceAll(/[`"[\]]/g, "").toLowerCase();
}

function qualifyTable(table: string, schema: string | undefined): string {
  if (schema === undefined) {
    return table;
  }
  if (table.includes(".")) {
    throw new Error("Pass either a qualified table name or schema, not both.");
  }
  return `${schema}.${table}`;
}
