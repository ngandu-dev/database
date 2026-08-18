import { describe, expect, it } from "vitest";

import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { assertCommonPlatformSurface } from "./_helpers/platform-parity-scaffold";

describe("SQLitePlatform parity", () => {
  it("exposes SQLite-specific SQL helpers", () => {
    const platform = new SQLitePlatform();

    assertCommonPlatformSurface(platform);
    expect(platform.getCurrentDateSQL()).toBe("CURRENT_DATE");
    expect(platform.getCurrentTimeSQL()).toBe("CURRENT_TIME");
  });

  it("uses Doctrine-style autoincrement column declaration in CREATE TABLE SQL", () => {
    const platform = new SQLitePlatform();
    const table = Table.editor()
      .setUnquotedName("write_table")
      .setColumns(
        Column.editor()
          .setUnquotedName("id")
          .setTypeName(Types.INTEGER)
          .setAutoincrement(true)
          .create(),
        Column.editor().setUnquotedName("test_int").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .create();

    const sql = platform.getCreateTableSQL(table);

    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
    expect(sql[0]).not.toContain("PRIMARY KEY (");
  });
});
