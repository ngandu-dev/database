import { describe, expect, it } from "vitest";

import { Connection } from "../../connection";
import { StaticServerVersionProvider } from "../../connection/static-server-version-provider";
import type { Driver } from "../../driver";
import { ParameterBindingStyle } from "../../driver/_internal";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import { DriverException } from "../../exception/driver-exception";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import type { ServerVersionProvider } from "../../server-version-provider";

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver error", {
      cause: error,
      driverName: "platform-spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class PlatformSpyConnection implements DriverConnection {
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

  public async beginTransaction(): Promise<void> {}

  public async commit(): Promise<void> {}

  public async rollBack(): Promise<void> {}

  public async getServerVersion(): Promise<string> {
    return "driver-connection-version";
  }

  public async close(): Promise<void> {}

  public getNativeConnection(): unknown {
    return this;
  }
}

class PlatformSpyDriver implements Driver {
  public readonly name = "platform-spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  public capturedVersionProvider: ServerVersionProvider | null = null;
  private readonly converter = new NoopExceptionConverter();
  private readonly platform = new MySQLPlatform();

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return new PlatformSpyConnection();
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(versionProvider: ServerVersionProvider): MySQLPlatform {
    this.capturedVersionProvider = versionProvider;
    return this.platform;
  }
}

describe("Connection database platform version provider resolution", () => {
  it("passes the connection as version provider when no serverVersion is configured", () => {
    const driver = new PlatformSpyDriver();
    const connection = new Connection({}, driver);

    connection.getDatabasePlatform();

    expect(driver.capturedVersionProvider).toBe(connection);
  });

  it("uses top-level serverVersion when provided", async () => {
    const driver = new PlatformSpyDriver();
    const connection = new Connection(
      {
        primary: { serverVersion: "8.0.10" },
        serverVersion: "8.0.36",
      },
      driver,
    );

    connection.getDatabasePlatform();

    expect(driver.capturedVersionProvider).toBeInstanceOf(StaticServerVersionProvider);
    await expect(Promise.resolve(driver.capturedVersionProvider?.getServerVersion())).resolves.toBe(
      "8.0.36",
    );
  });

  it("falls back to primary.serverVersion when top-level serverVersion is absent", async () => {
    const driver = new PlatformSpyDriver();
    const connection = new Connection(
      {
        primary: { serverVersion: "5.7.42" },
      },
      driver,
    );

    connection.getDatabasePlatform();

    expect(driver.capturedVersionProvider).toBeInstanceOf(StaticServerVersionProvider);
    await expect(Promise.resolve(driver.capturedVersionProvider?.getServerVersion())).resolves.toBe(
      "5.7.42",
    );
  });
});
