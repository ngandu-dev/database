import { describe, expect, it } from "vitest";

import { MySQL2Connection } from "../../driver/mysql2/connection";
import { InvalidParameterException } from "../../exception/invalid-parameter-exception";

describe("MySQL2Connection", () => {
  it("executes prepared query using execute() and normalizes rows", async () => {
    const client = {
      execute: async () => [[{ id: 1, name: "Alice" }], []],
    };
    const connection = new MySQL2Connection(client, false);
    const statement = await connection.prepare("SELECT id, name FROM users WHERE id = ?");
    statement.bindValue(1, 1);

    const result = await statement.execute();
    expect(result.fetchAllAssociative()).toEqual([{ id: 1, name: "Alice" }]);
    expect(result.rowCount()).toBe(1);
  });

  it("falls back to query() when execute() is unavailable", async () => {
    const client = {
      query: async () => [[{ value: 1 }], []],
    };
    const connection = new MySQL2Connection(client, false);

    const result = await connection.query("SELECT 1 AS value");
    expect(result.fetchAllAssociative()).toEqual([{ value: 1 }]);
  });

  it("normalizes statement metadata through exec() and lastInsertId()", async () => {
    const client = {
      execute: async () => [{ affectedRows: 3, insertId: 99 }],
    };
    const connection = new MySQL2Connection(client, false);

    expect(await connection.exec("UPDATE users SET active = 1")).toBe(3);
    await expect(connection.lastInsertId()).resolves.toBe(99);
  });

  it("returns rows from prepared statements and rowCount", async () => {
    const client = {
      query: async () => [[{ id: 1 }, { id: 2 }], []],
    };
    const connection = new MySQL2Connection(client, false);
    const statement = await connection.prepare("SELECT id FROM users");
    const result = await statement.execute();

    expect(result.fetchAllAssociative()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.rowCount()).toBe(2);
  });

  it("rejects named parameter binding", async () => {
    const client = {
      query: async () => [[{ id: 1 }], []],
    };
    const connection = new MySQL2Connection(client, false);
    const statement = await connection.prepare("SELECT id FROM users WHERE id = ?");

    expect(() => statement.bindValue("id", 1)).toThrow(InvalidParameterException);
  });

  it("throws when client has neither execute() nor query()", async () => {
    const connection = new MySQL2Connection({}, false);

    await expect(connection.query("SELECT 1")).rejects.toThrow(Error);
  });

  it("begins and commits transactions on acquired pooled connections", async () => {
    const calls = {
      begin: 0,
      commit: 0,
      release: 0,
    };
    const txConnection = {
      beginTransaction: async () => {
        calls.begin += 1;
      },
      commit: async () => {
        calls.commit += 1;
      },
      execute: async () => [[{ value: 1 }], []],
      release: () => {
        calls.release += 1;
      },
    };
    const pool = {
      getConnection: async () => txConnection,
      query: async () => [[{ value: 0 }], []],
    };
    const connection = new MySQL2Connection(pool, false);

    await connection.beginTransaction();
    expect(connection.getNativeConnection()).toBe(txConnection);
    await connection.commit();

    expect(calls.begin).toBe(1);
    expect(calls.commit).toBe(1);
    expect(calls.release).toBe(1);
    expect(connection.getNativeConnection()).toBe(pool);
  });

  it("rolls back active transactions and releases connection", async () => {
    const calls = {
      begin: 0,
      release: 0,
      rollback: 0,
    };
    const txConnection = {
      beginTransaction: async () => {
        calls.begin += 1;
      },
      execute: async () => [[{ value: 1 }], []],
      release: () => {
        calls.release += 1;
      },
      rollback: async () => {
        calls.rollback += 1;
      },
    };
    const pool = {
      getConnection: async () => txConnection,
      query: async () => [[{ value: 0 }], []],
    };
    const connection = new MySQL2Connection(pool, false);

    await connection.beginTransaction();
    await connection.rollBack();

    expect(calls.begin).toBe(1);
    expect(calls.rollback).toBe(1);
    expect(calls.release).toBe(1);
  });

  it("throws for invalid transaction transitions", async () => {
    const connection = new MySQL2Connection({ query: async () => [] }, false);

    await expect(connection.commit()).rejects.toThrow(Error);
    await expect(connection.rollBack()).rejects.toThrow(Error);
  });

  it("quotes string values and reads server version", async () => {
    const connection = new MySQL2Connection(
      {
        query: async (sql: string) => {
          if (sql.includes("VERSION")) {
            return [[{ version: 80031 }], []];
          }

          return [];
        },
      },
      false,
    );

    expect(connection.quote("a\\b'c")).toBe("'a\\\\b''c'");
    expect(await connection.getServerVersion()).toBe("80031");
  });

  it("closes owned clients only", async () => {
    const calls = { end: 0 };
    const client = {
      end: async () => {
        calls.end += 1;
      },
      query: async () => [],
    };

    await new MySQL2Connection(client, false).close();
    expect(calls.end).toBe(0);

    await new MySQL2Connection(client, true).close();
    expect(calls.end).toBe(1);
  });
});
