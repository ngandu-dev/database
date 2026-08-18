import { describe, expect, it } from "vitest";

import { SQLite3Connection } from "../../driver/sqlite3/connection";
import { InvalidParameterException } from "../../exception/invalid-parameter-exception";

class FakeSQLiteDatabase {
  public readonly allCalls: Array<{ parameters: unknown[]; sql: string }> = [];
  public readonly runCalls: Array<{ parameters: unknown[]; sql: string }> = [];
  public readonly execCalls: string[] = [];
  public closeCalls = 0;

  constructor(
    private readonly allHandler: (sql: string, parameters: unknown[]) => unknown[] = () => [],
    private readonly runHandler: (
      sql: string,
      parameters: unknown[],
    ) => { changes?: number; lastID?: number } = () => ({ changes: 0 }),
  ) {}

  public all(
    sql: string,
    parameters: unknown[],
    callback: (error: Error | null, rows?: unknown[]) => void,
  ): void {
    this.allCalls.push({ parameters, sql });
    callback(null, this.allHandler(sql, parameters));
  }

  public run(
    sql: string,
    parameters: unknown[],
    callback?: (this: { changes?: number; lastID?: number }, error: Error | null) => void,
  ): void {
    this.runCalls.push({ parameters, sql });
    const ctx = this.runHandler(sql, parameters);
    callback?.call(ctx, null);
  }

  public exec(sql: string, callback: (error: Error | null) => void): void {
    this.execCalls.push(sql);
    callback(null);
  }

  public close(callback: (error: Error | null) => void): void {
    this.closeCalls += 1;
    callback(null);
  }
}

describe("SQLite3Connection", () => {
  it("executes prepared queries and normalizes rows", async () => {
    const db = new FakeSQLiteDatabase(() => [{ id: 1, name: "Alice" }]);
    const connection = new SQLite3Connection(db, false);
    const statement = await connection.prepare("SELECT id, name FROM users WHERE id = ?");

    statement.bindValue(1, 1);
    const result = await statement.execute();
    expect(result.fetchAllAssociative()).toEqual([{ id: 1, name: "Alice" }]);
    expect(result.rowCount()).toBe(1);
  });

  it("executes statements and exposes affected rows/lastInsertId", async () => {
    const db = new FakeSQLiteDatabase(
      () => [],
      () => ({ changes: 2, lastID: 7 }),
    );
    const connection = new SQLite3Connection(db, false);

    const statement = await connection.prepare("UPDATE users SET status = ?");
    statement.bindValue(1, "active");
    const result = await statement.execute();

    expect(result.rowCount()).toBe(2);
    await expect(connection.lastInsertId()).resolves.toBe(7);
  });

  it("rejects named parameter binding", async () => {
    const connection = new SQLite3Connection(new FakeSQLiteDatabase(), false);
    const statement = await connection.prepare("SELECT * FROM users WHERE id = ?");

    expect(() => statement.bindValue("id", 1)).toThrow(InvalidParameterException);
  });

  it("supports transactions via exec()", async () => {
    const db = new FakeSQLiteDatabase();
    const connection = new SQLite3Connection(db, false);

    await connection.beginTransaction();
    await connection.commit();

    expect(db.execCalls).toEqual(["BEGIN", "COMMIT"]);
  });

  it("quotes values and reads sqlite version", async () => {
    const db = new FakeSQLiteDatabase((sql) => {
      if (sql.includes("sqlite_version")) {
        return [{ version: 3.45 }];
      }

      return [];
    });
    const connection = new SQLite3Connection(db, false);

    expect(connection.quote("O'Reilly")).toBe("'O''Reilly'");
    await expect(connection.query("SELECT 1")).resolves.toBeDefined();
    await expect(connection.getServerVersion()).resolves.toBe("3.45");
  });

  it("throws on invalid transaction transitions and closes owned databases", async () => {
    const db = new FakeSQLiteDatabase();
    const connection = new SQLite3Connection(db, true);

    await expect(connection.commit()).rejects.toThrow(Error);
    await expect(connection.rollBack()).rejects.toThrow(Error);

    await connection.close();
    expect(db.closeCalls).toBe(1);
  });
});
