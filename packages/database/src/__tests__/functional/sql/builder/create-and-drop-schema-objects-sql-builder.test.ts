import { describe, expect, it } from "vitest";

import type { AbstractSchemaManager } from "../../../../schema/abstract-schema-manager";
import { Column } from "../../../../schema/column";
import { PrimaryKeyConstraint } from "../../../../schema/primary-key-constraint";
import { Schema } from "../../../../schema/schema";
import { Table } from "../../../../schema/table";
import { Types } from "../../../../types/types";
import { useFunctionalTestCase } from "../../_helpers/functional-test-case";

describe("Functional/SQL/Builder/CreateAndDropSchemaObjectsSQLBuilderTest", () => {
  const functional = useFunctionalTestCase();

  it("create and drop tables with circular foreign keys", async () => {
    const table1 = createTable("t1", "t2");
    const table2 = createTable("t2", "t1");
    const schema = new Schema([table1, table2]);

    const schemaManager = await functional.connection().createSchemaManager();
    try {
      await schemaManager.dropSchemaObjects(schema);
    } catch {
      await functional.dropTableIfExists("t1");
      await functional.dropTableIfExists("t2");
    }

    await schemaManager.createSchemaObjects(schema);
    await introspectForeignKey(schemaManager, "t1", "t2");
    await introspectForeignKey(schemaManager, "t2", "t1");

    await schemaManager.dropSchemaObjects(schema);

    await expect(schemaManager.tablesExist(["t1"])).resolves.toBe(false);
    await expect(schemaManager.tablesExist(["t2"])).resolves.toBe(false);
  });
});

function createTable(name: string, otherName: string): Table {
  const table = Table.editor()
    .setUnquotedName(name)
    .setColumns(
      Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
      Column.editor().setUnquotedName("other_id").setTypeName(Types.INTEGER).create(),
    )
    .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
    .create();

  table.addForeignKeyConstraint(otherName, ["other_id"], ["id"]);

  return table;
}

async function introspectForeignKey(
  schemaManager: AbstractSchemaManager,
  tableName: string,
  expectedForeignTableName: string,
): Promise<void> {
  const foreignKeys = await schemaManager.listTableForeignKeys(tableName);
  expect(foreignKeys).toHaveLength(1);
  const normalizedForeignTableName = foreignKeys[0]
    ?.getForeignTableName()
    .replaceAll('"', "")
    .toLowerCase();
  expect(normalizedForeignTableName).toBe(expectedForeignTableName);
}
