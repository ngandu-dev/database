import { describe, expect, it } from "vitest";

import { SQLServerPlatform } from "../../../platforms/sqlserver-platform";
import { Column } from "../../../schema/column";
import type { ColumnEditor } from "../../../schema/column-editor";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/SQLServerSchemaManagerTest", () => {
  const functional = useFunctionalTestCase();

  it("column collation", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLServerPlatform)) {
      skip();
    }

    let table = Table.editor()
      .setUnquotedName("test_collation")
      .setColumns(
        Column.editor().setUnquotedName("test").setTypeName(Types.STRING).setLength(32).create(),
      )
      .create();

    await functional.dropTableIfExists("test_collation");
    await functional.dropAndCreateTable(table);
    let columns = await (
      await connection.createSchemaManager()
    ).introspectTableColumnsByUnquotedName("test_collation");

    expect(columns[0]?.getCollation()).not.toBeNull();

    table = table
      .edit()
      .modifyColumnByUnquotedName("test", (editor: ColumnEditor) => {
        editor.setCollation("Icelandic_CS_AS");
      })
      .create();

    await functional.dropAndCreateTable(table);
    columns = await (await connection.createSchemaManager()).introspectTableColumnsByUnquotedName(
      "test_collation",
    );

    expect(columns[0]?.getCollation()).toBe("Icelandic_CS_AS");
  });

  it("default constraints", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLServerPlatform)) {
      skip();
    }

    const schemaManager = await connection.createSchemaManager();
    await functional.dropTableIfExists("sqlserver_default_constraints");
    const oldTable = Table.editor()
      .setUnquotedName("sqlserver_default_constraints")
      .setColumns(
        Column.editor()
          .setUnquotedName("no_default")
          .setTypeName(Types.STRING)
          .setLength(32)
          .create(),
        Column.editor()
          .setUnquotedName("df_integer")
          .setTypeName(Types.INTEGER)
          .setDefaultValue(666)
          .create(),
        Column.editor()
          .setUnquotedName("df_string_1")
          .setTypeName(Types.STRING)
          .setLength(32)
          .setDefaultValue("foobar")
          .create(),
        Column.editor()
          .setUnquotedName("df_string_2")
          .setTypeName(Types.STRING)
          .setLength(32)
          .setDefaultValue("Datazen rocks!!!")
          .create(),
        Column.editor()
          .setUnquotedName("df_string_3")
          .setTypeName(Types.STRING)
          .setLength(32)
          .setDefaultValue("another default value")
          .create(),
        Column.editor()
          .setUnquotedName("df_string_4")
          .setTypeName(Types.STRING)
          .setLength(32)
          .setDefaultValue("column to rename")
          .create(),
        Column.editor()
          .setUnquotedName("df_boolean")
          .setTypeName(Types.BOOLEAN)
          .setDefaultValue(true)
          .create(),
      )
      .create();

    await schemaManager.createTable(oldTable);
    let columns = await schemaManager.introspectTableColumnsByUnquotedName(
      "sqlserver_default_constraints",
    );
    expect(columns).toHaveLength(7);
    let columnsByName = new Map(columns.map((column) => [column.getName(), column]));
    expect(columnsByName.get("no_default")?.getDefault()).toBeNull();
    expect(Number(columnsByName.get("df_integer")?.getDefault())).toBe(666);
    expect(columnsByName.get("df_string_1")?.getDefault()).toBe("foobar");
    expect(columnsByName.get("df_string_2")?.getDefault()).toBe("Datazen rocks!!!");
    expect(columnsByName.get("df_string_3")?.getDefault()).toBe("another default value");
    expect(columnsByName.get("df_string_4")?.getDefault()).toBe("column to rename");
    expect(Number(columnsByName.get("df_boolean")?.getDefault())).toBe(1);

    const newTable = oldTable
      .edit()
      .modifyColumnByUnquotedName("df_integer", (editor: ColumnEditor) => {
        editor.setDefaultValue(0);
      })
      .modifyColumnByUnquotedName("df_string_2", (editor: ColumnEditor) => {
        editor.setDefaultValue(null);
      })
      .modifyColumnByUnquotedName("df_boolean", (editor: ColumnEditor) => {
        editor.setDefaultValue(false);
      })
      .dropColumnByUnquotedName("df_string_1")
      .dropColumnByUnquotedName("df_string_4")
      .addColumn(
        Column.editor()
          .setUnquotedName("df_string_4_renamed")
          .setTypeName(Types.STRING)
          .setLength(32)
          .setDefaultValue("column to rename")
          .create(),
      )
      .create();

    const diff = schemaManager
      .createComparator()
      .compareTables(
        await schemaManager.introspectTableByUnquotedName("sqlserver_default_constraints"),
        newTable,
      );

    expect(diff).not.toBeNull();
    if (diff === null) {
      return;
    }

    await schemaManager.alterTable(diff);
    columns = await schemaManager.introspectTableColumnsByUnquotedName(
      "sqlserver_default_constraints",
    );

    expect(columns).toHaveLength(6);
    columnsByName = new Map(columns.map((column) => [column.getName(), column]));
    expect(columnsByName.get("no_default")?.getDefault()).toBeNull();
    expect(Number(columnsByName.get("df_integer")?.getDefault())).toBe(0);
    expect(columnsByName.get("df_string_2")?.getDefault()).toBeNull();
    expect(columnsByName.get("df_string_3")?.getDefault()).toBe("another default value");
    expect(columnsByName.get("df_string_4_renamed")?.getDefault()).toBe("column to rename");
    expect(Number(columnsByName.get("df_boolean")?.getDefault())).toBe(0);
  });

  it("pk ordering", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLServerPlatform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("sqlserver_pk_ordering")
      .setColumns(
        Column.editor().setUnquotedName("colA").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("colB").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("colB", "colA").create(),
      )
      .create();

    const schemaManager = await connection.createSchemaManager();
    await functional.dropTableIfExists("sqlserver_pk_ordering");
    await schemaManager.createTable(table);

    const indexes = await schemaManager.listTableIndexes("sqlserver_pk_ordering");
    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.getColumns()).toEqual(["colB", "colA"]);
  });

  it("nvarchar max is length minus 1", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLServerPlatform)) {
      skip();
    }

    await functional.dropTableIfExists("test_nvarchar_max");
    await connection.executeStatement(`CREATE TABLE test_nvarchar_max (
      col_nvarchar_max NVARCHAR(MAX),
      col_nvarchar NVARCHAR(128)
    )`);

    const table = await (await connection.createSchemaManager()).introspectTableByUnquotedName(
      "test_nvarchar_max",
    );

    expect(table.getColumn("col_nvarchar_max").getLength()).toBe(-1);
    expect(table.getColumn("col_nvarchar").getLength()).toBe(128);
  });
});
