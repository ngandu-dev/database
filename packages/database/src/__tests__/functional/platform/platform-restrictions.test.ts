import { describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/PlatformRestrictionsTest", () => {
  const functional = useFunctionalTestCase();

  it("max identifier length limit with autoincrement", async () => {
    const platform = functional.connection().getDatabasePlatform();
    const tableName = "x".repeat(platform.getMaxIdentifierLength());
    const columnName = "y".repeat(platform.getMaxIdentifierLength());

    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName(tableName)
        .setColumns(
          Column.editor()
            .setUnquotedName(columnName)
            .setTypeName(Types.INTEGER)
            .setAutoincrement(true)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames(columnName).create(),
        )
        .create(),
    );

    const createdTable = await (
      await functional.connection().createSchemaManager()
    ).introspectTableByUnquotedName(tableName);

    expect(createdTable.hasColumn(columnName)).toBe(true);
    expect(createdTable.getPrimaryKey()).not.toBeNull();
  });
});
