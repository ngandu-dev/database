import { describe, expect, it } from "vitest";

import { PostgreSQLPlatform } from "../../../../platforms/postgresql-platform";
import { Column } from "../../../../schema/column";
import type { ColumnEditor } from "../../../../schema/column-editor";
import { Table } from "../../../../schema/table";
import { Types } from "../../../../types/types";
import { useFunctionalTestCase } from "../../_helpers/functional-test-case";

describe("Functional/Schema/PostgreSQL/ComparatorTest", () => {
  const functional = useFunctionalTestCase();

  it("compare binary and blob", async ({ skip }) => {
    if (!(functional.connection().getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      skip();
    }

    await testColumnModification(
      functional,
      (editor) => {
        editor.setTypeName(Types.BINARY);
      },
      (editor) => {
        editor.setTypeName(Types.BLOB);
      },
    );
  });

  it("compare binary and varbinary", async ({ skip }) => {
    if (!(functional.connection().getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      skip();
    }

    await testColumnModification(
      functional,
      (editor) => {
        editor.setTypeName(Types.BINARY);
      },
      (editor) => {
        editor.setFixed(true);
      },
    );
  });

  it("compare binaries of different length", async ({ skip }) => {
    if (!(functional.connection().getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      skip();
    }

    await testColumnModification(
      functional,
      (editor) => {
        editor.setTypeName(Types.BINARY).setLength(16);
      },
      (editor) => {
        editor.setLength(32);
      },
    );
  });

  it("platform options changed column comparison", async ({ skip }) => {
    if (!(functional.connection().getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      skip();
    }

    const desiredTable = withJsonColumn("update_json_to_jsonb_table", true);
    const onlineTable = withJsonColumn("update_json_to_jsonb_table", false);

    const compareResult = (await functional.connection().createSchemaManager())
      .createComparator()
      .compareTables(onlineTable, desiredTable);

    expect(compareResult).not.toBeNull();
    if (compareResult === null) {
      return;
    }

    expect(compareResult.getChangedColumns()).toHaveLength(1);
    expect(compareResult.getModifiedColumns()).toHaveLength(1);

    const [changedColumn] = compareResult.getChangedColumns();
    expect(changedColumn).toBeDefined();
    if (changedColumn === undefined) {
      return;
    }

    expect(changedColumn.hasPlatformOptionsChanged()).toBe(true);
    expect(changedColumn.countChangedProperties()).toBe(1);
  });
});

async function testColumnModification(
  functional: ReturnType<typeof useFunctionalTestCase>,
  initializeColumn: (editor: ColumnEditor) => void,
  modifyColumn: (editor: ColumnEditor) => void,
): Promise<void> {
  const editor = Column.editor().setUnquotedName("id");
  initializeColumn(editor);

  const table = withColumn("comparator_test", editor);
  await functional.dropAndCreateTable(table);

  const desiredTable = table
    .edit()
    .modifyColumnByUnquotedName("id", (columnEditor) => {
      modifyColumn(columnEditor);
    })
    .create();

  await assertDiffEmpty(functional, desiredTable);
}

async function assertDiffEmpty(
  functional: ReturnType<typeof useFunctionalTestCase>,
  desiredTable: Table,
): Promise<void> {
  const schemaManager = await functional.connection().createSchemaManager();
  const comparator = schemaManager.createComparator();

  const actual = await schemaManager.introspectTable(desiredTable.getObjectName().toString());
  const actualToDesired = comparator.compareTables(actual, desiredTable);
  const desiredToActual = comparator.compareTables(desiredTable, actual);

  expect(actualToDesired === null || actualToDesired.isEmpty()).toBe(true);
  expect(desiredToActual === null || desiredToActual.isEmpty()).toBe(true);
}

function withColumn(name: string, column: ColumnEditor): Table {
  return Table.editor().setUnquotedName(name).setColumns(column.create()).create();
}

function withJsonColumn(name: string, jsonb: boolean): Table {
  const column = Column.editor().setUnquotedName("test").setTypeName(Types.JSON).create();
  if (jsonb) {
    column.setPlatformOption("jsonb", true);
  }

  return Table.editor().setUnquotedName(name).setColumns(column).create();
}
