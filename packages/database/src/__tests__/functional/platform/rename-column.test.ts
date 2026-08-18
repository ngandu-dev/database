import { describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { UnqualifiedName } from "../../../schema/name/unqualified-name";
import { Table } from "../../../schema/table";
import type { TableDiff } from "../../../schema/table-diff";
import { Type } from "../../../types/type";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

const columnNames = [
  ["c1", "c1_x"],
  ["C1", "c1_x"],
  ["importantColumn", "very_important_column"],
] as const;

describe("Functional/Platform/RenameColumnTest", () => {
  const functional = useFunctionalTestCase();

  for (const [oldColumnName, newColumnName] of columnNames) {
    it(`column position retained after implicit renaming (${oldColumnName} -> ${newColumnName})`, async () => {
      let table = Table.editor()
        .setUnquotedName("test_rename")
        .setColumns(
          Column.editor()
            .setUnquotedName(oldColumnName)
            .setTypeName(Types.STRING)
            .setLength(16)
            .create(),
          Column.editor().setUnquotedName("c2").setTypeName(Types.INTEGER).create(),
        )
        .create();

      await functional.dropAndCreateTable(table);

      table = table
        .edit()
        .dropColumnByUnquotedName(oldColumnName)
        .addColumn(
          Column.editor()
            .setUnquotedName(newColumnName)
            .setTypeName(Types.STRING)
            .setLength(16)
            .create(),
        )
        .create();

      const schemaManager = await functional.connection().createSchemaManager();
      const diff = schemaManager
        .createComparator()
        .compareTables(await schemaManager.introspectTableByUnquotedName("test_rename"), table);
      expect(diff).not.toBeNull();
      if (diff === null) {
        return;
      }

      await schemaManager.alterTable(diff);

      const updated = await schemaManager.introspectTableByUnquotedName("test_rename");
      functional.assertUnqualifiedNameListEquals(
        [UnqualifiedName.unquoted(newColumnName), UnqualifiedName.unquoted("c2")],
        updated.getColumns().map((column) => column.getObjectName()),
      );

      expect(getRenamedColumns(diff)).toHaveLength(1);
      expect(Object.keys(diff.getRenamedColumns())).toHaveLength(1);
    });

    it(`column position retained after explicit renaming (${oldColumnName} -> ${newColumnName})`, async () => {
      const table = Table.editor()
        .setUnquotedName("test_rename")
        .setColumns(
          Column.editor()
            .setUnquotedName(oldColumnName)
            .setTypeName(Types.INTEGER)
            .setLength(16)
            .create(),
          Column.editor().setUnquotedName("c2").setTypeName(Types.INTEGER).create(),
        )
        .create();

      await functional.dropAndCreateTable(table);

      table
        .renameColumn(oldColumnName, newColumnName)
        .setType(Type.getType(Types.BIGINT))
        .setLength(32);

      const schemaManager = await functional.connection().createSchemaManager();
      const diff = schemaManager
        .createComparator()
        .compareTables(await schemaManager.introspectTableByUnquotedName("test_rename"), table);
      expect(diff).not.toBeNull();
      if (diff === null) {
        return;
      }

      await schemaManager.alterTable(diff);

      const updated = await schemaManager.introspectTableByUnquotedName("test_rename");
      expect(diff.getChangedColumns()).toHaveLength(1);
      expect(Object.keys(diff.getRenamedColumns())).toHaveLength(1);
      expect(diff.getModifiedColumns()).toHaveLength(1);

      functional.assertUnqualifiedNameListEquals(
        [UnqualifiedName.unquoted(newColumnName), UnqualifiedName.unquoted("c2")],
        updated.getColumns().map((column) => column.getObjectName()),
      );
    });
  }

  it("rename column to quoted", async () => {
    let table = Table.editor()
      .setUnquotedName("test_rename")
      .setColumns(Column.editor().setUnquotedName("c1").setTypeName(Types.INTEGER).create())
      .create();

    await functional.dropAndCreateTable(table);

    table = table
      .edit()
      .dropColumnByUnquotedName("c1")
      .addColumn(Column.editor().setQuotedName("c2").setTypeName(Types.INTEGER).create())
      .create();

    const schemaManager = await functional.connection().createSchemaManager();
    const comparator = schemaManager.createComparator();
    const diff = comparator.compareTables(
      await schemaManager.introspectTableByUnquotedName("test_rename"),
      table,
    );
    expect(diff).not.toBeNull();
    if (diff === null) {
      return;
    }

    expect(diff.isEmpty()).toBe(false);
    await schemaManager.alterTable(diff);

    const platform = functional.connection().getDatabasePlatform();
    const inserted = await functional.connection().insert("test_rename", {
      [platform.quoteSingleIdentifier("c2")]: 1,
    });
    expect(inserted).toBe(1);
  });
});

function getRenamedColumns(tableDiff: TableDiff): Column[] {
  const renamed: Column[] = [];

  for (const diff of tableDiff.getChangedColumns()) {
    if (!diff.hasNameChanged()) {
      continue;
    }

    renamed.push(diff.getNewColumn());
  }

  return renamed;
}
