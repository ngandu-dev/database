import { describe, expect, it } from "vitest";

import { OraclePlatform } from "../../../platforms/oracle-platform";
import { Column } from "../../../schema/column";
import type { ColumnEditor } from "../../../schema/column-editor";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { DateTimeType } from "../../../types/date-time-type";
import { DateTimeTzType } from "../../../types/date-time-tz-type";
import { DateType } from "../../../types/date-type";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/OracleSchemaManagerTest", () => {
  const functional = useFunctionalTestCase();

  it("alter table column not null", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof OraclePlatform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("list_table_column_notnull")
      .setColumns(
        Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("foo").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("bar").setTypeName(Types.STRING).setLength(32).create(),
      )
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .create();

    await functional.dropAndCreateTable(table);

    const schemaManager = await connection.createSchemaManager();
    let columns = await schemaManager.introspectTableColumnsByUnquotedName(
      "list_table_column_notnull",
    );
    expect(columns[0]?.getNotnull()).toBe(true);
    expect(columns[1]?.getNotnull()).toBe(true);
    expect(columns[2]?.getNotnull()).toBe(true);

    const changed = table
      .edit()
      .modifyColumnByUnquotedName("foo", (editor: ColumnEditor) => {
        editor.setNotNull(false);
      })
      .modifyColumnByUnquotedName("bar", (editor: ColumnEditor) => {
        editor.setLength(1024);
      })
      .create();

    const diff = schemaManager.createComparator().compareTables(table, changed);
    expect(diff).not.toBeNull();
    if (diff === null) {
      return;
    }

    await schemaManager.alterTable(diff);
    columns = await schemaManager.introspectTableColumnsByUnquotedName("list_table_column_notnull");
    expect(columns[0]?.getNotnull()).toBe(true);
    expect(columns[1]?.getNotnull()).toBe(false);
    expect(columns[2]?.getNotnull()).toBe(true);
  });

  it("list table date type columns", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof OraclePlatform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("tbl_date")
      .setColumns(
        Column.editor().setUnquotedName("col_date").setTypeName(Types.DATE_MUTABLE).create(),
        Column.editor()
          .setUnquotedName("col_datetime")
          .setTypeName(Types.DATETIME_MUTABLE)
          .create(),
        Column.editor()
          .setUnquotedName("col_datetimetz")
          .setTypeName(Types.DATETIMETZ_MUTABLE)
          .create(),
      )
      .create();

    await functional.dropAndCreateTable(table);
    const columns = await (
      await connection.createSchemaManager()
    ).introspectTableColumnsByUnquotedName("tbl_date");

    expect(columns[0]?.getType()).toBeInstanceOf(DateType);
    expect(columns[1]?.getType()).toBeInstanceOf(DateTimeType);
    expect(columns[2]?.getType()).toBeInstanceOf(DateTimeTzType);
  });
});
