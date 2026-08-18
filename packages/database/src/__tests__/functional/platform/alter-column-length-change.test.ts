import { describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/AlterColumnLengthChangeTest", () => {
  const functional = useFunctionalTestCase();

  it("column length is changed", async () => {
    const table = Table.editor()
      .setUnquotedName("test_alter_length")
      .setColumns(
        Column.editor().setUnquotedName("c1").setTypeName(Types.STRING).setLength(50).create(),
      )
      .create();

    await functional.dropAndCreateTable(table);

    const schemaManager = await functional.connection().createSchemaManager();
    const introspected = await schemaManager.introspectTableByUnquotedName("test_alter_length");
    expect(introspected.getColumns()).toHaveLength(1);
    expect(introspected.getColumns()[0]?.getLength()).toBe(50);

    const altered = introspected
      .edit()
      .modifyColumnByUnquotedName("c1", (editor) => {
        editor.setLength(100);
      })
      .create();

    const diff = schemaManager
      .createComparator()
      .compareTables(
        await schemaManager.introspectTableByUnquotedName("test_alter_length"),
        altered,
      );
    expect(diff).not.toBeNull();
    if (diff === null) {
      return;
    }

    await schemaManager.alterTable(diff);

    const updated = await schemaManager.introspectTableByUnquotedName("test_alter_length");
    expect(updated.getColumns()).toHaveLength(1);
    expect(updated.getColumns()[0]?.getLength()).toBe(100);
  });
});
