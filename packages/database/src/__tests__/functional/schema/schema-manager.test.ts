import { describe, expect, it } from "vitest";

import { SQLitePlatform } from "../../../platforms/sqlite-platform";
import { Column } from "../../../schema/column";
import { ForeignKeyConstraint } from "../../../schema/foreign-key-constraint";
import { Index } from "../../../schema/index";
import { IndexType } from "../../../schema/index/index-type";
import { Identifier } from "../../../schema/name/identifier";
import { OptionallyQualifiedName } from "../../../schema/name/optionally-qualified-name";
import { UnqualifiedName } from "../../../schema/name/unqualified-name";
import { UnquotedIdentifierFolding } from "../../../schema/name/unquoted-identifier-folding";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/SchemaManagerTest", () => {
  const functional = useFunctionalTestCase();

  for (const foreignTableName of emptyDiffForeignTableNameProvider()) {
    it(`empty diff regardless of foreign table quotes (${foreignTableName.toString()})`, async ({
      skip,
    }) => {
      if (!functional.connection().getDatabasePlatform().supportsSchemas()) {
        skip();
      }

      await dropAndCreateSchema(functional, UnqualifiedName.unquoted("other_schema"));

      const tableForeign = Table.editor()
        .setName(foreignTableName.toString())
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create();

      await functional.dropAndCreateTable(tableForeign);

      const tableTo = Table.editor()
        .setUnquotedName("other_table", "other_schema")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
          Column.editor().setUnquotedName("user_id").setTypeName(Types.INTEGER).create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .setForeignKeyConstraints(
          ForeignKeyConstraint.editor()
            .setUnquotedReferencingColumnNames("user_id")
            .setReferencedTableName(foreignTableName)
            .setUnquotedReferencedColumnNames("id")
            .setUnquotedName("fk_user_id")
            .create(),
        )
        .create();

      await functional.dropAndCreateTable(tableTo);

      const schemaManager = await functional.connection().createSchemaManager();
      const schemaFrom = await schemaManager.introspectSchema();
      const tableFrom = schemaFrom.getTable("other_schema.other_table");

      const diff = schemaManager.createComparator().compareTables(tableFrom, tableTo);
      expect(diff).not.toBeNull();
      expect(diff?.isEmpty()).toBe(true);
    });
  }

  for (const tableName of dropIndexInAnotherSchemaProvider()) {
    it(`drop index in another schema (${tableName.toString()})`, async ({ skip }) => {
      if (!functional.connection().getDatabasePlatform().supportsSchemas()) {
        skip();
      }

      await dropAndCreateSchema(functional, UnqualifiedName.unquoted("other_schema"));
      await dropAndCreateSchema(functional, UnqualifiedName.quoted("case"));

      const tableFrom = Table.editor()
        .setName(tableName.toString())
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
          Column.editor().setUnquotedName("name").setTypeName(Types.STRING).setLength(32).create(),
        )
        .setIndexes(
          Index.editor()
            .setUnquotedName("some_table_name_unique_index")
            .setUnquotedColumnNames("name")
            .setType(IndexType.UNIQUE)
            .create(),
        )
        .create();

      await functional.dropAndCreateTable(tableFrom);

      const tableTo = tableFrom
        .edit()
        .dropIndexByUnquotedName("some_table_name_unique_index")
        .create();
      const schemaManager = await functional.connection().createSchemaManager();
      const diff = schemaManager.createComparator().compareTables(tableFrom, tableTo);

      expect(diff).not.toBeNull();
      expect(diff?.isEmpty()).toBe(false);
      if (diff === null) {
        return;
      }

      await schemaManager.alterTable(diff);
      const tableFinal = await schemaManager.introspectTable(tableName.toString());
      expect(tableFinal.getIndexes()).toHaveLength(0);
    });
  }

  for (const autoincrement of [false, true]) {
    it(`autoincrement column introspection (${autoincrement ? "enabled" : "disabled"})`, async ({
      skip,
    }) => {
      const platform = functional.connection().getDatabasePlatform();
      if (!platform.supportsIdentityColumns()) {
        skip();
      }

      if (!autoincrement && platform instanceof SQLitePlatform) {
        skip();
      }

      const table = Table.editor()
        .setUnquotedName("test_autoincrement")
        .setColumns(
          Column.editor()
            .setUnquotedName("id")
            .setTypeName(Types.INTEGER)
            .setAutoincrement(autoincrement)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create();

      await functional.dropAndCreateTable(table);

      const introspected = await (
        await functional.connection().createSchemaManager()
      ).introspectTableByUnquotedName("test_autoincrement");
      expect(introspected.getColumn("id").getAutoincrement()).toBe(autoincrement);
    });
  }

  for (const autoincrement of [false, true]) {
    it(`autoincrement in composite primary key introspection (${autoincrement ? "enabled" : "disabled"})`, async ({
      skip,
    }) => {
      const platform = functional.connection().getDatabasePlatform();
      if (!platform.supportsIdentityColumns()) {
        skip();
      }

      if (autoincrement && platform instanceof SQLitePlatform) {
        skip();
      }

      const table = Table.editor()
        .setUnquotedName("test_autoincrement")
        .setColumns(
          Column.editor()
            .setUnquotedName("id1")
            .setTypeName(Types.INTEGER)
            .setAutoincrement(autoincrement)
            .create(),
          Column.editor().setUnquotedName("id2").setTypeName(Types.INTEGER).create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id1", "id2").create(),
        )
        .create();

      await functional.dropAndCreateTable(table);

      const introspected = await (
        await functional.connection().createSchemaManager()
      ).introspectTableByUnquotedName("test_autoincrement");
      expect(introspected.getColumn("id1").getAutoincrement()).toBe(autoincrement);
      expect(introspected.getColumn("id2").getAutoincrement()).toBe(false);
    });
  }

  for (const quoted of [false, true]) {
    it(`introspects table with dot in name (${quoted ? "quoted lookup" : "unquoted lookup"})`, async ({
      skip,
    }) => {
      const connection = functional.connection();
      const platform = connection.getDatabasePlatform();

      if (platform.supportsSchemas()) {
        skip();
      }

      const name = "example.com";
      const normalizedName = UnquotedIdentifierFolding.foldUnquotedIdentifier(
        platform.getUnquotedIdentifierFolding(),
        name,
      );
      const quotedName = connection.quoteSingleIdentifier(normalizedName);
      const sql = `CREATE TABLE ${quotedName} (s VARCHAR(16))`;

      await functional.dropTableIfExists(quotedName);
      await connection.executeStatement(sql);

      const table = await (await connection.createSchemaManager()).introspectTable(
        quoted ? quotedName : name,
      );

      expect(table.getColumns()).toHaveLength(1);
    });
  }

  it("introspects table with invalid name", async () => {
    const table = Table.editor()
      .setQuotedName("example")
      .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
      .create();

    await functional.dropAndCreateTable(table);

    const introspected = await (
      await functional.connection().createSchemaManager()
    ).introspectTable('"example');
    expect(introspected.getColumns()).toHaveLength(1);
  });
});

function emptyDiffForeignTableNameProvider(): OptionallyQualifiedName[] {
  return [
    OptionallyQualifiedName.unquoted("user", "other_schema"),
    new OptionallyQualifiedName(Identifier.quoted("user"), Identifier.unquoted("other_schema")),
    OptionallyQualifiedName.quoted("user", "other_schema"),
  ];
}

function dropIndexInAnotherSchemaProvider(): OptionallyQualifiedName[] {
  return [
    OptionallyQualifiedName.unquoted("some_table"),
    OptionallyQualifiedName.unquoted("some_table", "other_schema"),
    new OptionallyQualifiedName(
      Identifier.unquoted("some_table"),
      Identifier.quoted("other_schema"),
    ),
    OptionallyQualifiedName.unquoted("some_table", "case"),
  ];
}

async function dropAndCreateSchema(
  functional: ReturnType<typeof useFunctionalTestCase>,
  schemaName: UnqualifiedName,
): Promise<void> {
  await functional.dropSchemaIfExists(schemaName);

  const connection = functional.connection();
  const platform = connection.getDatabasePlatform();
  await connection.executeStatement(platform.getCreateSchemaSQL(schemaName.toSQL(platform)));
}
