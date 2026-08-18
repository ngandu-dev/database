import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { DriverException } from "../../exception/driver-exception";
import { UniqueConstraintViolationException } from "../../exception/unique-constraint-violation-exception";
import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { Column } from "../../schema/column";
import { Table } from "../../schema/table";
import { UniqueConstraint } from "../../schema/unique-constraint";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/UniqueConstraintViolationsTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    const connection = functional.connection();
    await functional.dropTableIfExists("unique_constraint_violations");

    const schemaManager = await connection.createSchemaManager();
    await schemaManager.createTable(
      Table.editor()
        .setUnquotedName("unique_constraint_violations")
        .setColumns(
          Column.editor().setUnquotedName("unique_field").setTypeName(Types.INTEGER).create(),
        )
        .create(),
    );

    const platform = connection.getDatabasePlatform();
    if (platform instanceof PostgreSQLPlatform) {
      await connection.executeStatement(
        `ALTER TABLE unique_constraint_violations ` +
          `ADD CONSTRAINT ${constraintName} UNIQUE (unique_field) DEFERRABLE INITIALLY IMMEDIATE`,
      );
    } else if (platform instanceof SQLitePlatform) {
      await connection.executeStatement(
        `CREATE UNIQUE INDEX ${constraintName} ON unique_constraint_violations(unique_field)`,
      );
    } else {
      await schemaManager.createUniqueConstraint(
        UniqueConstraint.editor()
          .setUnquotedName(constraintName)
          .setUnquotedColumnNames("unique_field")
          .create(),
        "unique_constraint_violations",
      );
    }

    await connection.executeStatement("INSERT INTO unique_constraint_violations VALUES (1)");
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

    await functional.dropTableIfExists("unique_constraint_violations");
  });

  it("transactional violates deferred constraint", async ({ skip }) => {
    const connection = functional.connection();
    if (!supportsDeferrableConstraints(connection)) {
      skip();
    }

    await expectUniqueViolation(
      connection,
      () =>
        connection.transactional(async (cx) => {
          await cx.executeStatement(`SET CONSTRAINTS "${constraintName}" DEFERRED`);
          await cx.executeStatement("INSERT INTO unique_constraint_violations VALUES (1)");
        }),
      { deferred: true },
    );
  });

  it("transactional violates constraint", async () => {
    const connection = functional.connection();

    await expectUniqueViolation(
      connection,
      () =>
        connection.transactional(async (cx) => {
          await cx.executeStatement("INSERT INTO unique_constraint_violations VALUES (1)");
        }),
      { deferred: false },
    );
  });

  it("transactional violates deferred constraint while using transaction nesting", async ({
    skip,
  }) => {
    const connection = functional.connection();
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }
    if (!supportsDeferrableConstraints(connection)) {
      skip();
    }

    await expectUniqueViolation(
      connection,
      () =>
        connection.transactional(async (cx) => {
          await cx.executeStatement(`SET CONSTRAINTS "${constraintName}" DEFERRED`);
          await cx.beginTransaction();
          await cx.executeStatement("INSERT INTO unique_constraint_violations VALUES (1)");
          await cx.commit();
        }),
      { deferred: true },
    );
  });

  it("transactional violates constraint while using transaction nesting", async ({ skip }) => {
    const connection = functional.connection();
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }

    await expectUniqueViolation(
      connection,
      () =>
        connection.transactional(async (cx) => {
          await cx.beginTransaction();
          try {
            await cx.executeStatement("INSERT INTO unique_constraint_violations VALUES (1)");
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
    if (!supportsDeferrableConstraints(connection)) {
      skip();
    }

    await connection.beginTransaction();
    try {
      await connection.executeStatement(`SET CONSTRAINTS "${constraintName}" DEFERRED`);
      await connection.executeStatement("INSERT INTO unique_constraint_violations VALUES (1)");

      await expectUniqueViolation(connection, () => connection.commit(), { deferred: true });
    } finally {
      if (connection.isTransactionActive()) {
        await connection.rollBack();
      }
    }
  });

  it("insert violates constraint", async () => {
    const connection = functional.connection();

    await connection.beginTransaction();
    try {
      await expectUniqueViolation(
        connection,
        () => connection.executeStatement("INSERT INTO unique_constraint_violations VALUES (1)"),
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
      await connection.executeStatement("INSERT INTO unique_constraint_violations VALUES (1)");
      await connection.commit();

      await expectUniqueViolation(connection, () => connection.commit(), { deferred: true });
    } finally {
      if (connection.isTransactionActive()) {
        await connection.rollBack();
      }
    }
  });

  it("commit violates constraint while using transaction nesting", async ({ skip }) => {
    const connection = functional.connection();
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }

    await connection.beginTransaction();
    await connection.beginTransaction();
    try {
      await expectUniqueViolation(
        connection,
        () => connection.executeStatement("INSERT INTO unique_constraint_violations VALUES (1)"),
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

async function expectUniqueViolation(
  connection: Connection,
  operation: () => Promise<unknown>,
  options: { deferred: boolean },
): Promise<void> {
  const platform = connection.getDatabasePlatform();
  const promise = operation();

  if (platform instanceof SQLServerPlatform) {
    await expect(promise).rejects.toThrow(/Violation of UNIQUE KEY constraint/i);
    return;
  }

  if (options.deferred && platform instanceof PostgreSQLPlatform) {
    await expect(promise).rejects.toThrow(UniqueConstraintViolationException);
    await expect(promise).rejects.toThrow(
      new RegExp(`duplicate key value violates unique constraint "${constraintName}"`, "i"),
    );
    return;
  }

  // DB2 branch exists in Doctrine, but DB2 is not part of the functional harness targets.
  await expect(promise).rejects.toThrow(
    options.deferred ? DriverException : UniqueConstraintViolationException,
  );
}

const constraintName = "c1_unique";
