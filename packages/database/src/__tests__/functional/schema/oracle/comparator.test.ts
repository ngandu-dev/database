import { describe, expect, it } from "vitest";

import { OraclePlatform } from "../../../../platforms/oracle-platform";
import { Column } from "../../../../schema/column";
import type { ColumnEditor } from "../../../../schema/column-editor";
import { Table } from "../../../../schema/table";
import { Types } from "../../../../types/types";
import { useFunctionalTestCase } from "../../_helpers/functional-test-case";

describe("Functional/Schema/Oracle/ComparatorTest", () => {
  const functional = useFunctionalTestCase();

  it("change binary column fixed", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof OraclePlatform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("comparator_test")
      .setColumns(
        Column.editor()
          .setUnquotedName("id")
          .setTypeName(Types.BINARY)
          .setLength(32)
          .setFixed(true)
          .create(),
      )
      .create();

    await functional.dropAndCreateTable(table);

    const changed = table
      .edit()
      .modifyColumnByUnquotedName("id", (editor: ColumnEditor) => {
        editor.setFixed(false);
      })
      .create();

    const schemaManager = await connection.createSchemaManager();
    const comparator = schemaManager.createComparator();

    const actualToDesired = comparator.compareTables(
      await schemaManager.introspectTable(changed.getObjectName().toString()),
      changed,
    );
    const desiredToActual = comparator.compareTables(
      changed,
      await schemaManager.introspectTable(changed.getObjectName().toString()),
    );

    expect(actualToDesired === null || actualToDesired.isEmpty()).toBe(true);
    expect(desiredToActual === null || desiredToActual.isEmpty()).toBe(true);
  });
});
