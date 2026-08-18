import { describe, expect, it } from "vitest";

import { AbstractSQLiteDriver } from "../../driver/abstract-sqlite-driver";
import type { Connection as DriverConnection } from "../../driver/connection";
import { SQLitePlatform } from "../../platforms/sqlite-platform";

class TestSQLiteDriver extends AbstractSQLiteDriver {
  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    throw new Error("not needed");
  }
}

describe("Driver AbstractSQLiteDriverTestCase parity", () => {
  it("creates SQLite platforms without server-version branching", () => {
    expect(new TestSQLiteDriver().getDatabasePlatform({} as never)).toBeInstanceOf(SQLitePlatform);
  });

  it.skip(
    "SQLite drivers do not use server version to instantiate platform (Doctrine parity skip)",
  );
});
