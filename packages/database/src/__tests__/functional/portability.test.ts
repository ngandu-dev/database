import { afterEach, describe, expect, it } from "vitest";

import { ColumnCase } from "../../column-case";
import { Configuration } from "../../configuration";
import { Connection as DatazenConnection } from "../../connection";
import { Connection as PortabilityConnection } from "../../portability/connection";
import { Middleware as PortabilityMiddleware } from "../../portability/middleware";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { createFunctionalConnectionWithConfiguration } from "./_helpers/functional-connection-factory";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/PortabilityTest", () => {
  const functional = useFunctionalTestCase();
  const extraConnections: DatazenConnection[] = [];

  afterEach(async () => {
    while (extraConnections.length > 0) {
      await extraConnections.pop()?.close();
    }
  });

  it("supports full fetch portability mode", async () => {
    const connection = await connectWithPortability(
      functional,
      extraConnections,
      PortabilityConnection.PORTABILITY_ALL,
      ColumnCase.LOWER,
    );
    await createPortabilityTable(connection);

    const rows = await connection.fetchAllAssociative("SELECT * FROM portability_table");
    assertFetchResultRows(rows);

    let result = await connection.executeQuery("SELECT * FROM portability_table");
    for (let row = result.fetchAssociative(); row !== undefined; row = result.fetchAssociative()) {
      assertFetchResultRow(row);
    }

    result = await (await connection.prepare("SELECT * FROM portability_table")).executeQuery();
    for (let row = result.fetchAssociative(); row !== undefined; row = result.fetchAssociative()) {
      assertFetchResultRow(row);
    }
  });

  it.each([
    [ColumnCase.LOWER, ["test_int", "test_string", "test_null"]],
    [ColumnCase.UPPER, ["TEST_INT", "TEST_STRING", "TEST_NULL"]],
  ] as const)("supports case conversion (%s)", async (columnCase, expectedColumns) => {
    const connection = await connectWithPortability(
      functional,
      extraConnections,
      PortabilityConnection.PORTABILITY_FIX_CASE,
      columnCase,
    );
    await createPortabilityTable(connection);

    const row = await connection.fetchAssociative("SELECT * FROM portability_table");
    expect(row).toBeDefined();
    if (row === undefined) {
      return;
    }

    expect(Object.keys(row)).toEqual(expectedColumns);
  });

  it.each([
    [ColumnCase.LOWER, ["test_int", "test_string", "test_null"]],
    [ColumnCase.UPPER, ["TEST_INT", "TEST_STRING", "TEST_NULL"]],
  ] as const)("converts result metadata column names (%s)", async (columnCase, expectedColumns) => {
    const connection = await connectWithPortability(
      functional,
      extraConnections,
      PortabilityConnection.PORTABILITY_FIX_CASE,
      columnCase,
    );
    await createPortabilityTable(connection);

    const result = await connection.executeQuery("SELECT * FROM portability_table");
    expect(expectedColumns.map((_, i) => result.getColumnName(i))).toEqual(expectedColumns);
  });

  it.each([
    ["Test_Int", [1, 2]],
    ["Test_String", ["foo", "foo"]],
  ] as const)("supports fetchFirstColumn portability conversion for %s", async (column, expected) => {
    const connection = await connectWithPortability(
      functional,
      extraConnections,
      PortabilityConnection.PORTABILITY_RTRIM,
      null,
    );
    await createPortabilityTable(connection);

    const result = await connection.executeQuery(`SELECT ${column} FROM portability_table`);
    expect(result.fetchFirstColumn()).toEqual(expected);
  });

  it("supports empty-to-null conversion", async () => {
    const connection = await connectWithPortability(
      functional,
      extraConnections,
      PortabilityConnection.PORTABILITY_EMPTY_TO_NULL,
      null,
    );
    await createPortabilityTable(connection);

    expect(await connection.fetchFirstColumn("SELECT Test_Null FROM portability_table")).toEqual([
      null,
      null,
    ]);
  });

  it("returns database name when available", async ({ skip }) => {
    const connection = await connectWithPortability(
      functional,
      extraConnections,
      PortabilityConnection.PORTABILITY_EMPTY_TO_NULL,
      ColumnCase.LOWER,
    );

    const database = connection.getDatabase();
    if (database === null) {
      skip();
    }

    expect(database).not.toBeNull();
  });
});

async function connectWithPortability(
  functional: ReturnType<typeof useFunctionalTestCase>,
  extraConnections: DatazenConnection[],
  mode: number,
  columnCase: ColumnCase | null,
): Promise<DatazenConnection> {
  const baseConfiguration = functional.connection().getConfiguration();
  const configuration = new Configuration({
    autoCommit: baseConfiguration.getAutoCommit(),
    disableTypeComments: baseConfiguration.getDisableTypeComments(),
    middlewares: [
      ...baseConfiguration.getMiddlewares(),
      new PortabilityMiddleware(mode, columnCase),
    ],
    schemaAssetsFilter: baseConfiguration.getSchemaAssetsFilter(),
    schemaManagerFactory: baseConfiguration.getSchemaManagerFactory() ?? undefined,
  });

  const connection = await createFunctionalConnectionWithConfiguration(configuration);
  extraConnections.push(connection);
  return connection;
}

async function createPortabilityTable(connection: DatazenConnection): Promise<void> {
  const table = Table.editor()
    .setUnquotedName("portability_table")
    .setColumns(
      Column.editor().setUnquotedName("Test_Int").setTypeName(Types.INTEGER).create(),
      Column.editor()
        .setUnquotedName("Test_String")
        .setTypeName(Types.STRING)
        .setFixed(true)
        .setLength(8)
        .create(),
      Column.editor()
        .setUnquotedName("Test_Null")
        .setTypeName(Types.STRING)
        .setLength(1)
        .setNotNull(false)
        .create(),
    )
    .setPrimaryKeyConstraint(
      PrimaryKeyConstraint.editor().setUnquotedColumnNames("Test_Int").create(),
    )
    .create();

  const schemaManager = await connection.createSchemaManager();
  try {
    await schemaManager.dropTable("portability_table");
  } catch {
    // best effort setup cleanup
  }
  await schemaManager.createTable(table);

  await connection.insert("portability_table", { Test_Int: 1, Test_String: "foo", Test_Null: "" });
  await connection.insert("portability_table", {
    Test_Int: 2,
    Test_String: "foo  ",
    Test_Null: null,
  });
}

function assertFetchResultRows(rows: Array<Record<string, unknown>>): void {
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    assertFetchResultRow(row);
  }
}

function assertFetchResultRow(row: Record<string, unknown>): void {
  expect([1, 2]).toContain(Number(row.test_int));
  expect(row).toHaveProperty("test_string");
  expect(String(row.test_string).length).toBe(3);
  expect(row.test_null).toBeNull();
  expect(Object.hasOwn(row, "0")).toBe(false);
}
