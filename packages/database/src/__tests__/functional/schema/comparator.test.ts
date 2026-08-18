import { describe, expect, it } from "vitest";

import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { MariaDBPlatform } from "../../../platforms/mariadb-platform";
import { Column } from "../../../schema/column";
import { Comparator } from "../../../schema/comparator";
import { ComparatorConfig } from "../../../schema/comparator-config";
import { Table } from "../../../schema/table";
import { Type } from "../../../types/type";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/ComparatorTest", () => {
  const functional = useFunctionalTestCase();

  for (const [typeName, value] of defaultValueProvider()) {
    it(`default value comparison: ${typeName}`, async () => {
      const platform = functional.connection().getDatabasePlatform();
      if (
        typeName === Types.TEXT &&
        platform instanceof AbstractMySQLPlatform &&
        !(platform instanceof MariaDBPlatform)
      ) {
        return;
      }

      const table = Table.editor()
        .setUnquotedName("default_value")
        .setColumns(
          Column.editor()
            .setUnquotedName("test")
            .setTypeName(typeName)
            .setDefaultValue(value)
            .create(),
        )
        .create();

      await functional.dropAndCreateTable(table);

      const schemaManager = await functional.connection().createSchemaManager();
      const onlineTable = await schemaManager.introspectTableByUnquotedName("default_value");
      const diff = schemaManager.createComparator().compareTables(table, onlineTable);

      expect(diff).not.toBeNull();
      expect(diff?.isEmpty()).toBe(true);
    });
  }

  it("rename column comparison", () => {
    const platform = functional.connection().getDatabasePlatform();
    const comparator = new Comparator(platform, new ComparatorConfig());

    const table = Table.editor()
      .setUnquotedName("rename_table")
      .setColumns(
        Column.editor()
          .setUnquotedName("test")
          .setTypeName(Types.STRING)
          .setLength(20)
          .setDefaultValue("baz")
          .create(),
        Column.editor()
          .setUnquotedName("test2")
          .setTypeName(Types.STRING)
          .setLength(20)
          .setDefaultValue("baz")
          .create(),
        Column.editor()
          .setUnquotedName("test3")
          .setTypeName(Types.STRING)
          .setLength(10)
          .setDefaultValue("foo")
          .create(),
      )
      .create();

    const onlineTable = cloneTable(table);

    table.renameColumn("test", "baz").setLength(40).setComment("Comment");
    table.renameColumn("test2", "foo");
    table
      .getColumn("test3")
      .setAutoincrement(true)
      .setNotnull(false)
      .setType(Type.getType(Types.BIGINT));

    const compareResult = comparator.compareTables(onlineTable, table);
    expect(compareResult).not.toBeNull();
    if (compareResult === null) {
      return;
    }

    const renamedColumns = compareResult.getRenamedColumns();
    const changedColumns = compareResult.getChangedColumns();
    const modifiedColumns = compareResult.getModifiedColumns();

    expect(compareResult.getRenamedColumns()).toEqual(renamedColumns);
    expect(changedColumns).toHaveLength(3);
    expect(modifiedColumns).toHaveLength(2);
    expect(Object.keys(renamedColumns)).toHaveLength(2);
    expect(Object.hasOwn(renamedColumns, "test2")).toBe(true);

    const byOldName = new Map(changedColumns.map((diff) => [diff.getOldColumn().getName(), diff]));
    const renamedOnly = byOldName.get("test2");
    const renamedAndModified = byOldName.get("test");
    const modifiedOnly = byOldName.get("test3");

    expect(renamedOnly).toBeDefined();
    expect(renamedAndModified).toBeDefined();
    expect(modifiedOnly).toBeDefined();
    if (
      renamedOnly === undefined ||
      renamedAndModified === undefined ||
      modifiedOnly === undefined
    ) {
      return;
    }

    expect(renamedOnly.hasNameChanged()).toBe(true);
    expect(renamedOnly.countChangedProperties()).toBe(1);

    expect(renamedAndModified.hasNameChanged()).toBe(true);
    expect(renamedAndModified.hasLengthChanged()).toBe(true);
    expect(renamedAndModified.hasCommentChanged()).toBe(true);
    expect(renamedAndModified.hasTypeChanged()).toBe(false);
    expect(renamedAndModified.countChangedProperties()).toBe(3);

    expect(modifiedOnly.hasAutoIncrementChanged()).toBe(true);
    expect(modifiedOnly.hasNotNullChanged()).toBe(true);
    expect(modifiedOnly.hasTypeChanged()).toBe(true);
    expect(modifiedOnly.hasLengthChanged()).toBe(false);
    expect(modifiedOnly.hasCommentChanged()).toBe(false);
    expect(modifiedOnly.hasNameChanged()).toBe(false);
    expect(modifiedOnly.countChangedProperties()).toBeGreaterThanOrEqual(3);
  });
});

function defaultValueProvider(): Array<[string, unknown]> {
  return [
    [Types.INTEGER, 1],
    [Types.BOOLEAN, false],
    [Types.TEXT, "Datazen"],
  ];
}

function cloneTable(table: Table): Table {
  const editor = Table.editor()
    .setName(table.getName())
    .setColumns(...table.getColumns().map((column) => column.edit().create()))
    .setIndexes(...table.getIndexes().map((index) => index.edit().create()))
    .setUniqueConstraints(
      ...table.getUniqueConstraints().map((constraint) => constraint.edit().create()),
    )
    .setForeignKeyConstraints(
      ...table.getForeignKeys().map((constraint) => constraint.edit().create()),
    )
    .setOptions(table.getOptions());

  const primaryKeyConstraint = table.getPrimaryKeyConstraint();
  if (primaryKeyConstraint !== null) {
    editor.setPrimaryKeyConstraint(primaryKeyConstraint.edit().create());
  }

  return editor.create();
}
