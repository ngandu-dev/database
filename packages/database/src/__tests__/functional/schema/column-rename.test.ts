import { beforeEach, describe, expect, it } from "vitest";

import { SQLitePlatform } from "../../../platforms/sqlite-platform";
import type { AbstractSchemaManager } from "../../../schema/abstract-schema-manager";
import { Column } from "../../../schema/column";
import type { Comparator } from "../../../schema/comparator";
import { ForeignKeyConstraint } from "../../../schema/foreign-key-constraint";
import { Index } from "../../../schema/index";
import { Table } from "../../../schema/table";
import type { TableEditor } from "../../../schema/table-editor";
import { UniqueConstraint } from "../../../schema/unique-constraint";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/ColumnRenameTest", () => {
  const functional = useFunctionalTestCase();
  let schemaManager: AbstractSchemaManager;
  let comparator: Comparator;

  beforeEach(async () => {
    schemaManager = await functional.connection().createSchemaManager();
    comparator = schemaManager.createComparator();
  });

  it("rename column in index", async () => {
    await testRenameColumn(functional, schemaManager, comparator, (editor) => {
      editor.addIndex(
        Index.editor().setUnquotedName("idx_c1_c2").setUnquotedColumnNames("c1", "c1").create(),
      );
    });
  });

  it("rename column in foreign key constraint", async () => {
    if (functional.connection().getDatabasePlatform() instanceof SQLitePlatform) {
      return;
    }

    await functional.dropTableIfExists("rename_column_referenced");

    const referencedTable = Table.editor()
      .setUnquotedName("rename_column_referenced")
      .setColumns(
        Column.editor().setUnquotedName("c1").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("c2").setTypeName(Types.INTEGER).create(),
      )
      .setUniqueConstraints(UniqueConstraint.editor().setUnquotedColumnNames("c1", "c2").create())
      .create();

    await (await functional.connection().createSchemaManager()).createTable(referencedTable);

    await testRenameColumn(functional, schemaManager, comparator, (editor) => {
      editor.addForeignKeyConstraint(
        ForeignKeyConstraint.editor()
          .setUnquotedName("fk_c1_c2")
          .setUnquotedReferencingColumnNames("c1", "c2")
          .setUnquotedReferencedTableName("rename_column_referenced")
          .setUnquotedReferencedColumnNames("c1", "c2")
          .create(),
      );
    });
  });
});

async function testRenameColumn(
  functional: ReturnType<typeof useFunctionalTestCase>,
  schemaManager: AbstractSchemaManager,
  comparator: Comparator,
  modifier: (editor: TableEditor) => void,
): Promise<void> {
  await functional.dropTableIfExists("rename_column");

  const editor = Table.editor()
    .setUnquotedName("rename_column")
    .setColumns(
      Column.editor().setUnquotedName("c1").setTypeName(Types.INTEGER).create(),
      Column.editor().setUnquotedName("c2").setTypeName(Types.INTEGER).create(),
    );

  modifier(editor);

  const table = editor.create();
  table.renameColumn("c1", "c1a");

  await (await functional.connection().createSchemaManager()).createTable(table);

  const onlineTable = await schemaManager.introspectTableByUnquotedName("rename_column");
  const diff = comparator.compareTables(table, onlineTable);

  expect(diff).not.toBeNull();
  expect(diff?.isEmpty()).toBe(true);
}
