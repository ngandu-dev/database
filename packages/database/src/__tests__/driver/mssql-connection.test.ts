import { describe, expect, it } from "vitest";

import { MSSQLConnection } from "../../driver/mssql/connection";
import { ParameterType } from "../../parameter-type";

interface QueryPayload {
  recordset?: Array<Record<string, unknown>>;
  rowsAffected?: number[];
}

class FakeRequest {
  public readonly inputs: Array<{ name: string; value: unknown }> = [];
  public readonly queries: string[] = [];

  constructor(private readonly handler: (sql: string) => Promise<QueryPayload>) {}

  public input(name: string, value: unknown): this {
    this.inputs.push({ name, value });
    return this;
  }

  public async query(sql: string): Promise<QueryPayload> {
    this.queries.push(sql);
    return this.handler(sql);
  }
}

class FakeTransaction {
  public beginCalls = 0;
  public commitCalls = 0;
  public rollbackCalls = 0;
  public readonly requestInstance: FakeRequest;

  constructor(handler: (sql: string) => Promise<QueryPayload>) {
    this.requestInstance = new FakeRequest(handler);
  }

  public async begin(): Promise<void> {
    this.beginCalls += 1;
  }

  public async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  public async rollback(): Promise<void> {
    this.rollbackCalls += 1;
  }

  public request(): FakeRequest {
    return this.requestInstance;
  }
}

class FakePool {
  public closeCalls = 0;
  public readonly requestInstance: FakeRequest;
  public readonly transactionInstance: FakeTransaction;

  constructor(handler: (sql: string) => Promise<QueryPayload>) {
    this.requestInstance = new FakeRequest(handler);
    this.transactionInstance = new FakeTransaction(handler);
  }

  public request(): FakeRequest {
    return this.requestInstance;
  }

  public transaction(): FakeTransaction {
    return this.transactionInstance;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

describe("MSSQLConnection", () => {
  it("executes named-parameter prepared queries and normalizes row output", async () => {
    const pool = new FakePool(async () => ({
      recordset: [{ id: 1, name: "Alice" }],
      rowsAffected: [1],
    }));
    const connection = new MSSQLConnection(pool, false);
    const statement = await connection.prepare(
      "SELECT * FROM users WHERE id = @p1 AND status = @p2",
    );
    statement.bindValue("id", 1);
    statement.bindValue("status", "active");

    const result = await statement.execute();

    expect(pool.requestInstance.inputs).toEqual([
      { name: "id", value: 1 },
      { name: "status", value: "active" },
    ]);
    expect(result.fetchAllAssociative()).toEqual([{ id: 1, name: "Alice" }]);
    expect(result.rowCount()).toBe(1);
  });

  it("normalizes exec() affected rows", async () => {
    const pool = new FakePool(async () => ({
      rowsAffected: [2, 3],
    }));
    const connection = new MSSQLConnection(pool, false);

    expect(await connection.exec("UPDATE users SET status = 'active'")).toBe(5);
  });

  it("serializes requests to respect single-flight behavior", async () => {
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstQueryBarrier = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const pool = new FakePool(async (sql: string) => {
      order.push(`start:${sql}`);
      if (sql === "q1") {
        await firstQueryBarrier;
      }
      order.push(`end:${sql}`);
      return { recordset: [{ sql }], rowsAffected: [1] };
    });
    const connection = new MSSQLConnection(pool, false);

    const first = connection.query("q1");
    const second = connection.query("q2");

    await Promise.resolve();
    expect(order).toEqual(["start:q1"]);

    if (releaseFirst === undefined) {
      throw new Error("Expected first barrier resolver to be initialized.");
    }
    releaseFirst();

    await first;
    await second;
    expect(order).toEqual(["start:q1", "end:q1", "start:q2", "end:q2"]);
  });

  it("uses transaction request context once a transaction begins", async () => {
    const pool = new FakePool(async () => ({
      recordset: [{ v: 1 }],
      rowsAffected: [1],
    }));
    const connection = new MSSQLConnection(pool, false);

    await connection.beginTransaction();
    const statement = await connection.prepare("SELECT @id AS v");
    statement.bindValue("id", 1);
    await statement.execute();

    expect(pool.transactionInstance.beginCalls).toBe(1);
    expect(pool.transactionInstance.requestInstance.inputs).toEqual([{ name: "id", value: 1 }]);
    expect(pool.requestInstance.inputs).toEqual([]);

    await connection.commit();
    expect(pool.transactionInstance.commitCalls).toBe(1);
  });

  it("casts ascii and large object parameters in generated SQL", async () => {
    const pool = new FakePool(async () => ({
      recordset: [{ typeName: "ok" }],
      rowsAffected: [1],
    }));
    const connection = new MSSQLConnection(pool, false);
    const statement = await connection.prepare(
      "SELECT sql_variant_property(?, 'BaseType'), ? AS payload",
    );

    statement.bindValue(1, "test", ParameterType.ASCII);
    statement.bindValue(2, null, ParameterType.LARGE_OBJECT);
    await statement.execute();

    expect(pool.requestInstance.inputs).toEqual([
      { name: "p1", value: "test" },
      { name: "p2", value: null },
    ]);
    expect(pool.requestInstance.queries).toEqual([
      "SELECT sql_variant_property(CAST(@p1 AS VARCHAR(4)), 'BaseType'), CAST(@p2 AS VARBINARY(MAX)) AS payload",
    ]);
  });

  it("supports rollback inside transactions", async () => {
    const pool = new FakePool(async () => ({
      rowsAffected: [1],
    }));
    const connection = new MSSQLConnection(pool, false);

    await connection.beginTransaction();
    await connection.rollBack();
    expect(pool.transactionInstance.rollbackCalls).toBe(1);
  });

  it("quotes values and reads server version", async () => {
    const pool = new FakePool(async (sql: string) => {
      if (sql.includes("@@VERSION")) {
        return { recordset: [{ version: 2019 }] };
      }

      return { rowsAffected: [0] };
    });
    const connection = new MSSQLConnection(pool, false);

    expect(connection.quote("O'Reilly")).toBe("'O''Reilly'");
    expect(await connection.getServerVersion()).toBe("2019");
  });

  it("closes owned pools and rolls back active transactions on close", async () => {
    const pool = new FakePool(async () => ({ rowsAffected: [1] }));
    const connection = new MSSQLConnection(pool, true);

    await connection.beginTransaction();
    await connection.close();

    expect(pool.transactionInstance.rollbackCalls).toBe(1);
    expect(pool.closeCalls).toBe(1);
  });

  it("returns pool as native connection", () => {
    const pool = new FakePool(async () => ({ rowsAffected: [0] }));
    const connection = new MSSQLConnection(pool, false);

    expect(connection.getNativeConnection()).toBe(pool);
  });
});
