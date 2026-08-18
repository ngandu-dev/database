import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../../connection";
import { LockMode } from "../../../lock-mode";
import { SQLitePlatform } from "../../../platforms/sqlite-platform";
import { SQLServerPlatform } from "../../../platforms/sqlserver-platform";
import { Column } from "../../../schema/column";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { TransactionIsolationLevel } from "../../../transaction-isolation-level";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/LockMode/NoneTest", () => {
  const functional = useFunctionalTestCase();
  let connection2: Connection | null = null;

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("users")
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );
  });

  afterEach(async () => {
    if (connection2 !== null) {
      try {
        while (connection2.isTransactionActive()) {
          await connection2.rollBack();
        }
      } finally {
        await connection2.close();
        connection2 = null;
      }
    }

    await functional.dropTableIfExists("users");
  });

  it("lock mode none does not break transaction isolation", async ({ skip }) => {
    const connection = functional.connection();
    connection2 = await functional.createConnection();

    if (
      connection.getDatabasePlatform() instanceof SQLitePlatform &&
      connection.getDatabase() === ":memory:"
    ) {
      skip();
    }

    if (connection.getDatabasePlatform() instanceof SQLServerPlatform) {
      skip();
    }

    const schemaManager2 = await connection2.createSchemaManager();
    if (!(await schemaManager2.tableExists("users"))) {
      throw new Error("Separate connections do not seem to talk to the same database.");
    }

    try {
      await connection.setTransactionIsolation(TransactionIsolationLevel.READ_COMMITTED);
      await connection2.setTransactionIsolation(TransactionIsolationLevel.READ_COMMITTED);
    } catch {
      skip();
    }

    await connection.beginTransaction();
    await connection2.beginTransaction();

    try {
      await connection.insert("users", { id: 1 });

      let query = "SELECT id FROM users";
      query = connection2.getDatabasePlatform().appendLockHint(query, LockMode.NONE);

      expect(await connection2.fetchOne(query)).toBeUndefined();
    } finally {
      while (connection2.isTransactionActive()) {
        await connection2.rollBack();
      }

      while (connection.isTransactionActive()) {
        await connection.rollBack();
      }
    }
  });
});
