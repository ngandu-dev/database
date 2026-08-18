import { describe, expect, it } from "vitest";

import { Configuration } from "../../configuration";
import type { Driver } from "../../driver";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import type { Middleware as DriverMiddleware } from "../../driver/middleware";
import { DriverManager } from "../../driver-manager";
import { DriverException } from "../../exception/driver-exception";
import { DriverRequired } from "../../exception/driver-required";
import { UnknownDriver } from "../../exception/unknown-driver";
import { MySQLPlatform } from "../../platforms/mysql-platform";

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver error", {
      cause: error,
      driverName: "spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class SpyConnection implements DriverConnection {
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
    return value;
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
    return "1.0.0";
  }
  public async close(): Promise<void> {}
  public getNativeConnection(): unknown {
    return {};
  }
}

class SpyDriver implements Driver {
  public connectCalls = 0;
  private readonly converter = new NoopExceptionConverter();

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    this.connectCalls += 1;
    return new SpyConnection();
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

class NeverUseDriver implements Driver {
  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    throw new Error("driverClass should not be used when driverInstance is provided");
  }

  public getExceptionConverter(): ExceptionConverter {
    return new NoopExceptionConverter();
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

class PrefixMiddleware implements DriverMiddleware {
  constructor(private readonly prefix: string) {}

  public wrap(driver: Driver): Driver {
    const prefix = this.prefix;

    return {
      connect: async (params: Record<string, unknown>) => {
        middlewareOrder.push(prefix);
        return driver.connect(params);
      },
      getDatabasePlatform: (versionProvider) => driver.getDatabasePlatform(versionProvider),
      getExceptionConverter: () => driver.getExceptionConverter(),
    };
  }
}

const middlewareOrder: string[] = [];

describe("DriverManager", () => {
  it("lists available drivers", () => {
    expect(DriverManager.getAvailableDrivers().sort()).toEqual([
      "mssql",
      "mysql2",
      "pg",
      "sqlite3",
    ]);
  });

  it("throws when no driver is configured", () => {
    expect(() => DriverManager.getConnection({})).toThrow(DriverRequired);
  });

  it("throws for unknown driver name", () => {
    expect(() =>
      DriverManager.getConnection({
        driver: "invalid" as unknown as "mysql2",
      }),
    ).toThrow(UnknownDriver);
  });

  it("uses driverClass when provided", () => {
    const connection = DriverManager.getConnection({
      driverClass: SpyDriver,
    });

    expect(connection.getDriver()).toBeInstanceOf(SpyDriver);
  });

  it("prefers driverInstance over driverClass", () => {
    const driverInstance = new SpyDriver();
    const connection = DriverManager.getConnection({
      driverClass: NeverUseDriver,
      driverInstance,
    });

    expect(connection.getDriver()).toBe(driverInstance);
  });

  it("applies middlewares in declaration order", () => {
    middlewareOrder.length = 0;
    const configuration = new Configuration();
    configuration.addMiddleware(new PrefixMiddleware("a:"));
    configuration.addMiddleware(new PrefixMiddleware("b:"));

    const connection = DriverManager.getConnection(
      {
        driverInstance: new SpyDriver(),
      },
      configuration,
    );

    return connection.connect().then(() => {
      expect(middlewareOrder).toEqual(["b:", "a:"]);
    });
  });
});
