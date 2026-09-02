import { type Connection, type QueryParameters } from "@ngandu-dev/database";

import { MAX_ROWS_LIMIT } from "../constants";
import { type JsonValue, normalizeJson } from "./json";
import type { SerialExecutor } from "./serial-executor";

export class QueryService {
  constructor(
    private readonly connection: Connection,
    private readonly defaultMaxRows: number,
    private readonly queue: SerialExecutor,
  ) {}

  public execute(
    sql: string,
    parameters: QueryParameters,
    maxRows?: number,
  ): Promise<Record<string, JsonValue>> {
    return this.queue.run(async () => {
      const startedAt = performance.now();
      const result = await this.connection.executeQuery(sql, parameters);
      try {
        const columns = Array.from({ length: result.columnCount() }, (_, index) =>
          result.getColumnName(index),
        );
        const allRows = result.fetchAllNumeric();
        const limit = Math.min(maxRows ?? this.defaultMaxRows, MAX_ROWS_LIMIT);
        const rows = allRows.slice(0, limit).map((row) => row.map(normalizeJson));

        return {
          columns,
          rows,
          row_count: normalizeJson(result.rowCount()),
          returned_row_count: rows.length,
          truncated: allRows.length > rows.length,
          duration_ms: Math.round((performance.now() - startedAt) * 1000) / 1000,
        };
      } finally {
        result.free();
      }
    });
  }
}
