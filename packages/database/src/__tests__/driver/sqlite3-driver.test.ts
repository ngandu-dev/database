import { describe, expect, it } from "vitest";

import { StaticServerVersionProvider } from "../../connection/static-server-version-provider";
import { ExceptionConverter as SQLiteExceptionConverter } from "../../driver/api/sqlite/exception-converter";
import { SQLite3Driver } from "../../driver/sqlite3/driver";
import { SQLitePlatform } from "../../platforms/sqlite-platform";

describe("SQLite3Driver", () => {
  it("throws when no database object is provided", async () => {
    const driver = new SQLite3Driver();

    await expect(driver.connect({})).rejects.toThrow(Error);
  });

  it("prefers database over connection/client", async () => {
    const driver = new SQLite3Driver();
    const makeDb = () => ({
      all: (_sql: string, _params: unknown[], cb: (e: Error | null, rows?: unknown[]) => void) =>
        cb(null, []),
      run: (
        _sql: string,
        _params: unknown[],
        cb?: (this: { changes: number; lastID: number }, e: Error | null) => void,
      ) => cb?.call({ changes: 0, lastID: 0 }, null),
    });
    const database = makeDb();
    const connection = makeDb();
    const client = makeDb();

    const driverConnection = await driver.connect({
      client,
      connection,
      database,
    });

    expect(driverConnection.getNativeConnection()).toBe(database);
  });

  it("closes owned databases when configured", async () => {
    const calls = { close: 0 };
    const database = {
      all: (_sql: string, _params: unknown[], cb: (e: Error | null, rows?: unknown[]) => void) =>
        cb(null, []),
      close: (cb: (e: Error | null) => void) => {
        calls.close += 1;
        cb(null);
      },
      run: (
        _sql: string,
        _params: unknown[],
        cb?: (this: { changes: number; lastID: number }, e: Error | null) => void,
      ) => cb?.call({ changes: 0, lastID: 0 }, null),
    };

    const connection = await new SQLite3Driver().connect({ client: database, ownsClient: true });
    await connection.close();
    expect(calls.close).toBe(1);
  });

  it("returns the Doctrine SQLite exception converter", () => {
    const driver = new SQLite3Driver();
    expect(driver.getExceptionConverter()).toBeInstanceOf(SQLiteExceptionConverter);
  });

  it("returns the SQLite platform", () => {
    const platform = new SQLite3Driver().getDatabasePlatform(
      new StaticServerVersionProvider("3.45.1"),
    );
    expect(platform).toBeInstanceOf(SQLitePlatform);
  });
});
