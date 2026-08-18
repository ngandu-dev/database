import { describe, expect, it } from "vitest";

import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import type { AbstractPlatform } from "../../../platforms/abstract-platform";
import { DB2Platform } from "../../../platforms/db2-platform";
import { OraclePlatform } from "../../../platforms/oracle-platform";
import { SQLitePlatform } from "../../../platforms/sqlite-platform";
import { SQLServerPlatform } from "../../../platforms/sqlserver-platform";
import { Column } from "../../../schema/column";
import { ComparatorConfig } from "../../../schema/comparator-config";
import { ForeignKeyConstraint } from "../../../schema/foreign-key-constraint";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import type { TableEditor } from "../../../schema/table-editor";
import { UniqueConstraint } from "../../../schema/unique-constraint";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/AlterTableTest", () => {
  const functional = useFunctionalTestCase();

  it("adds primary key on existing column", async ({ skip }) => {
    if (functional.connection().getDatabasePlatform() instanceof SQLitePlatform) {
      // SQLite enforces autoincrement behavior for integer PKs in this flow.
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("alter_pk")
      .setColumns(
        Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("val").setTypeName(Types.INTEGER).create(),
      )
      .create();

    await testMigration(functional, table, (editor) => {
      editor.addPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
      );
    });
  });

  it("adds primary key on new autoincrement column", async ({ skip }) => {
    if (functional.connection().getDatabasePlatform() instanceof DB2Platform) {
      // DB2 LUW does not support adding identity columns to an existing table.
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("alter_pk")
      .setColumns(Column.editor().setUnquotedName("val").setTypeName(Types.INTEGER).create())
      .create();

    await testMigration(functional, table, (editor) => {
      editor
        .addColumn(
          Column.editor()
            .setUnquotedName("id")
            .setTypeName(Types.INTEGER)
            .setAutoincrement(true)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        );
    });
  });

  it("alters primary key from autoincrement to non-autoincrement column", async ({ skip }) => {
    const platform = functional.connection().getDatabasePlatform();

    if (platform instanceof AbstractMySQLPlatform) {
      // Datazen/Doctrine parity: this migration should be rejected on MySQL-family platforms.
      skip();
    }

    if (platform instanceof SQLitePlatform) {
      skip();
    }

    if (!isDroppingPrimaryKeyConstraintSupported(platform)) {
      // Datazen/Doctrine parity: not implemented on this platform.
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("alter_pk")
      .setColumns(
        Column.editor()
          .setUnquotedName("id1")
          .setTypeName(Types.INTEGER)
          .setAutoincrement(true)
          .create(),
        Column.editor().setUnquotedName("id2").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id1").create())
      .create();

    await testMigration(functional, table, (editor) => {
      editor
        .dropPrimaryKeyConstraint()
        .addPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id2").create(),
        );
    });
  });

  it("drops primary key with autoincrement column", async ({ skip }) => {
    const platform = functional.connection().getDatabasePlatform();

    if (platform instanceof AbstractMySQLPlatform) {
      // Datazen/Doctrine parity: this migration should be rejected on MySQL-family platforms.
      skip();
    }

    if (platform instanceof SQLitePlatform) {
      skip();
    }

    if (!isDroppingPrimaryKeyConstraintSupported(platform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("alter_pk")
      .setColumns(
        Column.editor()
          .setUnquotedName("id1")
          .setTypeName(Types.INTEGER)
          .setAutoincrement(true)
          .create(),
        Column.editor().setUnquotedName("id2").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("id1", "id2").create(),
      )
      .create();

    await testMigration(functional, table, (editor) => {
      editor.dropPrimaryKeyConstraint();
    });
  });

  it("drops non-autoincrement column from composite primary key with autoincrement column", async ({
    skip,
  }) => {
    const platform = functional.connection().getDatabasePlatform();

    if (platform instanceof SQLitePlatform) {
      skip();
    }

    if (!isDroppingPrimaryKeyConstraintSupported(platform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("alter_pk")
      .setColumns(
        Column.editor()
          .setUnquotedName("id1")
          .setTypeName(Types.INTEGER)
          .setAutoincrement(true)
          .create(),
        Column.editor().setUnquotedName("id2").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("id1", "id2").create(),
      )
      .create();

    await testMigration(
      functional,
      table,
      (editor) => {
        editor
          .dropPrimaryKeyConstraint()
          .addPrimaryKeyConstraint(
            PrimaryKeyConstraint.editor().setUnquotedColumnNames("id1").create(),
          );
      },
      new ComparatorConfig().withReportModifiedIndexes(false),
    );
  });

  it("adds non-autoincrement column to primary key with autoincrement column", async ({ skip }) => {
    const platform = functional.connection().getDatabasePlatform();

    if (platform instanceof SQLitePlatform) {
      skip();
    }

    if (!isDroppingPrimaryKeyConstraintSupported(platform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("alter_pk")
      .setColumns(
        Column.editor()
          .setUnquotedName("id1")
          .setTypeName(Types.INTEGER)
          .setAutoincrement(true)
          .create(),
        Column.editor().setUnquotedName("id2").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id1").create())
      .create();

    await testMigration(
      functional,
      table,
      (editor) => {
        editor
          .dropPrimaryKeyConstraint()
          .addPrimaryKeyConstraint(
            PrimaryKeyConstraint.editor().setUnquotedColumnNames("id1", "id2").create(),
          );
      },
      new ComparatorConfig().withReportModifiedIndexes(false),
    );
  });

  it("adds new column to primary key", async ({ skip }) => {
    if (!isDroppingPrimaryKeyConstraintSupported(functional.connection().getDatabasePlatform())) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("alter_pk")
      .setColumns(Column.editor().setUnquotedName("id1").setTypeName(Types.INTEGER).create())
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id1").create())
      .create();

    await testMigration(functional, table, (editor) => {
      editor
        .addColumn(Column.editor().setUnquotedName("id2").setTypeName(Types.INTEGER).create())
        .dropPrimaryKeyConstraint()
        .addPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id1", "id2").create(),
        );
    });
  });

  it("replaces foreign key constraint", async () => {
    const articles = Table.editor()
      .setUnquotedName("articles")
      .setColumns(
        Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("sku").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .setUniqueConstraints(UniqueConstraint.editor().setUnquotedColumnNames("sku").create())
      .create();

    const orders = Table.editor()
      .setUnquotedName("orders")
      .setColumns(
        Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("article_id").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("article_sku").setTypeName(Types.INTEGER).create(),
      )
      .setForeignKeyConstraints(
        ForeignKeyConstraint.editor()
          .setUnquotedName("articles_fk")
          .setUnquotedReferencingColumnNames("article_id")
          .setUnquotedReferencedTableName("articles")
          .setUnquotedReferencedColumnNames("id")
          .create(),
      )
      .create();

    await functional.dropTableIfExists("orders");
    await functional.dropTableIfExists("articles");

    const schemaManager = await functional.connection().createSchemaManager();
    await schemaManager.createTable(articles);

    await testMigration(functional, orders, (editor) => {
      editor
        .dropForeignKeyConstraintByUnquotedName("articles_fk")
        .addForeignKeyConstraint(
          ForeignKeyConstraint.editor()
            .setUnquotedName("articles_fk")
            .setUnquotedReferencingColumnNames("article_sku")
            .setUnquotedReferencedTableName("articles")
            .setUnquotedReferencedColumnNames("sku")
            .create(),
        );
    });
  });
});

async function testMigration(
  functional: ReturnType<typeof useFunctionalTestCase>,
  oldTable: Table,
  migration: (editor: TableEditor) => void,
  config?: ComparatorConfig,
): Promise<void> {
  await functional.dropAndCreateTable(oldTable);

  const editor = oldTable.edit();
  migration(editor);
  const newTable = editor.create();

  const schemaManager = await functional.connection().createSchemaManager();
  const diff = schemaManager.createComparator(config).compareTables(oldTable, newTable);

  expect(diff).not.toBeNull();
  if (diff === null) {
    return;
  }

  expect(diff.isEmpty()).toBe(false);
  await schemaManager.alterTable(diff);

  const introspectedTable = await schemaManager.introspectTable(
    newTable.getObjectName().toString(),
  );
  const finalDiff = schemaManager.createComparator().compareTables(newTable, introspectedTable);

  expect(finalDiff).not.toBeNull();
  expect(finalDiff?.isEmpty()).toBe(true);
}

function isDroppingPrimaryKeyConstraintSupported(platform: AbstractPlatform): boolean {
  return !(
    platform instanceof DB2Platform ||
    platform instanceof OraclePlatform ||
    platform instanceof SQLServerPlatform
  );
}
