import { beforeAll, describe, expect, it } from "vitest";

import { MariaDBPlatform } from "../../../platforms/mariadb-platform";
import { Comparator } from "../../../platforms/mysql/comparator";
import { DefaultTableOptions } from "../../../platforms/mysql/default-table-options";
import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { registerBuiltInTypes } from "../../../types/register-built-in-types";
import { Types } from "../../../types/types";

describe("MySQL MariaDBJsonComparatorTest parity (Doctrine adapted)", () => {
  beforeAll(() => {
    registerBuiltInTypes();
  });

  function createComparator(): Comparator {
    return new Comparator(
      new MariaDBPlatform(),
      { getDefaultCharsetCollation: () => null },
      { getCollationCharset: () => null },
      new DefaultTableOptions("utf8mb4", "utf8mb4_general_ci"),
    );
  }

  function createTableA(): Table {
    return Table.editor()
      .setUnquotedName("foo")
      .setColumns(
        jsonColumn("json_1", "latin1_swedish_ci"),
        jsonColumn("json_2", "utf8_general_ci"),
        jsonColumn("json_3"),
      )
      .setOptions({ charset: "latin1", collation: "latin1_swedish_ci" })
      .create();
  }

  function createTableB(): Table {
    return Table.editor()
      .setUnquotedName("foo")
      .setColumns(
        jsonColumn("json_1", "latin1_swedish_ci"),
        jsonColumn("json_2", "utf8_general_ci"),
        jsonColumn("json_3"),
      )
      .create();
  }

  function createTableC(): Table {
    return Table.editor()
      .setUnquotedName("foo")
      .setColumns(
        jsonColumn("json_1", "utf8mb4_bin"),
        jsonColumn("json_2", "utf8mb4_bin"),
        jsonColumn("json_3", "utf8mb4_bin"),
      )
      .create();
  }

  function createTableD(): Table {
    return Table.editor()
      .setUnquotedName("foo")
      .setColumns(jsonColumn("json_1"), jsonColumn("json_2"), jsonColumn("json_3"))
      .create();
  }

  it.each([
    ["A", "B", createTableA, createTableB],
    ["A", "C", createTableA, createTableC],
    ["A", "D", createTableA, createTableD],
    ["B", "C", createTableB, createTableC],
    ["B", "D", createTableB, createTableD],
    ["C", "D", createTableC, createTableD],
  ])("considers tables %s and %s identical for JSON collation comparison", (_a, _b, makeLeft, makeRight) => {
    const diff = createComparator().compareTables(makeLeft(), makeRight());

    expect(diff === null || diff.isEmpty()).toBe(true);
  });
});

function jsonColumn(name: string, collation?: string): Column {
  const editor = Column.editor().setUnquotedName(name).setTypeName(Types.JSON);
  if (collation !== undefined) {
    editor.setCollation(collation);
  }

  return editor.create();
}
