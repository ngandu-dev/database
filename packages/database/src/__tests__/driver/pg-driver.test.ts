import { describe, expect, it } from "vitest";

import { ExceptionConverter as PostgreSQLExceptionConverter } from "../../driver/api/postgresql/exception-converter";
import { PgDriver } from "../../driver/pg/driver";

describe("PgDriver", () => {
  it("throws when no client object is provided", async () => {
    const driver = new PgDriver();

    await expect(driver.connect({})).rejects.toThrow(Error);
  });

  it("prefers pool over connection/client in params", async () => {
    const driver = new PgDriver();
    const pool = { query: async () => ({ rows: [] }) };
    const connection = { query: async () => ({ rows: [] }) };
    const client = { query: async () => ({ rows: [] }) };

    const driverConnection = await driver.connect({
      client,
      connection,
      pool,
    });

    expect(driverConnection.getNativeConnection()).toBe(pool);
  });

  it("closes owned clients when configured", async () => {
    const calls = { end: 0 };
    const pool = {
      end: async () => {
        calls.end += 1;
      },
      query: async () => ({ rows: [] }),
    };

    const driverConnection = await new PgDriver().connect({
      ownsPool: true,
      pool,
    });

    await driverConnection.close();
    expect(calls.end).toBe(1);
  });

  it("returns the Doctrine PostgreSQL exception converter", () => {
    const driver = new PgDriver();
    expect(driver.getExceptionConverter()).toBeInstanceOf(PostgreSQLExceptionConverter);
  });
});
