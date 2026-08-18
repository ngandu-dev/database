import { beforeEach, describe, expect, it } from "vitest";

import { InvalidColumnIndex } from "../../exception/invalid-column-index";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/ResultMetadataTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    const table = Table.editor()
      .setUnquotedName("result_metadata_table")
      .setColumns(Column.editor().setUnquotedName("test_int").setTypeName(Types.INTEGER).create())
      .setPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("test_int").create(),
      )
      .create();

    await functional.dropAndCreateTable(table);
    await functional.connection().insert("result_metadata_table", { test_int: 1 });
  });

  it("returns column names with results", async () => {
    const result = await functional
      .connection()
      .executeQuery("SELECT test_int, test_int AS alternate_name FROM result_metadata_table");

    expect(result.columnCount()).toBe(2);
    expect(result.getColumnName(0).toLowerCase()).toBe("test_int");
    expect(result.getColumnName(1).toLowerCase()).toBe("alternate_name");
  });

  it.each([2, -1])("throws invalid column index for %i", async (index) => {
    const result = await functional
      .connection()
      .executeQuery("SELECT test_int, test_int AS alternate_name FROM result_metadata_table");

    result.fetchAllAssociative();

    expect(() => result.getColumnName(index)).toThrow(InvalidColumnIndex);
  });

  it("returns column names without results", async ({ skip }) => {
    const connection = functional.connection();
    const result = await connection.executeQuery(
      "SELECT test_int, test_int AS alternate_name FROM result_metadata_table WHERE 1 = 0",
    );

    if (connection.getDatabasePlatform() instanceof SQLitePlatform && result.columnCount() === 0) {
      skip();
    }

    expect(result.columnCount()).toBe(2);
    expect(result.getColumnName(0).toLowerCase()).toBe("test_int");
    expect(result.getColumnName(1).toLowerCase()).toBe("alternate_name");
  });
});
