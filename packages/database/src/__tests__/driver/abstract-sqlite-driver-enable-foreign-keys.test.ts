import { describe, expect, it } from "vitest";

import { StaticServerVersionProvider } from "../../connection/static-server-version-provider";
import type { Driver } from "../../driver";
import { EnableForeignKeys } from "../../driver/abstract-sqlite-driver/middleware/enable-foreign-keys";
import type { ExceptionConverter } from "../../driver/api/exception-converter";
import { ExceptionConverter as SQLiteExceptionConverter } from "../../driver/api/sqlite/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import { SQLitePlatform } from "../../platforms/sqlite-platform";

class SpyConnection implements DriverConnection {
  public readonly execStatements: string[] = [];

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

  public async exec(sql: string): Promise<number | string> {
    this.execStatements.push(sql);
    return 0;
  }

  public async lastInsertId(): Promise<number | string> {
    return 0;
  }

  public async beginTransaction(): Promise<void> {}
  public async commit(): Promise<void> {}
  public async rollBack(): Promise<void> {}
  public async getServerVersion(): Promise<string> {
    return "3.45.1";
  }
  public async close(): Promise<void> {}
  public getNativeConnection(): unknown {
    return null;
  }
}

class SpyDriver implements Driver {
  public readonly connection = new SpyConnection();
  private readonly converter: ExceptionConverter = new SQLiteExceptionConverter();
  private readonly platform = new SQLitePlatform();

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(): SQLitePlatform {
    return this.platform;
  }
}

describe("EnableForeignKeys middleware", () => {
  it("executes PRAGMA foreign_keys=ON on connect", async () => {
    const driver = new SpyDriver();
    const wrapped = new EnableForeignKeys().wrap(driver);

    const connection = await wrapped.connect({});

    expect(connection).toBe(driver.connection);
    expect(driver.connection.execStatements).toEqual(["PRAGMA foreign_keys=ON"]);
  });

  it("preserves driver behavior and platform methods", () => {
    const wrapped = new EnableForeignKeys().wrap(new SpyDriver());

    expect(wrapped.getDatabasePlatform(new StaticServerVersionProvider("3.45.1"))).toBeInstanceOf(
      SQLitePlatform,
    );
  });
});
