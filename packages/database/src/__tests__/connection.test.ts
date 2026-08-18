import { describe, expect, it } from "vitest";

import { Configuration } from "../configuration";
import { Connection } from "../connection";
import type { Driver } from "../driver";
import { ParameterBindingStyle } from "../driver/_internal";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../driver/api/exception-converter";
import { ArrayResult } from "../driver/array-result";
import type { Connection as DriverConnection } from "../driver/connection";
import { ConnectionException } from "../exception/connection-exception";
import { DriverException } from "../exception/driver-exception";
import { AbstractPlatform } from "../platforms/abstract-platform";
import { MySQLPlatform } from "../platforms/mysql-platform";
import type { ServerVersionProvider } from "../server-version-provider";

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver error", {
      cause: error,
      driverName: "connection-root-parity",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class SpyDriverConnection implements DriverConnection {
  public beginCalls = 0;
  public commitCalls = 0;
  public connectVersionReads = 0;

  public async prepare(_sql: string) {
    return {
      bindValue: () => undefined,
      execute: async () => new ArrayResult([], [], 0),
    };
  }

  public async query(_sql: string) {
    return new ArrayResult([], [], 0);
  }

  public quote(value: string): string {
    return `'${value}'`;
  }

  public async exec(_sql: string): Promise<number | string> {
    return 0;
  }

  public async lastInsertId(): Promise<number | string> {
    return 0;
  }

  public async beginTransaction(): Promise<void> {
    this.beginCalls += 1;
  }

  public async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  public async rollBack(): Promise<void> {}

  public async getServerVersion(): Promise<string> {
    this.connectVersionReads += 1;
    return "6.6.6";
  }

  public async close(): Promise<void> {}

  public getNativeConnection(): unknown {
    return this;
  }
}

class SpyDriver implements Driver {
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  public connectCalls = 0;
  public capturedVersionProvider: ServerVersionProvider | null = null;
  public requestedVersion: string | Promise<string> | null = null;
  private readonly exceptionConverter = new NoopExceptionConverter();

  public constructor(
    private readonly driverConnection: SpyDriverConnection,
    private readonly platform: AbstractPlatform = new MySQLPlatform(),
    private readonly readVersionDuringPlatformDetection: boolean = false,
  ) {}

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    this.connectCalls += 1;
    return this.driverConnection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.exceptionConverter;
  }

  public getDatabasePlatform(versionProvider: ServerVersionProvider): AbstractPlatform {
    this.capturedVersionProvider = versionProvider;

    if (this.readVersionDuringPlatformDetection) {
      this.requestedVersion = versionProvider.getServerVersion();
    }

    return this.platform;
  }
}

describe("Connection (Doctrine root-level parity)", () => {
  it("is disconnected and has no active transaction by default", () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    expect(connection.isConnected()).toBe(false);
    expect(connection.isTransactionActive()).toBe(false);
  });

  it("throws connection exceptions when commit/rollback APIs are used without an active transaction", async () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    await expect(connection.commit()).rejects.toBeInstanceOf(ConnectionException);
    await expect(connection.rollBack()).rejects.toBeInstanceOf(ConnectionException);
    expect(() => connection.setRollbackOnly()).toThrow(ConnectionException);
    expect(() => connection.isRollbackOnly()).toThrow(ConnectionException);
  });

  it("uses auto-commit by default and allows toggling it", async () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    expect(connection.isAutoCommit()).toBe(true);
    await connection.setAutoCommit(false);
    expect(connection.isAutoCommit()).toBe(false);
  });

  it("starts a transaction on connect when auto-commit is disabled", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    expect(connection.isTransactionActive()).toBe(false);

    await connection.executeQuery("SELECT 1");

    expect(connection.isTransactionActive()).toBe(true);
    expect(driverConnection.beginCalls).toBe(1);
  });

  it("leaves no active transaction after transactional() in auto-commit mode", async () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    await connection.transactional(async () => undefined);

    expect(connection.isTransactionActive()).toBe(false);
  });

  it("keeps the root transaction active after transactional() in no-auto-commit mode", async () => {
    const connection = new Connection(
      {},
      new SpyDriver(new SpyDriverConnection()),
      new Configuration({ autoCommit: false }),
    );

    await connection.transactional(async () => undefined);

    expect(connection.isTransactionActive()).toBe(true);
  });

  it("connects only once across repeated queries", async () => {
    const driver = new SpyDriver(new SpyDriverConnection());
    const connection = new Connection({}, driver);

    await connection.executeQuery("SELECT 1");
    await connection.executeQuery("SELECT 2");

    expect(driver.connectCalls).toBe(1);
  });

  it("triggers a physical connection during platform detection only when driver reads the server version", async () => {
    const driverConnection = new SpyDriverConnection();
    const driver = new SpyDriver(driverConnection, new MySQLPlatform(), true);
    const connection = new Connection({}, driver);

    const platform = connection.getDatabasePlatform();

    expect(platform).toBeInstanceOf(MySQLPlatform);
    expect(driver.connectCalls).toBe(1);
    expect(driver.capturedVersionProvider).toBe(connection);
    await expect(Promise.resolve(driver.requestedVersion)).resolves.toBe("6.6.6");
    expect(driverConnection.connectVersionReads).toBe(1);
  });

  it("does not trigger a physical connection during platform detection when driver does not read the server version", () => {
    const driver = new SpyDriver(new SpyDriverConnection(), new MySQLPlatform(), false);
    const connection = new Connection({}, driver);

    const platform = connection.getDatabasePlatform();

    expect(platform).toBeInstanceOf(MySQLPlatform);
    expect(driver.connectCalls).toBe(0);
    expect(driver.capturedVersionProvider).toBe(connection);
  });

  it("uses serverVersion from top-level params for platform detection without connecting", async () => {
    const driver = new SpyDriver(new SpyDriverConnection(), new MySQLPlatform(), true);
    const connection = new Connection(
      {
        serverVersion: "8.0",
      },
      driver,
    );

    connection.getDatabasePlatform();

    expect(driver.connectCalls).toBe(0);
    await expect(Promise.resolve(driver.requestedVersion)).resolves.toBe("8.0");
  });

  it("uses primary.serverVersion for platform detection when top-level serverVersion is absent", async () => {
    const driver = new SpyDriver(new SpyDriverConnection(), new MySQLPlatform(), true);
    const connection = new Connection(
      {
        primary: {
          serverVersion: "8.0",
        },
      },
      driver,
    );

    connection.getDatabasePlatform();

    expect(driver.connectCalls).toBe(0);
    await expect(Promise.resolve(driver.requestedVersion)).resolves.toBe("8.0");
  });
});
