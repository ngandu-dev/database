import { describe, expect, it } from "vitest";

import { PostgreSQLPlatform } from "../../../platforms/postgresql-platform";
import { Column } from "../../../schema/column";
import { UnqualifiedName } from "../../../schema/name/unqualified-name";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/AlterColumnTest", () => {
  const functional = useFunctionalTestCase();

  it("column position retained after altering", async () => {
    let table = Table.editor()
      .setUnquotedName("test_alter")
      .setColumns(
        Column.editor().setUnquotedName("c1").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("c2").setTypeName(Types.INTEGER).create(),
      )
      .create();

    await functional.dropAndCreateTable(table);

    table = table
      .edit()
      .modifyColumnByUnquotedName("c1", (editor) => {
        editor.setTypeName(Types.STRING).setLength(16);
      })
      .create();

    const schemaManager = await functional.connection().createSchemaManager();
    const diff = schemaManager
      .createComparator()
      .compareTables(await schemaManager.introspectTableByUnquotedName("test_alter"), table);
    expect(diff).not.toBeNull();
    if (diff === null) {
      return;
    }

    await schemaManager.alterTable(diff);

    const updated = await schemaManager.introspectTableByUnquotedName("test_alter");
    functional.assertUnqualifiedNameListEquals(
      [UnqualifiedName.unquoted("c1"), UnqualifiedName.unquoted("c2")],
      updated.getColumns().map((column) => column.getObjectName()),
    );
  });

  it("supports collations", async ({ skip }) => {
    if (!(functional.connection().getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("test_alter")
      .setColumns(
        Column.editor()
          .setUnquotedName("c1")
          .setTypeName(Types.STRING)
          .setCollation("en_US.utf8")
          .create(),
        Column.editor().setUnquotedName("c2").setTypeName(Types.STRING).create(),
      )
      .create();

    await functional.dropAndCreateTable(table);

    const schemaManager = await functional.connection().createSchemaManager();
    const diff = schemaManager
      .createComparator()
      .compareTables(await schemaManager.introspectTableByUnquotedName("test_alter"), table);

    expect(diff?.isEmpty()).toBe(true);
  });

  it("supports icu collation providers", async ({ skip }) => {
    if (!(functional.connection().getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      skip();
    }

    const hasIcuCollations =
      (await functional
        .connection()
        .fetchOne("SELECT 1 FROM pg_collation WHERE collprovider = 'icu'")) !== undefined;
    if (!hasIcuCollations) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("test_alter")
      .setColumns(
        Column.editor()
          .setUnquotedName("c1")
          .setTypeName(Types.STRING)
          .setCollation("en-US-x-icu")
          .create(),
      )
      .create();

    await functional.dropAndCreateTable(table);

    const schemaManager = await functional.connection().createSchemaManager();
    const diff = schemaManager
      .createComparator()
      .compareTables(await schemaManager.introspectTableByUnquotedName("test_alter"), table);

    expect(diff?.isEmpty()).toBe(true);
  });
});
