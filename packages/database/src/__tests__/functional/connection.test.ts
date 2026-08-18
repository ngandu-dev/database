import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { DriverManager } from "../../driver-manager";
import { CommitFailedRollbackOnly } from "../../exception/commit-failed-rollback-only";
import { DriverException } from "../../exception/driver-exception";
import { SavepointsNotSupported } from "../../exception/savepoints-not-supported";
import { UniqueConstraintViolationException } from "../../exception/unique-constraint-violation-exception";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { createFunctionalDriverManagerParams } from "./_helpers/functional-connection-factory";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/ConnectionTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;

  beforeEach(async () => {
    connection = functional.connection();
  });

  it("throws when committing a rollback-only transaction", async () => {
    await connection.beginTransaction();
    connection.setRollbackOnly();

    await expect(connection.commit()).rejects.toThrow(CommitFailedRollbackOnly);
  });

  it("supports nested transaction behavior with savepoints (adapted subset)", async ({ skip }) => {
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }
    await createConnectionTestTable(functional, connection);

    await connection.beginTransaction();
    expect(connection.getTransactionNestingLevel()).toBe(1);

    try {
      await connection.beginTransaction();
      expect(connection.getTransactionNestingLevel()).toBe(2);

      await connection.insert("connection_test", { id: 1 });
      throw new Error("expected unique constraint violation");
    } catch (error) {
      expect(error).toBeInstanceOf(UniqueConstraintViolationException);
      await connection.rollBack();
      expect(connection.getTransactionNestingLevel()).toBe(1);
    }

    await connection.commit();
    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("supports nested transaction behavior with savepoints after deeper nesting", async ({
    skip,
  }) => {
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }
    await createConnectionTestTable(functional, connection);

    await connection.beginTransaction();
    expect(connection.getTransactionNestingLevel()).toBe(1);

    try {
      await connection.beginTransaction();
      expect(connection.getTransactionNestingLevel()).toBe(2);
      await connection.beginTransaction();
      expect(connection.getTransactionNestingLevel()).toBe(3);

      await connection.commit();
      expect(connection.getTransactionNestingLevel()).toBe(2);

      await connection.insert("connection_test", { id: 1 });
      throw new Error("expected unique constraint violation");
    } catch (error) {
      expect(error).toBeInstanceOf(UniqueConstraintViolationException);
      await connection.rollBack();
      expect(connection.getTransactionNestingLevel()).toBe(1);
    }

    expect(connection.isRollbackOnly()).toBe(false);
    await connection.commit();
    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("marks transactions inactive after connection.close()", async () => {
    await connection.beginTransaction();
    await connection.close();

    expect(connection.isTransactionActive()).toBe(false);
  });

  it("rolls back and resets nesting level after a failed transactional insert", async () => {
    await createConnectionTestTable(functional, connection);

    try {
      await connection.beginTransaction();
      expect(connection.getTransactionNestingLevel()).toBe(1);

      await connection.insert("connection_test", { id: 1 });
      throw new Error("expected unique constraint violation");
    } catch (error) {
      expect(error).toBeInstanceOf(UniqueConstraintViolationException);
      expect(connection.getTransactionNestingLevel()).toBe(1);
      await connection.rollBack();
      expect(connection.getTransactionNestingLevel()).toBe(0);
    }
  });

  it("commits a simple transaction and resets nesting level", async () => {
    await createConnectionTestTable(functional, connection);

    await connection.beginTransaction();
    expect(connection.getTransactionNestingLevel()).toBe(1);
    await connection.insert("connection_test", { id: 2 });
    await connection.commit();

    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("transactional() rolls back on unique constraint violations", async () => {
    await createConnectionTestTable(functional, connection);

    await expect(
      connection.transactional(async (tx) => {
        await tx.insert("connection_test", { id: 1 });
      }),
    ).rejects.toThrow(UniqueConstraintViolationException);

    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("transactional() rolls back on thrown errors", async () => {
    await expect(
      connection.transactional(async (tx) => {
        await tx.executeQuery(tx.getDatabasePlatform().getDummySelectSQL());
        throw new Error("Ooops!");
      }),
    ).rejects.toThrow("Ooops!");

    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("transactional() returns callback values", async () => {
    await createConnectionTestTable(functional, connection);

    const result = await connection.transactional(async (tx) =>
      tx.insert("connection_test", { id: 2 }),
    );

    expect(result).toBe(1);
    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("transactional() returns scalar values", async () => {
    const result = await connection.transactional(async () => 42);

    expect(result).toBe(42);
  });

  it("throws on invalid SQL in executeStatement()", async () => {
    await expect(connection.executeStatement("foo")).rejects.toThrow(DriverException);
  });

  it("throws on invalid SQL in executeQuery()", async () => {
    await expect(connection.executeQuery("foo")).rejects.toThrow(DriverException);
  });

  it("throws on invalid SQL in prepare().executeStatement()", async () => {
    const statement = await connection.prepare("foo");

    await expect(statement.executeStatement()).rejects.toThrow(DriverException);
  });

  it("resets transaction nesting level after reconnecting a file-backed SQLite connection", async ({
    skip,
  }) => {
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }

    if (!(connection.getDatabasePlatform() instanceof SQLitePlatform)) {
      skip();
    }

    const dbFile = join(tmpdir(), `datazen_test_nesting_${Date.now()}_${Math.random()}.sqlite`);
    const fileConnection = await createFileBackedSQLiteConnection(dbFile, connection);

    try {
      await fileConnection.executeStatement("DROP TABLE IF EXISTS test_nesting");
      await fileConnection.executeStatement("CREATE TABLE test_nesting(test int not null)");

      await fileConnection.beginTransaction();
      await fileConnection.beginTransaction();
      await fileConnection.close(); // runtime close/reset (Doctrine intent: lost/closed connection)

      await fileConnection.beginTransaction();
      await fileConnection.executeStatement("INSERT INTO test_nesting VALUES (33)");
      await fileConnection.rollBack();

      expect(Number(await fileConnection.fetchOne("SELECT count(*) FROM test_nesting"))).toBe(0);
    } finally {
      await closeFileBackedSQLiteConnection(fileConnection);
      if (existsSync(dbFile)) {
        unlinkSync(dbFile);
      }
    }
  });

  it("connects without an explicit database name", async ({ skip }) => {
    const platform = connection.getDatabasePlatform();
    const params = { ...(await createFunctionalDriverManagerParams("default", "pool")) };

    if (
      platform.constructor.name === "OraclePlatform" ||
      platform.constructor.name === "DB2Platform"
    ) {
      skip();
    }

    delete (params as Record<string, unknown>).dbname;
    delete (params as Record<string, unknown>).database;

    const dbalConnection = DriverManager.getConnection(params, connection.getConfiguration());

    try {
      expect(Number(await dbalConnection.fetchOne(platform.getDummySelectSQL()))).toBe(1);
    } finally {
      await dbalConnection.close();
    }
  });

  it("determines platform when connecting to a non-existent database", async ({ skip }) => {
    const platform = connection.getDatabasePlatform();
    const params = { ...(await createFunctionalDriverManagerParams("default", "pool")) };

    if (
      platform.constructor.name === "OraclePlatform" ||
      platform.constructor.name === "DB2Platform"
    ) {
      skip();
    }

    (params as Record<string, unknown>).dbname = "foo_bar";
    (params as Record<string, unknown>).database = "foo_bar";

    const dbalConnection = DriverManager.getConnection(params, connection.getConfiguration());

    try {
      expect(dbalConnection.isConnected()).toBe(false);
      expect(dbalConnection.getParams().dbname).toBe("foo_bar");
      expect(dbalConnection.getParams().database).toBe("foo_bar");
    } finally {
      await dbalConnection.close();
    }
  });

  it.skip("persistent connection semantics", async () => {
    // PDO/native persistent connection attributes are PHP-native and out of scope for the Node sqlite3 adapter.
  });

  it("savepoint methods throw when platform does not support savepoints", async ({ skip }) => {
    if (connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }

    await expect(connection.createSavepoint("foo")).rejects.toThrow(SavepointsNotSupported);
    await expect(connection.releaseSavepoint("foo")).rejects.toThrow(SavepointsNotSupported);
    await expect(connection.rollbackSavepoint("foo")).rejects.toThrow(SavepointsNotSupported);
  });
});

async function createConnectionTestTable(
  functional: ReturnType<typeof useFunctionalTestCase>,
  connection: Connection,
): Promise<void> {
  await functional.dropAndCreateTable(
    Table.editor()
      .setUnquotedName("connection_test")
      .setColumns(Column.editor().setUnquotedName("id").setTypeName("integer").create())
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .create(),
  );
  await connection.insert("connection_test", { id: 1 });
}

async function createFileBackedSQLiteConnection(
  path: string,
  sourceConnection: Connection,
): Promise<Connection> {
  const sqliteModule = await import("sqlite3");
  const sqlite3 = (sqliteModule.default ?? sqliteModule) as {
    Database: new (
      filename: string,
      callback: (error: Error | null) => void,
    ) => { close?: (callback: (error: Error | null) => void) => void };
  };

  const client = await new Promise<object>((resolve, reject) => {
    const db = new sqlite3.Database(path, (error) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(db as object);
    });
  });

  const fileConnection = DriverManager.getConnection(
    {
      client: client as Record<string, unknown>,
      driver: "sqlite3",
      // Keep the underlying file DB open across Connection.close() calls so the wrapper can
      //exercise Doctrine's transaction-nesting-reset-on-reconnect behavior on the same object.
      ownsClient: false,
    },
    sourceConnection.getConfiguration(),
  );
  await fileConnection.resolveDatabasePlatform();

  return fileConnection;
}

async function closeFileBackedSQLiteConnection(connection: Connection): Promise<void> {
  try {
    await connection.close();
  } finally {
    const native = (await connection.getNativeConnection()) as {
      close?: (cb: (e: Error | null) => void) => void;
    };
    if (typeof native?.close === "function") {
      await new Promise<void>((resolve, reject) => {
        native.close?.((error) => {
          if (error !== null) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  }
}
