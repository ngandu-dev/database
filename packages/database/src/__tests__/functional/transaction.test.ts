import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { ConnectionLost } from "../../exception/connection-lost";
import { AbstractMySQLPlatform } from "../../platforms/abstract-mysql-platform";
import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { TestUtil } from "../test-util";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/TransactionTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;

  beforeEach(async () => {
    connection = functional.connection();
  });

  it("beginTransaction failure raises ConnectionLost after killing the current session", async ({
    skip,
  }) => {
    await withDedicatedConnection(functional, async (dedicated) => {
      await expectConnectionLoss(functional, dedicated, skip, async (target) => {
        await target.beginTransaction();
      });
    });
  });

  it("commit failure raises ConnectionLost after killing the current session", async ({ skip }) => {
    await withDedicatedConnection(functional, async (dedicated) => {
      await dedicated.beginTransaction();

      await expectConnectionLoss(functional, dedicated, skip, async (target) => {
        await target.commit();
      });
    });
  });

  it("rollback failure raises ConnectionLost after killing the current session", async ({
    skip,
  }) => {
    await withDedicatedConnection(functional, async (dedicated) => {
      await dedicated.beginTransaction();

      await expectConnectionLoss(functional, dedicated, skip, async (target) => {
        await target.rollBack();
      });
    });
  });

  it("transactional failure during callback via forced connection loss", async ({ skip }) => {
    await withDedicatedConnection(functional, async (dedicated) => {
      await expectConnectionLoss(functional, dedicated, skip, async (target) => {
        await target.transactional(async (transactionalConnection) => {
          await transactionalConnection.executeQuery(
            transactionalConnection.getDatabasePlatform().getDummySelectSQL(),
          );
        });
      });
    });
  });

  it("transactional failure during commit via forced connection loss", async ({ skip }) => {
    await withDedicatedConnection(functional, async (dedicated) => {
      await expectConnectionLoss(functional, dedicated, skip, async (target) => {
        await target.transactional(async () => {});
      });
    });
  });

  it("supports the nested transaction walkthrough with savepoints", async ({ skip }) => {
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }

    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("storage")
        .setColumns(Column.editor().setUnquotedName("test_int").setTypeName(Types.INTEGER).create())
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("test_int").create(),
        )
        .create(),
    );

    const query = "SELECT count(test_int) FROM storage";

    expect(String(await connection.fetchOne(query))).toBe("0");

    const result = await connection.transactional(async (outer) =>
      outer.transactional(async (inner) => {
        await inner.insert("storage", { test_int: 1 });
        return inner.fetchOne(query);
      }),
    );

    expect(String(result)).toBe("1");
    expect(String(await connection.fetchOne(query))).toBe("1");
  }, 15000);
});

async function expectConnectionLoss(
  functional: ReturnType<typeof useFunctionalTestCase>,
  connection: Connection,
  skip: () => void,
  scenario: (connection: Connection) => Promise<void>,
): Promise<void> {
  await killCurrentSession(functional, connection, skip);
  await expect(scenario(connection)).rejects.toThrow(ConnectionLost);
}

async function killCurrentSession(
  functional: ReturnType<typeof useFunctionalTestCase>,
  connection: Connection,
  skip: () => void,
): Promise<void> {
  functional.markConnectionNotReusable();

  const platform = connection.getDatabasePlatform();
  let currentProcessQuery: string;
  let killProcessStatement: string;

  if (platform instanceof AbstractMySQLPlatform) {
    currentProcessQuery = "SELECT CONNECTION_ID()";
    killProcessStatement = "KILL ?";
  } else if (platform instanceof PostgreSQLPlatform) {
    currentProcessQuery = "SELECT pg_backend_pid()";
    killProcessStatement = "SELECT pg_terminate_backend(?)";
  } else {
    skip();
    return;
  }

  const currentProcessId = await connection.fetchOne(currentProcessQuery);
  expect(currentProcessId).toBeDefined();
  if (currentProcessId === undefined) {
    return;
  }

  const privilegedConnection = await TestUtil.getPrivilegedConnection();
  try {
    await privilegedConnection.executeStatement(killProcessStatement, [currentProcessId]);
  } finally {
    await privilegedConnection.close();
  }
}

async function withDedicatedConnection(
  functional: ReturnType<typeof useFunctionalTestCase>,
  run: (connection: Connection) => Promise<void>,
): Promise<void> {
  const dedicated = await functional.createConnection();

  try {
    await run(dedicated);
  } finally {
    while (dedicated.isTransactionActive()) {
      await dedicated.rollBack();
    }

    await dedicated.close();
  }
}
