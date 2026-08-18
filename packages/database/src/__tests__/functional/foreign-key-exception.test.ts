import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ForeignKeyConstraintViolationException } from "../../exception/foreign-key-constraint-violation-exception";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { Column } from "../../schema/column";
import { ForeignKeyConstraint } from "../../schema/foreign-key-constraint";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/ForeignKeyExceptionTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropTableIfExists("owning_table");
    await functional.dropTableIfExists("constraint_error_table");

    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLServerPlatform) {
      return;
    }

    const schemaManager = await connection.createSchemaManager();
    await schemaManager.createTable(createReferencedTable());
    await schemaManager.createTable(createOwningTable());
  });

  afterEach(async () => {
    await functional.dropTableIfExists("owning_table");
    await functional.dropTableIfExists("constraint_error_table");
  });

  it("throws foreign key constraint violation exception on insert", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLServerPlatform) {
      skip();
    }

    await connection.insert("constraint_error_table", { id: 1 });
    await connection.insert("owning_table", { id: 1, constraint_id: 1 });

    await expect(connection.insert("owning_table", { id: 2, constraint_id: 2 })).rejects.toThrow(
      ForeignKeyConstraintViolationException,
    );
  });

  it("throws foreign key constraint violation exception on update", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLServerPlatform) {
      skip();
    }

    await connection.insert("constraint_error_table", { id: 1 });
    await connection.insert("owning_table", { id: 1, constraint_id: 1 });

    await expect(connection.update("constraint_error_table", { id: 2 }, { id: 1 })).rejects.toThrow(
      ForeignKeyConstraintViolationException,
    );
  });

  it("throws foreign key constraint violation exception on delete", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLServerPlatform) {
      skip();
    }

    await connection.insert("constraint_error_table", { id: 1 });
    await connection.insert("owning_table", { id: 1, constraint_id: 1 });

    await expect(connection.delete("constraint_error_table", { id: 1 })).rejects.toThrow(
      ForeignKeyConstraintViolationException,
    );
  });

  it("throws foreign key constraint violation exception on truncate", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLServerPlatform) {
      skip();
    }

    const platform = connection.getDatabasePlatform();
    await connection.insert("constraint_error_table", { id: 1 });
    await connection.insert("owning_table", { id: 1, constraint_id: 1 });

    await expect(
      connection.executeStatement(platform.getTruncateTableSQL("constraint_error_table")),
    ).rejects.toThrow(ForeignKeyConstraintViolationException);
  });
});

function createReferencedTable(): Table {
  return Table.editor()
    .setUnquotedName("constraint_error_table")
    .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
    .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
    .create();
}

function createOwningTable(): Table {
  return Table.editor()
    .setUnquotedName("owning_table")
    .setColumns(
      Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
      Column.editor().setUnquotedName("constraint_id").setTypeName(Types.INTEGER).create(),
    )
    .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
    .setForeignKeyConstraints(
      ForeignKeyConstraint.editor()
        .setUnquotedReferencingColumnNames("constraint_id")
        .setUnquotedReferencedTableName("constraint_error_table")
        .setUnquotedReferencedColumnNames("id")
        .create(),
    )
    .create();
}
