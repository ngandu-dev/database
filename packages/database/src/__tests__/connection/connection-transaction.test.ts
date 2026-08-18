import { describe, expect, it } from "vitest";

import { Configuration } from "../../configuration";
import { Connection } from "../../connection";
import type { Driver } from "../../driver";
import { ParameterBindingStyle } from "../../driver/_internal";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import { CommitFailedRollbackOnly } from "../../exception/commit-failed-rollback-only";
import { DriverException } from "../../exception/driver-exception";
import { NoActiveTransaction } from "../../exception/no-active-transaction";
import { SavepointsNotSupported } from "../../exception/savepoints-not-supported";
import { AbstractPlatform } from "../../platforms/abstract-platform";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { TransactionIsolationLevel } from "../../transaction-isolation-level";

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver failure", {
      cause: error,
      driverName: "spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class SpyDriverConnection implements DriverConnection {
  public beginCalls = 0;
  public commitCalls = 0;
  public rollbackCalls = 0;
  public closeCalls = 0;
  public execCalls: string[] = [];

  constructor(private readonly quoteImpl?: (value: string) => string) {}

  public async prepare(_sql: string) {
    return {
      bindValue: () => undefined,
      execute: async () => new ArrayResult([], [], 1),
    };
  }

  public async query(_sql: string) {
    return new ArrayResult([{ value: 1 }], ["value"], 1);
  }

  public quote(value: string): string {
    return this.quoteImpl?.(value) ?? `'${value.replace(/'/g, "''")}'`;
  }

  public async exec(sql: string): Promise<number | string> {
    this.execCalls.push(sql);
    return 1;
  }

  public async lastInsertId(): Promise<number | string> {
    return 123;
  }

  public async beginTransaction(): Promise<void> {
    this.beginCalls += 1;
  }

  public async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  public async rollBack(): Promise<void> {
    this.rollbackCalls += 1;
  }

  public async getServerVersion(): Promise<string> {
    return "1.0.0";
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }

  public getNativeConnection(): unknown {
    return this;
  }
}

class NoSavepointPlatform extends MySQLPlatform {
  public override supportsSavepoints(): boolean {
    return false;
  }
}

class NoReleaseSavepointPlatform extends MySQLPlatform {
  public override supportsReleaseSavepoints(): boolean {
    return false;
  }
}

class MultiColumnDriverConnection extends SpyDriverConnection {
  public override async query(_sql: string) {
    return new ArrayResult(
      [
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ],
      ["id", "name", "active"],
      2,
    );
  }
}

class SpyDriver implements Driver {
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  public connectCalls = 0;
  private readonly exceptionConverter = new NoopExceptionConverter();

  constructor(
    private readonly connection: DriverConnection,
    private readonly platform: AbstractPlatform = new MySQLPlatform(),
  ) {}

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    this.connectCalls += 1;
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.exceptionConverter;
  }

  public getDatabasePlatform(): AbstractPlatform {
    return this.platform;
  }
}

class ExposedConnection extends Connection {
  public getNestedTransactionSavePointNameForTest(level: number): string {
    return this._getNestedTransactionSavePointName(level);
  }
}

describe("Connection transactions and state", () => {
  it("uses auto-commit enabled by default and can inherit disabled mode from configuration", () => {
    const defaultConnection = new Connection({}, new SpyDriver(new SpyDriverConnection()));
    expect(defaultConnection.isAutoCommit()).toBe(true);

    const nonAutoCommitConnection = new Connection(
      {},
      new SpyDriver(new SpyDriverConnection()),
      new Configuration({ autoCommit: false }),
    );
    expect(nonAutoCommitConnection.isAutoCommit()).toBe(false);
  });

  it("starts a transaction automatically on connect when auto-commit is disabled", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.beginCalls).toBe(1);
  });

  it("starts and commits a root transaction", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.beginCalls).toBe(1);

    await connection.commit();
    expect(connection.isTransactionActive()).toBe(false);
    expect(connection.getTransactionNestingLevel()).toBe(0);
    expect(driverConnection.commitCalls).toBe(1);
  });

  it("creates and releases savepoints for nested commits", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    await connection.beginTransaction();

    expect(connection.getTransactionNestingLevel()).toBe(2);
    expect(driverConnection.execCalls).toEqual(["SAVEPOINT DATAZEN_2"]);

    await connection.commit();

    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.execCalls).toEqual([
      "SAVEPOINT DATAZEN_2",
      "RELEASE SAVEPOINT DATAZEN_2",
    ]);
  });

  it("rolls back nested transactions to savepoint", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    await connection.beginTransaction();

    await connection.rollBack();
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.execCalls).toEqual([
      "SAVEPOINT DATAZEN_2",
      "ROLLBACK TO SAVEPOINT DATAZEN_2",
    ]);

    await connection.rollBack();
    expect(connection.getTransactionNestingLevel()).toBe(0);
    expect(driverConnection.rollbackCalls).toBe(1);
  });

  it("throws when nested transactions are not supported", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection, new NoSavepointPlatform()),
    );

    await connection.beginTransaction();
    await expect(connection.beginTransaction()).rejects.toThrow(SavepointsNotSupported);
  });

  it("commits nested transactions when release savepoints are not supported", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection, new NoReleaseSavepointPlatform()),
    );

    await connection.beginTransaction();
    await connection.beginTransaction();
    expect(driverConnection.execCalls).toEqual(["SAVEPOINT DATAZEN_2"]);

    await expect(connection.commit()).resolves.toBeUndefined();
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.execCalls).toEqual(["SAVEPOINT DATAZEN_2"]);
  });

  it("throws for commit/rollback when there is no active transaction", async () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    await expect(connection.commit()).rejects.toThrow(NoActiveTransaction);
    await expect(connection.rollBack()).rejects.toThrow(NoActiveTransaction);
  });

  it("supports rollback-only state and blocks commit", async () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    await connection.beginTransaction();
    connection.setRollbackOnly();
    expect(connection.isRollbackOnly()).toBe(true);
    await expect(connection.commit()).rejects.toThrow(CommitFailedRollbackOnly);
    await connection.rollBack();
  });

  it("throws rollback-only checks when not in a transaction", () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    expect(() => connection.setRollbackOnly()).toThrow(NoActiveTransaction);
    expect(() => connection.isRollbackOnly()).toThrow(NoActiveTransaction);
  });

  it("commits or rolls back through transactional()", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    const value = await connection.transactional(async () => 7);
    expect(value).toBe(7);
    expect(driverConnection.beginCalls).toBe(1);
    expect(driverConnection.commitCalls).toBe(1);

    await expect(
      connection.transactional(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(driverConnection.rollbackCalls).toBe(1);
  });

  it("restarts the root transaction on commit when auto-commit is disabled", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    await connection.commit();

    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.commitCalls).toBe(1);
    expect(driverConnection.beginCalls).toBe(2);
  });

  it("does not restart a transaction on nested commit when auto-commit is disabled", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    await connection.beginTransaction();
    await connection.commit();

    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.beginCalls).toBe(1);
    expect(driverConnection.execCalls).toEqual([
      "SAVEPOINT DATAZEN_2",
      "RELEASE SAVEPOINT DATAZEN_2",
    ]);
  });

  it("restarts the root transaction on rollback when auto-commit is disabled", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    await connection.rollBack();

    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.rollbackCalls).toBe(1);
    expect(driverConnection.beginCalls).toBe(2);
  });

  it("commits active transactions when enabling auto-commit during a transaction", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    await connection.setAutoCommit(true);

    expect(connection.isAutoCommit()).toBe(true);
    expect(connection.isTransactionActive()).toBe(false);
    expect(connection.getTransactionNestingLevel()).toBe(0);
    expect(driverConnection.commitCalls).toBe(1);
    expect(driverConnection.beginCalls).toBe(1);
  });

  it("commits and starts a new transaction when disabling auto-commit during a transaction", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    await connection.setAutoCommit(false);

    expect(connection.isAutoCommit()).toBe(false);
    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.commitCalls).toBe(1);
    expect(driverConnection.beginCalls).toBe(2);
  });

  it("tracks last insert id after executeStatement", async () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    const affectedRows = await connection.executeStatement("INSERT INTO test (name) VALUES (?)", [
      "A",
    ]);
    expect(affectedRows).toBe(1);
    expect(await connection.lastInsertId()).toBe(123);
  });

  it("uses driver quote when available and fallback otherwise", async () => {
    const withQuote = new Connection(
      {},
      new SpyDriver(new SpyDriverConnection((value) => `[${value}]`)),
    );
    const withoutQuote = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    expect(await withQuote.quote("abc")).toBe("[abc]");
    expect(await withoutQuote.quote("O'Reilly")).toBe("'O''Reilly'");
  });

  it("closes and reconnects physical connection", async () => {
    const driverConnection = new SpyDriverConnection();
    const driver = new SpyDriver(driverConnection);
    const connection = new Connection({}, driver);

    await connection.executeQuery("SELECT 1");
    expect(connection.isConnected()).toBe(true);
    expect(driver.connectCalls).toBe(1);

    await connection.close();
    expect(connection.isConnected()).toBe(false);
    expect(driverConnection.closeCalls).toBe(1);

    await connection.executeQuery("SELECT 1");
    expect(driver.connectCalls).toBe(2);
  });

  it("fetches key/value and associative indexed rows", async () => {
    const connection = new Connection({}, new SpyDriver(new MultiColumnDriverConnection()));

    expect(await connection.fetchAllKeyValue("SELECT id, name, active FROM users")).toEqual({
      u1: "Alice",
      u2: "Bob",
    });

    expect(
      await connection.fetchAllAssociativeIndexed("SELECT id, name, active FROM users"),
    ).toEqual({
      u1: { active: true, name: "Alice" },
      u2: { active: false, name: "Bob" },
    });
  });

  it("supports Datazen compatibility connection aliases and savepoint settings", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new ExposedConnection({ dbname: "app_db" }, new SpyDriver(driverConnection));
    const platform = connection.getDatabasePlatform();

    expect(connection.getDatabase()).toBe("app_db");
    expect(connection.getNestTransactionsWithSavepoints()).toBe(true);
    connection.setNestTransactionsWithSavepoints(false);
    expect(connection.getNestTransactionsWithSavepoints()).toBe(false);

    expect(connection.getTransactionIsolation()).toBe(
      platform.getDefaultTransactionIsolationLevel(),
    );
    await connection.setTransactionIsolation(TransactionIsolationLevel.READ_COMMITTED);
    expect(connection.getTransactionIsolation()).toBe(TransactionIsolationLevel.READ_COMMITTED);
    expect(driverConnection.execCalls).toContain(
      platform.getSetTransactionIsolationSQL(TransactionIsolationLevel.READ_COMMITTED),
    );

    expect(connection.quoteIdentifier("users")).toBe(platform.quoteIdentifier("users"));
    expect(connection.quoteSingleIdentifier("users")).toBe(platform.quoteSingleIdentifier("users"));
    expect(connection.getNestedTransactionSavePointNameForTest(3)).toBe("DATAZEN_3");
  });

  it("iterates rows using Datazen-style connection iterator helpers", async () => {
    const connection = new Connection({}, new SpyDriver(new MultiColumnDriverConnection()));
    const sql = "SELECT id, name, active FROM users";

    const numericRows: Array<[string, string, boolean]> = [];
    for await (const row of connection.iterateNumeric<[string, string, boolean]>(sql)) {
      numericRows.push(row);
    }

    const associativeRows: Array<{ id: string; name: string; active: boolean }> = [];
    for await (const row of connection.iterateAssociative<{
      id: string;
      name: string;
      active: boolean;
    }>(sql)) {
      associativeRows.push(row);
    }

    const keyValueRows: Array<[string, string]> = [];
    for await (const row of connection.iterateKeyValue<string>(sql)) {
      keyValueRows.push(row);
    }

    const indexedRows: Array<[string, { name: string; active: boolean }]> = [];
    for await (const row of connection.iterateAssociativeIndexed<{ name: string; active: boolean }>(
      sql,
    )) {
      indexedRows.push(row);
    }

    const columnRows: string[] = [];
    for await (const value of connection.iterateColumn<string>(sql)) {
      columnRows.push(value);
    }

    expect(numericRows).toEqual([
      ["u1", "Alice", true],
      ["u2", "Bob", false],
    ]);
    expect(associativeRows).toEqual([
      { id: "u1", name: "Alice", active: true },
      { id: "u2", name: "Bob", active: false },
    ]);
    expect(keyValueRows).toEqual([
      ["u1", "Alice"],
      ["u2", "Bob"],
    ]);
    expect(indexedRows).toEqual([
      ["u1", { active: true, name: "Alice" }],
      ["u2", { active: false, name: "Bob" }],
    ]);
    expect(columnRows).toEqual(["u1", "u2"]);
  });
});
