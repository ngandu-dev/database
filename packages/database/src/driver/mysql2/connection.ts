import type { Connection as DriverConnection } from "../connection";
import { NoIdentityValue } from "../exception/no-identity-value";
import type { Result as DriverResult } from "../result";
import type { Statement as DriverStatement } from "../statement";
import { Result as MySQL2Result } from "./result";
import { MySQL2Statement } from "./statement";
import type { MySQL2ConnectionLike, MySQL2PoolLike } from "./types";

export class MySQL2Connection implements DriverConnection {
  private transactionConnection: MySQL2ConnectionLike | null = null;
  private lastInsertIdValue: number | string | null = null;

  constructor(
    private readonly client: MySQL2PoolLike | MySQL2ConnectionLike,
    private readonly ownsClient: boolean,
  ) {}

  public async prepare(sql: string): Promise<DriverStatement> {
    return new MySQL2Statement(this, sql);
  }

  public async query(sql: string): Promise<DriverResult> {
    const payload = await this.executeRaw(sql, []);
    return this.toDriverResult(payload);
  }

  public quote(value: string): string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
  }

  public async exec(sql: string): Promise<number | string> {
    const payload = await this.executeRaw(sql, []);
    const metadata = this.toMetadata(payload);
    this.lastInsertIdValue = metadata.insertId;

    return metadata.affectedRows;
  }

  public async lastInsertId(): Promise<number | string> {
    if (this.lastInsertIdValue === null) {
      throw NoIdentityValue.new();
    }

    return this.lastInsertIdValue;
  }

  public async beginTransaction(): Promise<void> {
    if (this.transactionConnection !== null) {
      throw new Error("A transaction is already active on this connection.");
    }

    const connection = await this.acquireTransactionConnection();
    if (connection.beginTransaction === undefined) {
      throw new Error("The provided mysql2 connection does not support beginTransaction().");
    }

    await connection.beginTransaction();
    this.transactionConnection = connection;
  }

  public async commit(): Promise<void> {
    const connection = this.transactionConnection;
    if (connection === null) {
      throw new Error("No active transaction to commit.");
    }

    if (connection.commit === undefined) {
      throw new Error("The provided mysql2 connection does not support commit().");
    }

    try {
      await connection.commit();
    } finally {
      this.releaseTransactionConnection(connection);
      this.transactionConnection = null;
    }
  }

  public async rollBack(): Promise<void> {
    const connection = this.transactionConnection;
    if (connection === null) {
      throw new Error("No active transaction to roll back.");
    }

    if (connection.rollback === undefined) {
      throw new Error("The provided mysql2 connection does not support rollback().");
    }

    try {
      await connection.rollback();
    } finally {
      this.releaseTransactionConnection(connection);
      this.transactionConnection = null;
    }
  }

  public async getServerVersion(): Promise<string> {
    const result = await this.query("SELECT VERSION() AS version");
    const version = result.fetchOne() ?? "unknown";
    result.free();

    return typeof version === "string" ? version : String(version);
  }

  public async close(): Promise<void> {
    if (this.transactionConnection !== null) {
      this.releaseTransactionConnection(this.transactionConnection);
      this.transactionConnection = null;
    }

    if (this.ownsClient && "end" in this.client && typeof this.client.end === "function") {
      await this.client.end();
    }
  }

  public getNativeConnection(): unknown {
    return this.transactionConnection ?? this.client;
  }

  public async executePrepared(sql: string, parameters: unknown[]): Promise<DriverResult> {
    const payload = await this.executeRaw(sql, parameters);
    return this.toDriverResult(payload);
  }

  private async acquireTransactionConnection(): Promise<MySQL2ConnectionLike> {
    if ("getConnection" in this.client && typeof this.client.getConnection === "function") {
      return this.client.getConnection();
    }

    return this.client as MySQL2ConnectionLike;
  }

  private releaseTransactionConnection(connection: MySQL2ConnectionLike): void {
    const canReleaseBorrowedConnection =
      "getConnection" in this.client && typeof this.client.getConnection === "function";

    if (
      canReleaseBorrowedConnection &&
      "release" in connection &&
      typeof connection.release === "function"
    ) {
      connection.release();
    }
  }

  private async executeRaw(sql: string, parameters: unknown[]): Promise<unknown> {
    const executor = this.transactionConnection ?? this.client;

    // mysql2 prepared statements do not support certain control statements (e.g. SAVEPOINT).
    // Follow a safer path for parameterless SQL by using query() directly.
    if (parameters.length === 0 && "query" in executor && typeof executor.query === "function") {
      const result = await executor.query(sql);
      return this.unwrapDriverResult(result);
    }

    if ("execute" in executor && typeof executor.execute === "function") {
      const result = await executor.execute(sql, parameters);
      return this.unwrapDriverResult(result);
    }

    if ("query" in executor && typeof executor.query === "function") {
      const result = await executor.query(sql, parameters);
      return this.unwrapDriverResult(result);
    }

    throw new Error("The provided mysql2 client does not expose query() or execute().");
  }

  private unwrapDriverResult(result: unknown): unknown {
    if (!Array.isArray(result)) {
      return result;
    }

    return {
      fields: result[1],
      rows: result[0],
    };
  }

  private toDriverResult(result: unknown): DriverResult {
    const rows = this.toRows(result);
    const firstRow = rows[0];
    const columns = this.toColumns(result, firstRow);

    if (rows.length > 0 || columns.length > 0) {
      return new MySQL2Result(rows, columns, rows.length);
    }

    const metadata = this.toMetadata(result);
    this.lastInsertIdValue = metadata.insertId;

    return new MySQL2Result([], [], metadata.affectedRows);
  }

  private toRows(result: unknown): Array<Record<string, unknown>> {
    const rowPayload = this.extractRowsPayload(result);
    if (!Array.isArray(rowPayload)) {
      return [];
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const row of rowPayload) {
      if (row !== null && typeof row === "object" && !Array.isArray(row)) {
        rows.push(row as Record<string, unknown>);
      }
    }

    return rows;
  }

  private toColumns(result: unknown, firstRow: Record<string, unknown> | undefined): string[] {
    if (result !== null && typeof result === "object" && !Array.isArray(result)) {
      const fields = (result as { fields?: unknown }).fields;
      if (Array.isArray(fields)) {
        const names = fields
          .map((field) => (field !== null && typeof field === "object" ? field.name : undefined))
          .filter((name): name is string => typeof name === "string");

        if (names.length > 0) {
          return names;
        }
      }
    }

    return firstRow === undefined ? [] : Object.keys(firstRow);
  }

  private toMetadata(result: unknown): { affectedRows: number; insertId: number | string | null } {
    const metadataPayload = this.extractRowsPayload(result);

    if (
      metadataPayload !== null &&
      typeof metadataPayload === "object" &&
      !Array.isArray(metadataPayload)
    ) {
      const affectedRowsValue = (metadataPayload as { affectedRows?: unknown }).affectedRows;
      const insertIdValue = (metadataPayload as { insertId?: unknown }).insertId;

      return {
        affectedRows: typeof affectedRowsValue === "number" ? affectedRowsValue : 0,
        insertId:
          typeof insertIdValue === "number" || typeof insertIdValue === "string"
            ? insertIdValue
            : null,
      };
    }

    if (Array.isArray(metadataPayload)) {
      return {
        affectedRows: metadataPayload.length,
        insertId: null,
      };
    }

    return {
      affectedRows: 0,
      insertId: null,
    };
  }

  private extractRowsPayload(result: unknown): unknown {
    if (
      result !== null &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      "rows" in result
    ) {
      return (result as { rows?: unknown }).rows;
    }

    return result;
  }
}
