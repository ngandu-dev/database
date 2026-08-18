import { describe, expect, it } from "vitest";

import { AbstractMySQLPlatform } from "../../../../platforms/abstract-mysql-platform";
import { MariaDBPlatform } from "../../../../platforms/mariadb-platform";
import { MySQL80Platform } from "../../../../platforms/mysql80-platform";
import { Column } from "../../../../schema/column";
import type { ColumnEditor } from "../../../../schema/column-editor";
import { Table } from "../../../../schema/table";
import { Types } from "../../../../types/types";
import { useFunctionalTestCase } from "../../_helpers/functional-test-case";

const LENGTH_LIMIT_TINYTEXT = 255;
const LENGTH_LIMIT_TEXT = 65535;
const LENGTH_LIMIT_MEDIUMTEXT = 16777215;
const LENGTH_LIMIT_TINYBLOB = 255;
const LENGTH_LIMIT_BLOB = 65535;
const LENGTH_LIMIT_MEDIUMBLOB = 16777215;

describe("Functional/Schema/MySQL/ComparatorTest", () => {
  const functional = useFunctionalTestCase();

  for (const [typeName, length] of lobColumnProvider()) {
    it(`lob length increment within limit (${typeName}, ${length})`, async () => {
      if (!(functional.connection().getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
        return;
      }

      const table = await createLobTable(functional, typeName, length - 1);
      await assertDiffEmpty(functional, setBlobLength(table, length));
    });

    it(`lob length increment over limit (${typeName}, ${length})`, async () => {
      if (!(functional.connection().getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
        return;
      }

      const table = await createLobTable(functional, typeName, length);
      await assertDiffNotEmpty(functional, setBlobLength(table, length + 1));
    });
  }

  it("explicit default collation", async () => {
    if (!(functional.connection().getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      return;
    }

    const table = (await createCollationTable(functional))
      .edit()
      .modifyColumnByUnquotedName("id", (editor: ColumnEditor) => {
        editor.setCollation("utf8mb4_general_ci");
      })
      .create();

    await assertDiffEmpty(functional, table);
  });

  it("change column charset and collation", async () => {
    if (!(functional.connection().getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      return;
    }

    const table = (await createCollationTable(functional))
      .edit()
      .modifyColumnByUnquotedName("id", (editor: ColumnEditor) => {
        editor.setCharset("latin1").setCollation("latin1_bin");
      })
      .create();

    await assertDiffNotEmpty(functional, table);
  });

  it("change column collation", async () => {
    if (!(functional.connection().getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      return;
    }

    const table = (await createCollationTable(functional))
      .edit()
      .modifyColumnByUnquotedName("id", (editor: ColumnEditor) => {
        editor.setCollation("utf8mb4_bin");
      })
      .create();

    await assertDiffNotEmpty(functional, table);
  });

  for (const [name, testCase] of Object.entries(tableAndColumnOptionsProvider())) {
    it(`table and column options: ${name}`, async () => {
      if (!(functional.connection().getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
        return;
      }

      const table = Table.editor()
        .setUnquotedName("comparator_test")
        .setColumns(
          Column.editor()
            .setUnquotedName("name")
            .setTypeName(Types.STRING)
            .setLength(32)
            .setCharset(testCase.columnCharset)
            .setCollation(testCase.columnCollation)
            .create(),
        )
        .setOptions(testCase.tableOptions)
        .create();

      await functional.dropAndCreateTable(table);
      await assertDiffEmpty(functional, table);
    });
  }

  it("simple array type non-change not detected", async () => {
    if (!(functional.connection().getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      return;
    }

    const table = Table.editor()
      .setUnquotedName("comparator_test")
      .setColumns(
        Column.editor()
          .setUnquotedName("simple_array_col")
          .setTypeName(Types.SIMPLE_ARRAY)
          .setLength(255)
          .create(),
      )
      .create();

    await functional.dropAndCreateTable(table);
    await assertDiffEmpty(functional, table);
  });

  it("mariadb native json upgrade detected", async () => {
    const platform = functional.connection().getDatabasePlatform();
    if (!(platform instanceof MariaDBPlatform) && !(platform instanceof MySQL80Platform)) {
      return;
    }

    const table = Table.editor()
      .setUnquotedName("mariadb_json_upgrade")
      .setColumns(Column.editor().setUnquotedName("json_col").setTypeName(Types.JSON).create())
      .create();

    await functional.dropAndCreateTable(table);

    await functional
      .connection()
      .executeStatement(
        "ALTER TABLE mariadb_json_upgrade CHANGE json_col json_col LONGTEXT NOT NULL COMMENT '(DC2Type:json)'",
      );

    await assertDiffNotEmpty(functional, table);
  });
});

function lobColumnProvider(): Array<[string, number]> {
  return [
    [Types.BLOB, LENGTH_LIMIT_TINYBLOB],
    [Types.BLOB, LENGTH_LIMIT_BLOB],
    [Types.BLOB, LENGTH_LIMIT_MEDIUMBLOB],
    [Types.TEXT, LENGTH_LIMIT_TINYTEXT],
    [Types.TEXT, LENGTH_LIMIT_TEXT],
    [Types.TEXT, LENGTH_LIMIT_MEDIUMTEXT],
  ];
}

async function createLobTable(
  functional: ReturnType<typeof useFunctionalTestCase>,
  typeName: string,
  length: number,
): Promise<Table> {
  const table = Table.editor()
    .setUnquotedName("comparator_test")
    .setColumns(
      Column.editor().setUnquotedName("lob").setTypeName(typeName).setLength(length).create(),
    )
    .create();

  await functional.dropAndCreateTable(table);
  return table;
}

function setBlobLength(table: Table, length: number): Table {
  return table
    .edit()
    .modifyColumnByUnquotedName("lob", (editor: ColumnEditor) => {
      editor.setLength(length);
    })
    .create();
}

async function createCollationTable(
  functional: ReturnType<typeof useFunctionalTestCase>,
): Promise<Table> {
  const table = Table.editor()
    .setUnquotedName("comparator_test")
    .setColumns(
      Column.editor().setUnquotedName("id").setTypeName(Types.STRING).setLength(32).create(),
    )
    .setOptions({
      charset: "utf8mb4",
      collation: "utf8mb4_general_ci",
    })
    .create();

  await functional.dropAndCreateTable(table);
  return table;
}

async function assertDiffEmpty(
  functional: ReturnType<typeof useFunctionalTestCase>,
  desiredTable: Table,
): Promise<void> {
  const schemaManager = await functional.connection().createSchemaManager();
  const comparator = schemaManager.createComparator();

  const actualToDesired = comparator.compareTables(
    await schemaManager.introspectTable(desiredTable.getObjectName().toString()),
    desiredTable,
  );
  const desiredToActual = comparator.compareTables(
    desiredTable,
    await schemaManager.introspectTable(desiredTable.getObjectName().toString()),
  );

  expect(actualToDesired === null || actualToDesired.isEmpty()).toBe(true);
  expect(desiredToActual === null || desiredToActual.isEmpty()).toBe(true);
}

async function assertDiffNotEmpty(
  functional: ReturnType<typeof useFunctionalTestCase>,
  desiredTable: Table,
): Promise<void> {
  const schemaManager = await functional.connection().createSchemaManager();
  const comparator = schemaManager.createComparator();
  const diff = comparator.compareTables(
    await schemaManager.introspectTable(desiredTable.getObjectName().toString()),
    desiredTable,
  );

  expect(diff).not.toBeNull();
  if (diff === null) {
    return;
  }

  expect(diff.isEmpty()).toBe(false);
  await schemaManager.alterTable(diff);

  await assertDiffEmpty(functional, desiredTable);
}

function tableAndColumnOptionsProvider(): Record<
  string,
  {
    tableOptions: Record<string, string>;
    columnCharset: string | null;
    columnCollation: string | null;
  }
> {
  return {
    "Column collation explicitly set to its table's default": {
      columnCharset: null,
      columnCollation: "utf8mb4_general_ci",
      tableOptions: {},
    },
    "Column charset implicitly set to a value matching its table's charset": {
      columnCharset: null,
      columnCollation: "utf8mb4_general_ci",
      tableOptions: {
        charset: "utf8mb4",
      },
    },
    "Column collation reset to the collation's default matching its table's charset": {
      columnCharset: "utf8mb4",
      columnCollation: null,
      tableOptions: {
        collation: "utf8mb4_unicode_ci",
      },
    },
  };
}
