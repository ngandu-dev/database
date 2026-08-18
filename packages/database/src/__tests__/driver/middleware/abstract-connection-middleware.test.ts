import { describe, expect, it } from "vitest";

import { ArrayResult } from "../../../driver/array-result";
import type { Connection as DriverConnection } from "../../../driver/connection";
import { AbstractConnectionMiddleware } from "../../../driver/middleware/abstract-connection-middleware";
import type { Statement as DriverStatement } from "../../../driver/statement";

class TestConnectionMiddleware extends AbstractConnectionMiddleware {}

describe("AbstractConnectionMiddleware", () => {
  it("delegates prepare()", async () => {
    const statement = createStatementStub();
    const connection = createConnectionStub({
      prepare: async (sql) => {
        expect(sql).toBe("SELECT 1");
        return statement;
      },
    });

    expect(await new TestConnectionMiddleware(connection).prepare("SELECT 1")).toBe(statement);
  });

  it("delegates query()", async () => {
    const result = new ArrayResult([{ value: 1 }], ["value"], 1);
    const connection = createConnectionStub({
      query: async (sql) => {
        expect(sql).toBe("SELECT 1");
        return result;
      },
    });

    expect(await new TestConnectionMiddleware(connection).query("SELECT 1")).toBe(result);
  });

  it("delegates exec()", async () => {
    const connection = createConnectionStub({
      exec: async (sql) => {
        expect(sql).toBe("UPDATE foo SET bar='baz' WHERE some_field > 0");
        return 42;
      },
    });

    expect(
      await new TestConnectionMiddleware(connection).exec(
        "UPDATE foo SET bar='baz' WHERE some_field > 0",
      ),
    ).toBe(42);
  });

  it("delegates getServerVersion()", async () => {
    const connection = createConnectionStub({ getServerVersion: async () => "1.2.3" });

    await expect(new TestConnectionMiddleware(connection).getServerVersion()).resolves.toBe(
      "1.2.3",
    );
  });

  it("delegates getNativeConnection()", () => {
    const nativeConnection = { native: true };
    const connection = createConnectionStub({ getNativeConnection: () => nativeConnection });

    expect(new TestConnectionMiddleware(connection).getNativeConnection()).toBe(nativeConnection);
  });
});

function createStatementStub(): DriverStatement {
  return {
    bindValue: () => undefined,
    execute: async () => new ArrayResult([], [], 0),
  };
}

function createConnectionStub(overrides: Partial<DriverConnection>): DriverConnection {
  return {
    beginTransaction: async () => undefined,
    commit: async () => undefined,
    exec: async () => 0,
    getNativeConnection: () => ({}),
    getServerVersion: async () => "0",
    lastInsertId: async () => 0,
    prepare: async () => createStatementStub(),
    query: async () => new ArrayResult([], [], 0),
    quote: (value: string) => value,
    rollBack: async () => undefined,
    ...overrides,
  };
}
