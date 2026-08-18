import { describe, expect, it } from "vitest";

import { Connection } from "../../connection";
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

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver error", {
      cause: error,
      driverName: "typed-fetch-spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class StaticRowsConnection implements DriverConnection {
  public constructor(private readonly rows: Array<Record<string, unknown>>) {}

  public async prepare(_sql: string) {
    return {
      bindValue: () => undefined,
      execute: async () => new ArrayResult([...this.rows]),
    };
  }

  public async query(_sql: string) {
    return new ArrayResult([...this.rows]);
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
    return "1.0.0-test";
  }
  public async close(): Promise<void> {}
  public getNativeConnection(): unknown {
    return {};
  }
}

class StaticRowsDriver implements Driver {
  public readonly name = "typed-fetch-spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly converter = new NoopExceptionConverter();

  public constructor(private readonly connection: StaticRowsConnection) {}

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

function expectUserRow(_row: { id: number; name: string } | undefined): void {}

describe("Connection typed fetch", () => {
  it("propagates row type through executeQuery<T>() and Result<T>", async () => {
    const connection = new Connection(
      {},
      new StaticRowsDriver(new StaticRowsConnection([{ id: 1, name: "Alice" }])),
    );

    const result = await connection.executeQuery<{ id: number; name: string }>(
      "SELECT id, name FROM users",
    );
    const row = result.fetchAssociative();

    expectUserRow(row);
    expect(row).toEqual({ id: 1, name: "Alice" });
  });

  it("supports typed fetch helpers on Connection", async () => {
    const connection = new Connection(
      {},
      new StaticRowsDriver(new StaticRowsConnection([{ id: 2, name: "Bob" }])),
    );

    const row = await connection.fetchAssociative<{ id: number; name: string }>(
      "SELECT id, name FROM users",
    );

    expectUserRow(row);
    expect(row).toEqual({ id: 2, name: "Bob" });
  });
});
