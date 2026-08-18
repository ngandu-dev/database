import { describe, expect, it } from "vitest";

import { PgConnection } from "../../driver/pg/connection";
import type { PgQueryResultLike } from "../../driver/pg/types";
import { InvalidParameterException } from "../../exception/invalid-parameter-exception";

interface LoggedCall {
  parameters?: unknown[];
  sql: string;
}

class FakePgClient {
  public readonly calls: LoggedCall[] = [];
  public released = 0;

  constructor(
    private readonly handler: (sql: string, parameters?: unknown[]) => Promise<PgQueryResultLike>,
  ) {}

  public async query(sql: string, parameters?: unknown[]): Promise<PgQueryResultLike> {
    this.calls.push({ parameters, sql });
    return this.handler(sql, parameters);
  }

  public release(): void {
    this.released += 1;
  }
}

class FakePgPool {
  public readonly calls: LoggedCall[] = [];
  public endCalls = 0;

  constructor(
    private readonly handler: (sql: string, parameters?: unknown[]) => Promise<PgQueryResultLike>,
    private readonly txClient: FakePgClient,
  ) {}

  public async query(sql: string, parameters?: unknown[]): Promise<PgQueryResultLike> {
    this.calls.push({ parameters, sql });
    return this.handler(sql, parameters);
  }

  public async connect(): Promise<FakePgClient> {
    return this.txClient;
  }

  public async end(): Promise<void> {
    this.endCalls += 1;
  }
}

describe("PgConnection", () => {
  it("rewrites positional placeholders in prepared statements and normalizes query results", async () => {
    const connection = new PgConnection(
      new FakePgClient(async (_sql, _params) => ({
        fields: [{ name: "id" }, { name: "name" }],
        rowCount: 1,
        rows: [{ id: 1, name: "Alice" }],
      })),
      false,
    );
    const statement = await connection.prepare(
      "SELECT id, name FROM users WHERE id = ? AND status = ?",
    );
    statement.bindValue(1, 1);
    statement.bindValue(2, "active");

    const result = await statement.execute();
    expect(result.fetchAllAssociative()).toEqual([{ id: 1, name: "Alice" }]);
    expect(result.rowCount()).toBe(1);
    const native = connection.getNativeConnection() as FakePgClient;
    expect(native.calls[0]).toEqual({
      parameters: [1, "active"],
      sql: "SELECT id, name FROM users WHERE id = $1 AND status = $2",
    });
  });

  it("rejects named parameter binding", async () => {
    const connection = new PgConnection(new FakePgClient(async () => ({ rows: [] })), false);
    const statement = await connection.prepare("SELECT * FROM users WHERE id = ?");

    expect(() => statement.bindValue("id", 1)).toThrow(InvalidParameterException);
  });

  it("uses a dedicated pooled client for transactions and releases it", async () => {
    const txClient = new FakePgClient(async () => ({ rowCount: 0, rows: [] }));
    const pool = new FakePgPool(async () => ({ rowCount: 0, rows: [] }), txClient);
    const connection = new PgConnection(pool, false);

    await connection.beginTransaction();
    const statement = await connection.prepare("UPDATE users SET active = ?");
    statement.bindValue(1, 1);
    const result = await statement.execute();
    expect(result.rowCount()).toBe(0);
    await connection.commit();

    expect(txClient.calls.map((call) => call.sql)).toEqual([
      "BEGIN",
      "UPDATE users SET active = $1",
      "COMMIT",
    ]);
    expect(txClient.released).toBe(1);
  });

  it("supports query(), exec(), quoting and server version lookup", async () => {
    const client = new FakePgClient(async (sql) => {
      if (sql === "SHOW server_version") {
        return { rows: [{ server_version: "16.2" }] };
      }

      return { rowCount: 0, rows: [] };
    });
    const connection = new PgConnection(client, false);

    await connection.query("SELECT 1");
    await connection.exec("UPDATE users SET active = TRUE");

    expect(client.calls.slice(0, 2).map((call) => call.sql)).toEqual([
      "SELECT 1",
      "UPDATE users SET active = TRUE",
    ]);
    expect(connection.quote("O'Reilly")).toBe("'O''Reilly'");
    await expect(connection.getServerVersion()).resolves.toBe("16.2");
  });

  it("throws on invalid transaction transitions", async () => {
    const connection = new PgConnection(
      new FakePgClient(async () => ({ rowCount: 0, rows: [] })),
      false,
    );

    await expect(connection.commit()).rejects.toThrow(Error);
    await expect(connection.rollBack()).rejects.toThrow(Error);
  });
});
