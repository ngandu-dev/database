import { describe, expect, it } from "vitest";

import { Connection } from "../../connection";
import type { Driver } from "../../driver";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { SQLiteSchemaManager } from "../../schema/sqlite-schema-manager";

class CapturingSQLiteSchemaManager extends SQLiteSchemaManager {
  public static passedDatabaseName = "";

  protected override async fetchForeignKeyColumns(
    databaseName: string,
    _tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    CapturingSQLiteSchemaManager.passedDatabaseName = databaseName;
    return [];
  }
}

function createUnusedDriver(): Driver {
  return {
    async connect() {
      throw new Error("connect() should not be called in this test");
    },
    getExceptionConverter() {
      return {
        convert() {
          throw new Error("convert() should not be called in this test");
        },
      } as any;
    },
    getDatabasePlatform() {
      return new SQLitePlatform();
    },
  };
}

describe("SQLiteSchemaManager parity", () => {
  it("passes the default database name when listing table foreign keys", async () => {
    const connection = new Connection({ dbname: "main" }, createUnusedDriver());
    const manager = new CapturingSQLiteSchemaManager(connection, new SQLitePlatform());

    await expect(manager.listTableForeignKeys("t")).resolves.toEqual([]);
    expect(CapturingSQLiteSchemaManager.passedDatabaseName).toBe("main");
  });
});
