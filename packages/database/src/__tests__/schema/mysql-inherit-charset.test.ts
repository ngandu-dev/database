import { describe, expect, it } from "vitest";

import { Connection } from "../../connection";
import type { Driver } from "../../driver";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { Column } from "../../schema/column";
import { MySQLSchemaManager } from "../../schema/mysql-schema-manager";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";

function createUnusedDriver(platform: MySQLPlatform): Driver {
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
      return platform;
    },
  };
}

describe("MySQL schema manager charset inheritance parity", () => {
  it("inherits table options from database params", () => {
    let options = getTableOptionsForOverride();
    expect(options.charset).toBeUndefined();

    options = getTableOptionsForOverride({ charset: "utf8" });
    expect(options.charset).toBe("utf8");

    options = getTableOptionsForOverride({ charset: "utf8mb4" });
    expect(options.charset).toBe("utf8mb4");
  });

  it("applies MySQL table charset options to CREATE TABLE SQL", () => {
    const platform = new MySQLPlatform();

    let table = Table.editor()
      .setUnquotedName("foobar")
      .setColumns(Column.editor().setUnquotedName("aa").setTypeName(Types.INTEGER).create())
      .create();

    expect(platform.getCreateTableSQL(table)).toEqual(["CREATE TABLE foobar (aa INT NOT NULL)"]);

    table = Table.editor()
      .setUnquotedName("foobar")
      .setColumns(Column.editor().setUnquotedName("aa").setTypeName(Types.INTEGER).create())
      .setOptions({ charset: "utf8" })
      .create();

    expect(platform.getCreateTableSQL(table)).toEqual([
      "CREATE TABLE foobar (aa INT NOT NULL) DEFAULT CHARACTER SET utf8",
    ]);
  });
});

function getTableOptionsForOverride(params: Record<string, unknown> = {}): Record<string, unknown> {
  const platform = new MySQLPlatform();
  const connection = new Connection(params, createUnusedDriver(platform));
  const manager = new MySQLSchemaManager(connection, platform);

  return manager.createSchemaConfig().getDefaultTableOptions();
}
