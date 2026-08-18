import { beforeEach, describe, expect, it } from "vitest";

import { ColumnValuesRequired } from "../../../exception/invalid-column-type/column-values-required";
import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { Column } from "../../../schema/column";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { EnumType } from "../../../types/enum-type";
import { Type } from "../../../types/type";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Types/EnumTypeTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropTableIfExists("my_enum_table");
  });

  it("introspect enum", async ({ skip }) => {
    const connection = functional.connection();

    if (!(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      skip();
    }

    await connection.executeStatement(`
      CREATE TABLE my_enum_table (
        id BIGINT NOT NULL PRIMARY KEY,
        suit ENUM('hearts', 'diamonds', 'clubs', 'spades') NOT NULL DEFAULT 'hearts'
      )
    `);

    const table = await (await connection.createSchemaManager()).introspectTableByUnquotedName(
      "my_enum_table",
    );

    expect(table.getColumns()).toHaveLength(2);
    expect(table.hasColumn("suit")).toBe(true);
    expect(table.getColumn("suit").getType()).toBeInstanceOf(EnumType);
    expect(table.getColumn("suit").getValues()).toEqual(["hearts", "diamonds", "clubs", "spades"]);
    expect(table.getColumn("suit").getDefault()).toBe("hearts");
  });

  it("deploy enum", async ({ skip }) => {
    const connection = functional.connection();

    if (!(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      // Doctrine preserves enum type identity cross-platform via comment hints. Datazen's generic
      //enum fallback is deployed everywhere, but enum-vs-string introspection hints are not yet.
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("my_enum_table")
      .setColumns(
        Column.editor().setUnquotedName("id").setTypeName(Types.BIGINT).create(),
        Column.editor()
          .setUnquotedName("suit")
          .setTypeName(Types.ENUM)
          .setValues(["hearts", "diamonds", "clubs", "spades"])
          .setDefaultValue("hearts")
          .create(),
      )
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .create();

    await functional.dropAndCreateTable(table);

    const schemaManager = await connection.createSchemaManager();
    const introspectedTable = await schemaManager.introspectTableByUnquotedName("my_enum_table");

    const diff = schemaManager.createComparator().compareTables(table, introspectedTable);
    expect(diff === null || diff.isEmpty()).toBe(true);

    await connection.insert("my_enum_table", { id: 1, suit: "hearts" }, { suit: Types.ENUM });
    await connection.insert(
      "my_enum_table",
      { id: 2, suit: "diamonds" },
      { suit: Type.getType(Types.ENUM) },
    );

    const rows = await connection.fetchAllNumeric(
      "SELECT id, suit FROM my_enum_table ORDER BY id ASC",
    );
    expect(rows.map(([id, suit]) => [Number(id), suit])).toEqual([
      [1, "hearts"],
      [2, "diamonds"],
    ]);
  });

  it("deploy empty enum", async () => {
    const schemaManager = await functional.connection().createSchemaManager();
    const table = Table.editor()
      .setUnquotedName("my_enum_table")
      .setColumns(Column.editor().setUnquotedName("suit").setTypeName(Types.ENUM).create())
      .create();

    await expect(schemaManager.createTable(table)).rejects.toBeInstanceOf(ColumnValuesRequired);
  });

  for (const [definition, expectedValues] of [
    ['ENUM("a", "b", "c")', ["a", "b", "c"]],
    ['ENUM("", "a", "b", "c")', ["", "a", "b", "c"]],
    ['ENUM("a", "", "b", "c")', ["a", "", "b", "c"]],
    ['ENUM("a", "b", "c", "")', ["a", "b", "c", ""]],
    ['ENUM("a b", "c d", "e f")', ["a b", "c d", "e f"]],
    ['ENUM("a\'b", "c\'d", "e\'f")', ["a'b", "c'd", "e'f"]],
    ['ENUM("a,b", "c,d", "e,f")', ["a,b", "c,d", "e,f"]],
    ['ENUM("(a)", "(b)", "(c)")', ["(a)", "(b)", "(c)"]],
    ['ENUM("(a,b)", "(c,d)", "(e,f)")', ["(a,b)", "(c,d)", "(e,f)"]],
    ['ENUM("(a\'b)", "(c\'d)", "(e\'f)")', ["(a'b)", "(c'd)", "(e'f)"]],
  ] as const) {
    it(`introspect enum values ${definition}`, async ({ skip }) => {
      const connection = functional.connection();

      if (!(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
        skip();
      }

      await connection.executeStatement(`
        CREATE TABLE my_enum_table (
          id BIGINT NOT NULL PRIMARY KEY,
          my_enum ${definition} DEFAULT NULL
        )
      `);

      const table = await (await connection.createSchemaManager()).introspectTableByUnquotedName(
        "my_enum_table",
      );

      expect(table.getColumn("my_enum").getType()).toBeInstanceOf(EnumType);
      expect(table.getColumn("my_enum").getValues()).toEqual(expectedValues);
      expect(table.getColumn("my_enum").getDefault()).toBeNull();
    });
  }
});
