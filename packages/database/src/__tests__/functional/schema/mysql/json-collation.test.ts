import { describe, expect, it } from "vitest";

import { MariaDBPlatform } from "../../../../platforms/mariadb-platform";
import { Column } from "../../../../schema/column";
import type { ColumnEditor } from "../../../../schema/column-editor";
import { Table } from "../../../../schema/table";
import { Types } from "../../../../types/types";
import { useFunctionalTestCase } from "../../_helpers/functional-test-case";

describe("Functional/Schema/MySQL/JsonCollationTest", () => {
  const functional = useFunctionalTestCase();

  for (const table of jsonTableProvider()) {
    it(`json column comparison (${table.name})`, async ({ skip }) => {
      const connection = functional.connection();
      if (!(connection.getDatabasePlatform() instanceof MariaDBPlatform)) {
        skip();
      }

      const schemaManager = await connection.createSchemaManager();
      const comparator = schemaManager.createComparator();

      const originalTable = createJsonTable(table);
      await functional.dropAndCreateTable(originalTable);

      const onlineTable = await schemaManager.introspectTableByUnquotedName(table.name);
      const originalDiff = comparator.compareTables(originalTable, onlineTable);
      expect(originalDiff === null || originalDiff.isEmpty()).toBe(true);

      const modifiedTable = originalTable
        .edit()
        .modifyColumnByUnquotedName("json_1", (editor: ColumnEditor) => {
          editor.setCharset("utf8").setCollation("utf8_general_ci");
        })
        .create();

      const modifiedToOnline = comparator.compareTables(modifiedTable, onlineTable);
      expect(modifiedToOnline === null || modifiedToOnline.isEmpty()).toBe(true);

      const modifiedToOriginal = comparator.compareTables(modifiedTable, originalTable);
      expect(modifiedToOriginal === null || modifiedToOriginal.isEmpty()).toBe(true);
    });
  }
});

type JsonColumnShape = {
  name: string;
  charset?: string;
  collation?: string;
};

type JsonTableShape = {
  name: string;
  columns: JsonColumnShape[];
  charset?: string;
  collation?: string;
};

function jsonTableProvider(): JsonTableShape[] {
  return [
    {
      name: "mariadb_json_column_comparator_test",
      columns: [
        { name: "json_1", charset: "latin1", collation: "latin1_swedish_ci" },
        { name: "json_2", charset: "utf8", collation: "utf8_general_ci" },
        { name: "json_3" },
      ],
      charset: "latin1",
      collation: "latin1_swedish_ci",
    },
    {
      name: "mariadb_json_column_comparator_test",
      columns: [
        { name: "json_1", charset: "latin1", collation: "latin1_swedish_ci" },
        { name: "json_2", charset: "utf8", collation: "utf8_general_ci" },
        { name: "json_3" },
      ],
    },
    {
      name: "mariadb_json_column_comparator_test",
      columns: [
        { name: "json_1", charset: "utf8mb4", collation: "utf8mb4_bin" },
        { name: "json_2", charset: "utf8mb4", collation: "utf8mb4_bin" },
        { name: "json_3", charset: "utf8mb4", collation: "utf8mb4_general_ci" },
      ],
    },
    {
      name: "mariadb_json_column_comparator_test",
      columns: [{ name: "json_1" }, { name: "json_2" }, { name: "json_3" }],
    },
  ];
}

function createJsonTable(shape: JsonTableShape): Table {
  const tableEditor = Table.editor().setUnquotedName(shape.name);

  for (const column of shape.columns) {
    tableEditor.addColumn(
      Column.editor()
        .setUnquotedName(column.name)
        .setTypeName(Types.JSON)
        .setCharset(column.charset ?? null)
        .setCollation(column.collation ?? null)
        .create(),
    );
  }

  const options: Record<string, string> = {};
  if (shape.charset !== undefined) {
    options.charset = shape.charset;
  }
  if (shape.collation !== undefined) {
    options.collation = shape.collation;
  }

  if (Object.keys(options).length > 0) {
    tableEditor.setOptions(options);
  }

  return tableEditor.create();
}
