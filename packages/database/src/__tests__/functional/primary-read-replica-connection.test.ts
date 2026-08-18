import { beforeEach, describe, expect, it } from "vitest";

import type { ConnectionParams } from "../../driver-manager";
import { DriverManager } from "../../driver-manager";
import { AbstractMySQLPlatform } from "../../platforms/abstract-mysql-platform";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { createFunctionalDriverManagerParams } from "./_helpers/functional-connection-factory";
import { type FunctionalTestCase, useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/PrimaryReadReplicaConnectionTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      return;
    }

    const table = Table.editor()
      .setUnquotedName("primary_replica_table")
      .setColumns(Column.editor().setUnquotedName("test_int").setTypeName(Types.INTEGER).create())
      .setPrimaryKeyConstraint(
        PrimaryKeyConstraint.editor().setUnquotedColumnNames("test_int").create(),
      )
      .create();

    await functional.dropAndCreateTable(table);
    await connection.executeStatement("DELETE FROM primary_replica_table");
    await connection.insert("primary_replica_table", { test_int: 1 });
  });

  it("inherits charset from primary", async ({ skip }) => {
    skipUnlessMySQL(functional, skip);

    // Node mysql2 adapter in this port currently injects pre-created clients/pools into the
    // driver, so the PRR wrapper cannot prove charset inheritance at connect-time the same way
    // Datazen (Doctrine) can with raw connect params. The inheritance logic itself is covered in
    // unit tests for PrimaryReadReplicaConnection.
    skip(
      "mysql2 adapter uses injected clients/pools, so functional charset inheritance is not observable",
    );
  });

  it("connects to replica by default and switches to primary explicitly", async ({ skip }) => {
    skipUnlessMySQL(functional, skip);

    const conn = await createPrimaryReadReplicaConnection();
    try {
      expect(conn.isConnectedToPrimary()).toBe(false);
      await conn.ensureConnectedToReplica();
      expect(conn.isConnectedToPrimary()).toBe(false);
      await conn.ensureConnectedToPrimary();
      expect(conn.isConnectedToPrimary()).toBe(true);
    } finally {
      await conn.close();
    }
  });

  it("does not switch to primary on read query execution", async ({ skip }) => {
    skipUnlessMySQL(functional, skip);

    const conn = await createPrimaryReadReplicaConnection();
    try {
      const data = await conn.fetchAllAssociative(
        "SELECT count(*) as num FROM primary_replica_table",
      );

      expect(Number(readLowerCaseKey(data[0] ?? {}, "num"))).toBe(1);
      expect(conn.isConnectedToPrimary()).toBe(false);
    } finally {
      await conn.close();
    }
  });

  it("switches to primary on write operation", async ({ skip }) => {
    skipUnlessMySQL(functional, skip);

    const conn = await createPrimaryReadReplicaConnection();
    try {
      await conn.insert("primary_replica_table", { test_int: 30 });

      expect(conn.isConnectedToPrimary()).toBe(true);
      expect(await countRows(conn)).toBe(2);
      expect(conn.isConnectedToPrimary()).toBe(true);
    } finally {
      await conn.close();
    }
  });

  it("with keepReplica=true stays on primary after transaction write until replica is explicitly requested", async ({
    skip,
  }) => {
    skipUnlessMySQL(functional, skip);

    const conn = await createPrimaryReadReplicaConnection(true);
    try {
      await conn.ensureConnectedToReplica();

      await conn.beginTransaction();
      await conn.insert("primary_replica_table", { test_int: 30 });
      await conn.commit();

      expect(conn.isConnectedToPrimary()).toBe(true);

      await conn.connect();
      expect(conn.isConnectedToPrimary()).toBe(true);

      await conn.ensureConnectedToReplica();
      expect(conn.isConnectedToPrimary()).toBe(false);
    } finally {
      await conn.close();
    }
  });

  it("with keepReplica=true stays on primary after insert until replica is explicitly requested", async ({
    skip,
  }) => {
    skipUnlessMySQL(functional, skip);

    const conn = await createPrimaryReadReplicaConnection(true);
    try {
      await conn.ensureConnectedToReplica();
      await conn.insert("primary_replica_table", { test_int: 30 });

      expect(conn.isConnectedToPrimary()).toBe(true);

      await conn.connect();
      expect(conn.isConnectedToPrimary()).toBe(true);

      await conn.ensureConnectedToReplica();
      expect(conn.isConnectedToPrimary()).toBe(false);
    } finally {
      await conn.close();
    }
  });

  it("closes and reconnects", async ({ skip }) => {
    skipUnlessMySQL(functional, skip);

    const conn = await createPrimaryReadReplicaConnection();
    try {
      await conn.ensureConnectedToPrimary();
      expect(conn.isConnectedToPrimary()).toBe(true);

      await conn.close();
      expect(conn.isConnectedToPrimary()).toBe(false);

      await conn.ensureConnectedToPrimary();
      expect(conn.isConnectedToPrimary()).toBe(true);
    } finally {
      await conn.close();
    }
  });
});

function skipUnlessMySQL(functional: FunctionalTestCase, skip: () => never): void {
  if (!(functional.connection().getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
    skip();
  }
}

async function createPrimaryReadReplicaConnection(keepReplica = false) {
  const primary = await createFunctionalDriverManagerParams("default", "direct");
  const replicaA = await createFunctionalDriverManagerParams("default", "direct");
  const replicaB = await createFunctionalDriverManagerParams("default", "direct");

  const params = {
    ...copyTopLevelPrimaryReadReplicaParams(primary),
    keepReplica,
    primary: copyBranchParams(primary),
    replica: [copyBranchParams(replicaA), copyBranchParams(replicaB)],
  };

  const connection = DriverManager.getPrimaryReadReplicaConnection(params);
  await connection.resolveDatabasePlatform();
  return connection;
}

function copyTopLevelPrimaryReadReplicaParams(params: ConnectionParams): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...params };
  delete copy.client;
  delete copy.connection;
  delete copy.pool;
  delete copy.ownsClient;
  delete copy.ownsPool;
  delete copy.wrapperClass;

  return copy;
}

function copyBranchParams(params: ConnectionParams): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...params };
  delete copy.wrapperClass;
  return copy;
}

async function countRows(connection: {
  fetchAllAssociative(sql: string): Promise<Record<string, unknown>[]>;
}) {
  const data = await connection.fetchAllAssociative(
    "SELECT count(*) as num FROM primary_replica_table",
  );
  return Number(readLowerCaseKey(data[0] ?? {}, "num"));
}

function readLowerCaseKey(row: Record<string, unknown>, key: string): unknown {
  for (const [candidate, value] of Object.entries(row)) {
    if (candidate.toLowerCase() === key.toLowerCase()) {
      return value;
    }
  }

  return undefined;
}
