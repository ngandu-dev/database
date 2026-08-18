import { describe, expect, it } from "vitest";

import { ExceptionConverter as SQLServerExceptionConverter } from "../../driver/api/sqlserver/exception-converter";
import { MSSQLDriver } from "../../driver/mssql/driver";

describe("MSSQLDriver", () => {
  it("throws when no client object is provided", async () => {
    const driver = new MSSQLDriver();

    await expect(driver.connect({})).rejects.toThrow(Error);
  });

  it("prefers pool over connection/client in params", async () => {
    const driver = new MSSQLDriver();
    const pool = {
      request: () => ({
        input: () => ({
          input: () => undefined,
          query: async () => ({}),
        }),
        query: async () => ({}),
      }),
      transaction: () => ({
        begin: async () => undefined,
        commit: async () => undefined,
        request: () => ({
          input: () => ({
            input: () => undefined,
            query: async () => ({}),
          }),
          query: async () => ({}),
        }),
        rollback: async () => undefined,
      }),
    };
    const connection = {
      request: pool.request,
      transaction: pool.transaction,
    };
    const client = {
      request: pool.request,
      transaction: pool.transaction,
    };

    const driverConnection = await driver.connect({
      client,
      connection,
      pool,
    });

    expect(driverConnection.getNativeConnection()).toBe(pool);
  });

  it("closes owned pool when ownsPool is true", async () => {
    const calls = { close: 0 };
    const pool = {
      close: async () => {
        calls.close += 1;
      },
      request: () => ({
        input: () => ({
          input: () => undefined,
          query: async () => ({}),
        }),
        query: async () => ({}),
      }),
      transaction: () => ({
        begin: async () => undefined,
        commit: async () => undefined,
        request: () => ({
          input: () => ({
            input: () => undefined,
            query: async () => ({}),
          }),
          query: async () => ({}),
        }),
        rollback: async () => undefined,
      }),
    };

    const driver = new MSSQLDriver();
    const driverConnection = await driver.connect({
      ownsPool: true,
      pool,
    });

    await driverConnection.close();
    expect(calls.close).toBe(1);
  });

  it("returns the Doctrine SQL Server exception converter", () => {
    const driver = new MSSQLDriver();

    expect(driver.getExceptionConverter()).toBeInstanceOf(SQLServerExceptionConverter);
  });
});
