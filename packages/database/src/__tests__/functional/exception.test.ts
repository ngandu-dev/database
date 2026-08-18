import { describe, expect, it } from "vitest";

import { InvalidFieldNameException } from "../../exception/invalid-field-name-exception";
import { NonUniqueFieldNameException } from "../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../exception/not-null-constraint-violation-exception";
import { SyntaxErrorException } from "../../exception/syntax-error-exception";
import { TableExistsException } from "../../exception/table-exists-exception";
import { TableNotFoundException } from "../../exception/table-not-found-exception";
import { UniqueConstraintViolationException } from "../../exception/unique-constraint-violation-exception";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/ExceptionTest", () => {
  const functional = useFunctionalTestCase();

  it("throws unique constraint violation for primary key duplicates", async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("duplicatekey_table")
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );

    const connection = functional.connection();
    await connection.insert("duplicatekey_table", { id: 1 });
    await expect(connection.insert("duplicatekey_table", { id: 1 })).rejects.toThrow(
      UniqueConstraintViolationException,
    );
  });

  it("throws table not found exception", async () => {
    await expect(
      functional.connection().executeQuery("SELECT * FROM unknown_table"),
    ).rejects.toThrow(TableNotFoundException);
  });

  it("throws table exists exception", async () => {
    const sm = await functional.connection().createSchemaManager();
    const table = Table.editor()
      .setUnquotedName("alreadyexist_table")
      .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
      .create();

    await functional.dropTableIfExists("alreadyexist_table");
    await sm.createTable(table);
    await expect(sm.createTable(table)).rejects.toThrow(TableExistsException);
  });

  it("throws not null constraint violation exception", async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("notnull_table")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
          Column.editor().setUnquotedName("val").setTypeName(Types.INTEGER).create(),
        )
        .create(),
    );

    await expect(
      functional.connection().insert("notnull_table", { id: 1, val: null }),
    ).rejects.toThrow(NotNullConstraintViolationException);
  });

  it("throws invalid field name exception", async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("bad_columnname_table")
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
        .create(),
    );

    await expect(
      functional.connection().insert("bad_columnname_table", { name: 5 }),
    ).rejects.toThrow(InvalidFieldNameException);
  });

  it("throws non-unique field name exception", async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("ambiguous_list_table_1")
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
        .create(),
    );
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("ambiguous_list_table_2")
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
        .create(),
    );

    await expect(
      functional
        .connection()
        .executeQuery("SELECT id FROM ambiguous_list_table_1, ambiguous_list_table_2"),
    ).rejects.toThrow(NonUniqueFieldNameException);
  });

  it("throws unique constraint violation on unique index", async () => {
    const table = Table.editor()
      .setUnquotedName("unique_column_table")
      .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
      .create();
    table.addUniqueIndex(["id"]);

    await functional.dropAndCreateTable(table);
    await functional.connection().insert("unique_column_table", { id: 5 });
    await expect(functional.connection().insert("unique_column_table", { id: 5 })).rejects.toThrow(
      UniqueConstraintViolationException,
    );
  });

  it("throws syntax error exception", async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("syntax_error_table")
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
        .create(),
    );

    await expect(
      functional.connection().executeQuery("SELECT id FRO syntax_error_table"),
    ).rejects.toThrow(SyntaxErrorException);
  });

  it.skip("network credential/host connection exception scenarios are covered by dedicated CI config and require params-based DriverManager bootstrap parity", async () => {
    // Doctrine also tests invalid user/password/host and SQLite read-only file paths via TestUtil::getConnectionParams().
    // Datazen functional harness currently injects real clients/pools instead of params-based connection bootstrap in this suite.
  });
});
