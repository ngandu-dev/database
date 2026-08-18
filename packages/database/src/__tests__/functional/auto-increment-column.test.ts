import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { DB2Platform } from "../../platforms/db2-platform";
import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/AutoIncrementColumnTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    const table = Table.editor()
      .setUnquotedName("auto_increment_table")
      .setColumns(
        Column.editor()
          .setUnquotedName("id")
          .setTypeName(Types.INTEGER)
          .setAutoincrement(true)
          .create(),
        Column.editor().setUnquotedName("val").setTypeName(Types.INTEGER).create(),
      )
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .create();

    await functional.dropAndCreateTable(table);
  });

  it("inserts auto generated values", async () => {
    const connection = functional.connection();

    await connection.insert("auto_increment_table", { val: 0 });

    expect(await maxId(connection)).toBe(1);
  });

  it("inserts explicit identity values", async () => {
    const connection = functional.connection();
    const platform = connection.getDatabasePlatform();
    const isSQLServer = platform instanceof SQLServerPlatform;

    if (isSQLServer) {
      await insertExplicitIdentityOnSqlServer(connection, 2);
    } else {
      await connection.insert("auto_increment_table", { id: 2, val: 0 });
    }

    expect(await maxId(connection)).toBe(2);

    // Doctrine skips this assertion on PostgreSQL/DB2 because explicit identity inserts
    // don't necessarily advance the next generated value.
    if (platform instanceof PostgreSQLPlatform || platform instanceof DB2Platform) {
      return;
    }

    await connection.insert("auto_increment_table", { val: 0 });
    expect(await maxId(connection)).toBe(3);
  });
});

async function maxId(connection: Connection): Promise<number> {
  const value = await connection.fetchOne("SELECT MAX(id) FROM auto_increment_table");
  expect(value).toBeDefined();

  return Number(value);
}

async function insertExplicitIdentityOnSqlServer(
  connection: Connection,
  id: number,
): Promise<void> {
  // SQL Server identity insert state is session-scoped. The Node mssql adapter uses pooled
  // requests, so use one batch to preserve Doctrine's ON->INSERT->OFF semantics on one session.
  await connection.executeStatement(
    `SET IDENTITY_INSERT auto_increment_table ON; ` +
      `INSERT INTO auto_increment_table (id, val) VALUES (${Math.trunc(id)}, 0); ` +
      `SET IDENTITY_INSERT auto_increment_table OFF`,
  );
}
