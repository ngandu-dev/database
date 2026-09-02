import { type QueryParameters } from "@ngandu-dev/database";

import type { JsonValue } from "./json";
import { MetadataService } from "./metadata-service";
import { QueryService } from "./query-service";
import { SerialExecutor } from "./serial-executor";
import type { DatabaseServiceOptions } from "./service-options";

export class DatabaseService {
  private readonly metadata: MetadataService;
  private readonly queries: QueryService;
  private readonly queue = new SerialExecutor();
  private closed = false;

  constructor(private readonly options: DatabaseServiceOptions) {
    this.metadata = new MetadataService(options, this.queue);
    this.queries = new QueryService(options.connection, options.defaultMaxRows, this.queue);
  }

  public getDatabaseInfo(): Promise<Record<string, JsonValue>> {
    return this.metadata.getDatabaseInfo();
  }

  public listDatabases(): Promise<Record<string, JsonValue>> {
    return this.metadata.listDatabases();
  }

  public listSchemas(): Promise<Record<string, JsonValue>> {
    return this.metadata.listSchemas();
  }

  public listTables(schema?: string): Promise<Record<string, JsonValue>> {
    return this.metadata.listTables(schema);
  }

  public listViews(schema?: string): Promise<Record<string, JsonValue>> {
    return this.metadata.listViews(schema);
  }

  public describeTable(table: string, schema?: string): Promise<Record<string, JsonValue>> {
    return this.metadata.describeTable(table, schema);
  }

  public executeQuery(
    sql: string,
    parameters: QueryParameters = [],
    maxRows?: number,
  ): Promise<Record<string, JsonValue>> {
    return this.queries.execute(sql, parameters, maxRows);
  }

  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    await this.queue.run(() => this.options.connection.close());
  }
}
