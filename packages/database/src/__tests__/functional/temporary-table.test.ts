import { describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { AbstractPlatform } from "../../platforms/abstract-platform";
import { OraclePlatform } from "../../platforms/oracle-platform";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/TemporaryTableTest", () => {
  const functional = useFunctionalTestCase();

  it("dropping a temporary table does not auto commit a transaction", async ({ skip }) => {
    const connection = await functional.createConnection();
    const platform = connection.getDatabasePlatform();

    try {
      if (platform instanceof OraclePlatform) {
        skip();
      }

      const tempTableName = platform.getTemporaryTableName("my_temporary");
      const createTempTableSQL = buildCreateTemporaryTableSQL(platform);

      await connection.executeStatement(createTempTableSQL);
      await dropAndCreateTable(connection, createNonTemporaryTable());

      await connection.beginTransaction();
      await connection.insert("nontemporary", { id: 1 });
      await dropTemporaryTable(connection, "my_temporary");
      await connection.insert("nontemporary", { id: 2 });
      await connection.rollBack();

      expect(await connection.fetchAllAssociative("SELECT * FROM nontemporary")).toEqual([]);

      await safeDropTemporaryTable(connection, platform.getDropTemporaryTableSQL(tempTableName));
    } finally {
      await connection.close();
    }
  });

  it("creating a temporary table does not auto commit a transaction", async ({ skip }) => {
    const connection = await functional.createConnection();
    const platform = connection.getDatabasePlatform();

    try {
      if (platform instanceof OraclePlatform) {
        skip();
      }

      const tempTableName = platform.getTemporaryTableName("my_temporary");
      const createTempTableSQL = buildCreateTemporaryTableSQL(platform);

      await dropAndCreateTable(connection, createNonTemporaryTable());
      await connection.executeStatement(createTempTableSQL);

      await connection.beginTransaction();
      await connection.insert("nontemporary", { id: 1 });

      await dropTemporaryTable(connection, "my_temporary");
      await connection.executeStatement(createTempTableSQL);
      await connection.insert("nontemporary", { id: 2 });
      await connection.rollBack();

      await safeDropTemporaryTable(connection, platform.getDropTemporaryTableSQL(tempTableName));

      expect(await connection.fetchAllAssociative("SELECT * FROM nontemporary")).toEqual([]);
    } finally {
      await connection.close();
    }
  });
});

function buildCreateTemporaryTableSQL(platform: AbstractPlatform): string {
  const column = Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create();
  const tempTable = platform.getTemporaryTableName("my_temporary");

  return (
    `${platform.getCreateTemporaryTableSnippetSQL()} ${tempTable} (` +
    `${platform.getColumnDeclarationListSQL([column.toArray()])})`
  );
}

function createNonTemporaryTable(): Table {
  return Table.editor()
    .setUnquotedName("nontemporary")
    .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
    .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
    .create();
}

async function dropTemporaryTable(connection: Connection, name: string): Promise<void> {
  const platform = connection.getDatabasePlatform();

  await safeDropTemporaryTable(
    connection,
    platform.getDropTemporaryTableSQL(platform.getTemporaryTableName(name)),
  );
}

async function dropAndCreateTable(connection: Connection, table: Table): Promise<void> {
  const schemaManager = await connection.createSchemaManager();

  try {
    await schemaManager.dropTable(table.getQuotedName(connection.getDatabasePlatform()));
  } catch {
    // best effort setup cleanup
  }

  await schemaManager.createTable(table);
}

async function safeDropTemporaryTable(connection: Connection, sql: string): Promise<void> {
  try {
    await connection.executeStatement(sql);
  } catch {
    // Doctrine helper swallows temp-table drop errors during setup/cleanup.
  }
}
