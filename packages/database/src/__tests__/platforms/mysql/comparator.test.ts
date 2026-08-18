import { describe, expect, it } from "vitest";

import { Comparator } from "../../../platforms/mysql/comparator";
import { DefaultTableOptions } from "../../../platforms/mysql/default-table-options";
import { MySQLPlatform } from "../../../platforms/mysql-platform";
import { Column } from "../../../schema/column";
import { Schema } from "../../../schema/schema";
import { Sequence } from "../../../schema/sequence";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";

describe("MySQL Comparator (Doctrine parity, adapted)", () => {
  function createComparator(): Comparator {
    return new Comparator(
      new MySQLPlatform(),
      { getDefaultCharsetCollation: () => null },
      { getCollationCharset: () => null },
      new DefaultTableOptions("utf8mb4", "utf8mb4_general_ci"),
    );
  }

  it("instantiates and preserves base comparator behavior for schema/table/sequence diffs", () => {
    const comparator = createComparator();
    const oldSchema = new Schema([createTable("foo")], [new Sequence("a_seq")]);
    const newSchema = new Schema([createTable("foo"), createTable("bar")], [new Sequence("a_seq")]);

    const diff = comparator.compareSchemas(oldSchema, newSchema);

    expect(diff.getCreatedTables().map((table) => table.getName())).toEqual(["bar"]);
    expect(diff.getDroppedTables()).toEqual([]);
    expect(
      comparator.compareTables(createTable("foo"), createTable("foo"))?.hasChanges() ?? false,
    ).toBe(false);
    expect(comparator.diffSequence(new Sequence("x", 1, 1), new Sequence("x", 2, 1))).toBe(true);
  });

  it("normalizes charset/collation inheritance without mutating inputs", () => {
    const comparator = new Comparator(
      new MySQLPlatform(),
      {
        getDefaultCharsetCollation: (charset) =>
          charset === "utf8mb4" ? "utf8mb4_general_ci" : null,
      },
      {
        getCollationCharset: (collation) => (collation === "utf8mb4_general_ci" ? "utf8mb4" : null),
      },
      new DefaultTableOptions("utf8mb4", "utf8mb4_general_ci"),
    );

    const oldTable = new Table("foo");
    oldTable.addColumn("name", Types.STRING, { platformOptions: { charset: "utf8mb4" } });

    const newTable = new Table("foo");
    newTable.addColumn("name", Types.STRING, {
      platformOptions: { collation: "utf8mb4_general_ci" },
    });

    const oldOptionsBefore = oldTable.getColumn("name").getPlatformOptions();
    const newOptionsBefore = newTable.getColumn("name").getPlatformOptions();

    const diff = comparator.compareTables(oldTable, newTable);

    expect(diff === null || diff.isEmpty()).toBe(true);
    expect(oldTable.getColumn("name").getPlatformOptions()).toEqual(oldOptionsBefore);
    expect(newTable.getColumn("name").getPlatformOptions()).toEqual(newOptionsBefore);
  });
});

function createTable(name: string): Table {
  return Table.editor()
    .setName(name)
    .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
    .create();
}
