import { describe, expect, it } from "vitest";

import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { Column } from "../../../schema/column";
import { Index } from "../../../schema/index";
import { IndexType } from "../../../schema/index/index-type";
import { IndexedColumn } from "../../../schema/index/indexed-column";
import { UnqualifiedName } from "../../../schema/name/unqualified-name";
import { Table } from "../../../schema/table";
import { JsonType } from "../../../types/json-type";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/MySQLSchemaManagerTest", () => {
  const functional = useFunctionalTestCase();

  it("fulltext index", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      skip();
    }

    const index = Index.editor()
      .setUnquotedName("f_index")
      .setType(IndexType.FULLTEXT)
      .setUnquotedColumnNames("text")
      .create();

    const table = Table.editor()
      .setUnquotedName("fulltext_index")
      .setColumns(Column.editor().setUnquotedName("text").setTypeName(Types.TEXT).create())
      .setIndexes(index)
      .setOptions({ engine: "MyISAM" })
      .create();

    await functional.dropAndCreateTable(table);
    const indexes = await (
      await connection.createSchemaManager()
    ).introspectTableIndexesByUnquotedName("fulltext_index");

    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.getColumns()).toEqual(["text"]);
    expect(indexes[0]?.hasFlag("fulltext")).toBe(true);
    expect(indexes[0]?.getType()).toBe(IndexType.FULLTEXT);
  });

  it("index with length", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      skip();
    }

    const index = Index.editor()
      .setUnquotedName("text_index")
      .addColumn(new IndexedColumn(UnqualifiedName.unquoted("text"), 128))
      .create();

    const table = Table.editor()
      .setUnquotedName("index_length")
      .setColumns(
        Column.editor().setUnquotedName("text").setTypeName(Types.STRING).setLength(255).create(),
      )
      .setIndexes(index)
      .create();

    await functional.dropAndCreateTable(table);
    const indexes = await (
      await connection.createSchemaManager()
    ).introspectTableIndexesByUnquotedName("index_length");

    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.getColumns()).toEqual(["text"]);
    expect(indexes[0]?.getIndexedColumns()[0]?.getLength()).toBe(128);
  });

  it("json column type", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("test_mysql_json")
      .setColumns(Column.editor().setUnquotedName("col_json").setTypeName(Types.JSON).create())
      .create();

    await functional.dropAndCreateTable(table);
    const [column] = await (
      await connection.createSchemaManager()
    ).introspectTableColumnsByUnquotedName("test_mysql_json");

    expect(column).toBeDefined();
    if (column === undefined) {
      return;
    }

    expect(column.getType()).toBeInstanceOf(JsonType);
  });
});
