import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { DriverException } from "../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../exception/foreign-key-constraint-violation-exception";
import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { Column } from "../../schema/column";
import { ForeignKeyConstraint } from "../../schema/foreign-key-constraint";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/ForeignKeyConstraintViolationsTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    const connection = functional.connection();
    await functional.dropTableIfExists("test_t1");
    await functional.dropTableIfExists("test_t2");

    const schemaManager = await connection.createSchemaManager();
    await schemaManager.createTable(
      Table.editor()
        .setUnquotedName("test_t1")
        .setColumns(Column.editor().setUnquotedName("ref_id").setTypeName(Types.INTEGER).create())
        .create(),
    );

    await schemaManager.createTable(
      Table.editor()
        .setUnquotedName("test_t2")
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );

    const platform = connection.getDatabasePlatform();
    if (platform instanceof SQLitePlatform) {
      return;
    }

    if (platform instanceof PostgreSQLPlatform) {
      await connection.executeStatement(
        `ALTER TABLE test_t1 ADD CONSTRAINT "${constraintName}" ` +
          `FOREIGN KEY (ref_id) REFERENCES test_t2 (id) DEFERRABLE INITIALLY IMMEDIATE`,
      );
      await connection.executeStatement(
        `ALTER TABLE test_t1 ALTER CONSTRAINT "${constraintName}" DEFERRABLE`,
      );
    } else {
      await schemaManager.createForeignKey(
        ForeignKeyConstraint.editor()
          .setUnquotedName(constraintName)
          .setUnquotedReferencingColumnNames("ref_id")
          .setUnquotedReferencedTableName("test_t2")
          .setUnquotedReferencedColumnNames("id")
          .create(),
        "test_t1",
      );
    }
  });

  afterEach(async () => {
    const connection = functional.connection();
    if (connection.isTransactionActive()) {
      try {
        while (connection.isTransactionActive()) {
          await connection.rollBack();
        }
      } catch {
        // best effort transactional cleanup for failed violation tests
      }
    }

    await functional.dropTableIfExists("test_t1");
    await functional.dropTableIfExists("test_t2");
  });

  it("transactional violates deferred constraint", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLitePlatform) {
      skip();
    }
    if (!supportsDeferrableConstraints(connection)) {
      skip();
    }

    await expectForeignKeyViolation(
      connection,
      () =>
        connection.transactional(async (cx) => {
          await cx.executeStatement(`SET CONSTRAINTS "${constraintName}" DEFERRED`);
          await cx.executeStatement("INSERT INTO test_t1 VALUES (1)");
        }),
      { deferred: true },
    );
  });

  it("transactional violates constraint", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLitePlatform) {
      skip();
    }

    await expectForeignKeyViolation(
      connection,
      () =>
        connection.transactional(async (cx) => {
          await cx.executeStatement("INSERT INTO test_t1 VALUES (1)");
        }),
      { deferred: false },
    );
  });

  it("transactional violates deferred constraint while using transaction nesting", async ({
    skip,
  }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLitePlatform) {
      skip();
    }
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }
    if (!supportsDeferrableConstraints(connection)) {
      skip();
    }

    await expectForeignKeyViolation(
      connection,
      () =>
        connection.transactional(async (cx) => {
          await cx.executeStatement(`SET CONSTRAINTS "${constraintName}" DEFERRED`);
          await cx.beginTransaction();
          await cx.executeStatement("INSERT INTO test_t1 VALUES (1)");
          await cx.commit();
        }),
      { deferred: true },
    );
  });

  it("transactional violates constraint while using transaction nesting", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLitePlatform) {
      skip();
    }
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }

    await expectForeignKeyViolation(
      connection,
      () =>
        connection.transactional(async (cx) => {
          await cx.beginTransaction();
          try {
            await cx.executeStatement("INSERT INTO test_t1 VALUES (1)");
          } catch (error) {
            await cx.rollBack();
            throw error;
          }
        }),
      { deferred: false },
    );
  });

  it("commit violates deferred constraint", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLitePlatform) {
      skip();
    }
    if (!supportsDeferrableConstraints(connection)) {
      skip();
    }

    await connection.beginTransaction();
    try {
      await connection.executeStatement(`SET CONSTRAINTS "${constraintName}" DEFERRED`);
      await connection.executeStatement("INSERT INTO test_t1 VALUES (1)");

      await expectForeignKeyViolation(connection, () => connection.commit(), { deferred: true });
    } finally {
      if (connection.isTransactionActive()) {
        await connection.rollBack();
      }
    }
  });

  it("insert violates constraint", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLitePlatform) {
      skip();
    }

    await connection.beginTransaction();
    try {
      await expectForeignKeyViolation(
        connection,
        () => connection.executeStatement("INSERT INTO test_t1 VALUES (1)"),
        { deferred: false },
      );
    } finally {
      if (connection.isTransactionActive()) {
        await connection.rollBack();
      }
    }
  });

  it("commit violates deferred constraint while using transaction nesting", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLitePlatform) {
      skip();
    }
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }
    if (!supportsDeferrableConstraints(connection)) {
      skip();
    }

    await connection.beginTransaction();
    try {
      await connection.executeStatement(`SET CONSTRAINTS "${constraintName}" DEFERRED`);
      await connection.beginTransaction();
      await connection.executeStatement("INSERT INTO test_t1 VALUES (1)");
      await connection.commit();

      await expectForeignKeyViolation(connection, () => connection.commit(), { deferred: true });
    } finally {
      if (connection.isTransactionActive()) {
        await connection.rollBack();
      }
    }
  });

  it("commit violates constraint while using transaction nesting", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLitePlatform) {
      skip();
    }
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }

    await connection.beginTransaction();
    await connection.beginTransaction();
    try {
      await expectForeignKeyViolation(
        connection,
        () => connection.executeStatement("INSERT INTO test_t1 VALUES (1)"),
        { deferred: false },
      );
    } finally {
      if (connection.isTransactionActive()) {
        await connection.rollBack();
      }
    }
  });
});

function supportsDeferrableConstraints(connection: Connection): boolean {
  return connection.getDatabasePlatform() instanceof PostgreSQLPlatform;
}

async function expectForeignKeyViolation(
  connection: Connection,
  operation: () => Promise<unknown>,
  options: { deferred: boolean },
): Promise<void> {
  const platform = connection.getDatabasePlatform();
  const promise = operation();

  if (platform instanceof SQLServerPlatform) {
    await expect(promise).rejects.toThrow(
      new RegExp(`conflicted with the FOREIGN KEY constraint "${constraintName}"`, "i"),
    );
    return;
  }

  if (options.deferred && platform instanceof PostgreSQLPlatform) {
    await expect(promise).rejects.toThrow(ForeignKeyConstraintViolationException);
    await expect(promise).rejects.toThrow(
      new RegExp(`violates foreign key constraint "${constraintName}"`, "i"),
    );
    return;
  }

  // DB2 branch exists in Datazen reference, but DB2 is not part of the functional harness targets.
  await expect(promise).rejects.toThrow(
    options.deferred ? DriverException : ForeignKeyConstraintViolationException,
  );
}

const constraintName = "fk1";
