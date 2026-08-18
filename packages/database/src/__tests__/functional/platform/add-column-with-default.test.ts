import { describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/AddColumnWithDefaultTest", () => {
  const functional = useFunctionalTestCase();

  it("add column with default", async () => {
    const connection = functional.connection();
    const schemaManager = await connection.createSchemaManager();

    let table = Table.editor()
      .setUnquotedName("add_default_test")
      .setColumns(
        Column.editor()
          .setUnquotedName("original_field")
          .setTypeName(Types.STRING)
          .setLength(8)
          .create(),
      )
      .create();

    await functional.dropAndCreateTable(table);
    await connection.executeStatement(
      "INSERT INTO add_default_test (original_field) VALUES ('one')",
    );

    table = table
      .edit()
      .addColumn(
        Column.editor()
          .setUnquotedName("new_field")
          .setTypeName(Types.STRING)
          .setLength(8)
          .setDefaultValue("DEFAULT")
          .create(),
      )
      .create();

    const actual = await schemaManager.introspectTableByUnquotedName("add_default_test");
    const diff = schemaManager.createComparator().compareTables(actual, table);
    expect(diff).not.toBeNull();
    if (diff === null) {
      return;
    }

    await schemaManager.alterTable(diff);

    const result = await connection.fetchNumeric<[unknown, unknown]>(
      "SELECT original_field, new_field FROM add_default_test",
    );
    expect(result).toEqual(["one", "DEFAULT"]);
  });
});
