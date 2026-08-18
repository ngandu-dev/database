import { describe, expect, it } from "vitest";

import { ExceptionConverter as MySQLExceptionConverter } from "../../driver/api/mysql/exception-converter";
import { MySQL2Driver } from "../../driver/mysql2/driver";

describe("MySQL2Driver", () => {
  it("throws when no client object is provided", async () => {
    const driver = new MySQL2Driver();

    await expect(driver.connect({})).rejects.toThrow(Error);
  });

  it("prefers pool over connection/client in params", async () => {
    const driver = new MySQL2Driver();
    const pool = { query: async () => [] };
    const connection = { query: async () => [] };
    const client = { query: async () => [] };

    const driverConnection = await driver.connect({
      client,
      connection,
      pool,
    });

    expect(driverConnection.getNativeConnection()).toBe(pool);
  });

  it("uses connection when pool is not provided", async () => {
    const driver = new MySQL2Driver();
    const connection = { query: async () => [] };

    const driverConnection = await driver.connect({
      connection,
    });

    expect(driverConnection.getNativeConnection()).toBe(connection);
  });

  it("owns client when ownsPool is set", async () => {
    const driver = new MySQL2Driver();
    const calls = { end: 0 };
    const pool = {
      end: async () => {
        calls.end += 1;
      },
      query: async () => [],
    };

    const driverConnection = await driver.connect({
      ownsPool: true,
      pool,
    });

    await driverConnection.close();
    expect(calls.end).toBe(1);
  });

  it("does not own client by default", async () => {
    const driver = new MySQL2Driver();
    const calls = { end: 0 };
    const pool = {
      end: async () => {
        calls.end += 1;
      },
      query: async () => [],
    };

    const driverConnection = await driver.connect({
      pool,
    });

    await driverConnection.close();
    expect(calls.end).toBe(0);
  });

  it("returns the Doctrine MySQL exception converter", () => {
    const driver = new MySQL2Driver();

    expect(driver.getExceptionConverter()).toBeInstanceOf(MySQLExceptionConverter);
  });
});
