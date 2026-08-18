import type { Connection as DriverConnection } from "../connection";
import { NoIdentityValue } from "../exception/no-identity-value";
import type { Result as DriverResult } from "../result";
import type { Statement as DriverStatement } from "../statement";
import { Result as SQLite3Result } from "./result";
import { SQLite3Statement } from "./statement";
import type { SQLite3DatabaseLike, SQLite3RunContextLike } from "./types";

export class SQLite3Connection implements DriverConnection {
  private inTransaction = false;
  private lastInsertIdValue: number | string | null = null;

  constructor(
    private readonly database: SQLite3DatabaseLike,
    private readonly ownsClient: boolean,
  ) {}

  public async prepare(sql: string): Promise<DriverStatement> {
    return new SQLite3Statement(this, sql);
  }

  public async query(sql: string): Promise<DriverResult> {
    const rows = await this.queryAll(sql, []);
    const firstRow = rows[0];

    return new SQLite3Result(
      rows,
      firstRow === undefined ? [] : Object.keys(firstRow),
      rows.length,
    );
  }

  public quote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  public async exec(sql: string): Promise<number | string> {
    const result = await this.queryRun(sql, []);
    this.lastInsertIdValue =
      typeof result.lastID === "number" || typeof result.lastID === "string" ? result.lastID : null;

    return typeof result.changes === "number" ? result.changes : 0;
  }

  public async lastInsertId(): Promise<number | string> {
    if (this.lastInsertIdValue === null) {
      throw NoIdentityValue.new();
    }

    return this.lastInsertIdValue;
  }

  public async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error("A transaction is already active on this connection.");
    }

    await this.execSql("BEGIN");
    this.inTransaction = true;
  }

  public async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error("No active transaction to commit.");
    }

    await this.execSql("COMMIT");
    this.inTransaction = false;
  }

  public async rollBack(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error("No active transaction to roll back.");
    }

    await this.execSql("ROLLBACK");
    this.inTransaction = false;
  }

  public async getServerVersion(): Promise<string> {
    const rows = await this.queryAll("SELECT sqlite_version() AS version", []);
    const version = rows[0]?.version ?? "unknown";

    return typeof version === "string" ? version : String(version);
  }

  public async close(): Promise<void> {
    if (this.inTransaction) {
      try {
        await this.execSql("ROLLBACK");
      } catch {
        // best effort rollback during close
      } finally {
        this.inTransaction = false;
      }
    }

    if (!this.ownsClient || this.database.close === undefined) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.database.close?.((error) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  public getNativeConnection(): unknown {
    return this.database;
  }

  public async executePrepared(sql: string, parameters: unknown[]): Promise<DriverResult> {
    if (this.isResultSetSql(sql)) {
      const rows = await this.queryAll(sql, parameters);
      const firstRow = rows[0];

      return new SQLite3Result(
        rows,
        firstRow === undefined ? [] : Object.keys(firstRow),
        rows.length,
      );
    }

    const result = await this.queryRun(sql, parameters);
    this.lastInsertIdValue =
      typeof result.lastID === "number" || typeof result.lastID === "string" ? result.lastID : null;

    return new SQLite3Result([], [], typeof result.changes === "number" ? result.changes : 0);
  }

  private isResultSetSql(sql: string): boolean {
    const normalized = sql.trimStart().toUpperCase();

    return (
      normalized.startsWith("SELECT") ||
      normalized.startsWith("PRAGMA") ||
      normalized.startsWith("WITH") ||
      normalized.startsWith("EXPLAIN")
    );
  }

  private async queryAll(
    sql: string,
    parameters: unknown[],
  ): Promise<Array<Record<string, unknown>>> {
    if (this.database.all === undefined) {
      throw new Error("The provided sqlite3 database does not expose all().");
    }

    const rows = await new Promise<unknown[]>((resolve, reject) => {
      this.database.all?.(sql, parameters, (error, result) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve(Array.isArray(result) ? result : []);
      });
    });

    const normalized: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      if (row !== null && typeof row === "object" && !Array.isArray(row)) {
        normalized.push(row as Record<string, unknown>);
      }
    }

    return normalized;
  }

  private async queryRun(sql: string, parameters: unknown[]): Promise<SQLite3RunContextLike> {
    if (this.database.run === undefined) {
      if (parameters.length === 0 && this.database.exec !== undefined) {
        await this.execSql(sql);
        return { changes: 0 };
      }

      throw new Error("The provided sqlite3 database does not expose run().");
    }

    return new Promise<SQLite3RunContextLike>((resolve, reject) => {
      this.database.run?.(sql, parameters, function (this: SQLite3RunContextLike, error) {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve({
          changes: typeof this?.changes === "number" ? this.changes : 0,
          lastID:
            typeof this?.lastID === "number" || typeof this?.lastID === "string"
              ? this.lastID
              : undefined,
        });
      });
    });
  }

  private async execSql(sql: string): Promise<void> {
    if (this.database.exec !== undefined) {
      await new Promise<void>((resolve, reject) => {
        this.database.exec?.(sql, (error) => {
          if (error !== null) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      return;
    }

    await this.queryRun(sql, []);
  }
}
