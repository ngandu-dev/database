import { describe, expect, it } from "vitest";

import { SQLitePlatform } from "../../../../platforms/sqlite-platform";
import { Column } from "../../../../schema/column";
import { Table } from "../../../../schema/table";
import { Types } from "../../../../types/types";
import { useFunctionalTestCase } from "../../_helpers/functional-test-case";

describe("Functional/Schema/SQLite/ComparatorTest", () => {
  const functional = useFunctionalTestCase();

  it("change table collation", async () => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLitePlatform)) {
      return;
    }

    const initialTable = Table.editor()
      .setUnquotedName("comparator_test")
      .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.STRING).create())
      .create();

    await functional.dropAndCreateTable(initialTable);

    const desiredTable = initialTable
      .edit()
      .modifyColumnByUnquotedName("id", (editor) => {
        editor.setCollation("NOCASE");
      })
      .create();

    const schemaManager = await connection.createSchemaManager();
    const comparator = schemaManager.createComparator();

    const diff = comparator.compareTables(
      await schemaManager.introspectTableByUnquotedName("comparator_test"),
      desiredTable,
    );

    expect(diff).not.toBeNull();
    if (diff === null) {
      return;
    }

    expect(diff.isEmpty()).toBe(false);

    await schemaManager.alterTable(diff);

    const actualToDesired = comparator.compareTables(
      await schemaManager.introspectTableByUnquotedName("comparator_test"),
      desiredTable,
    );
    const desiredToActual = comparator.compareTables(
      desiredTable,
      await schemaManager.introspectTableByUnquotedName("comparator_test"),
    );

    expect(actualToDesired === null || actualToDesired.isEmpty()).toBe(true);
    expect(desiredToActual === null || desiredToActual.isEmpty()).toBe(true);
  });
});
