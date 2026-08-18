import { describe, expect, it } from "vitest";

import { ColumnCase } from "../../column-case";
import type { Connection as DriverConnection } from "../../driver/connection";
import type { Result as DriverResult } from "../../driver/result";
import type { Statement as DriverStatement } from "../../driver/statement";
import { Connection } from "../../portability/connection";
import { Converter } from "../../portability/converter";

class StubDriverResult implements DriverResult {
  public fetchNumeric<T = unknown>(): T[] | undefined {
    return undefined;
  }

  public fetchAssociative<T extends Record<string, unknown> = Record<string, unknown>>():
    | T
    | undefined {
    return undefined;
  }

  public fetchOne<T = unknown>(): T | undefined {
    return undefined;
  }

  public fetchAllNumeric<T = unknown>(): T[][] {
    return [];
  }

  public fetchAllAssociative<T extends Record<string, unknown> = Record<string, unknown>>(): T[] {
    return [];
  }

  public fetchFirstColumn<T = unknown>(): T[] {
    return [];
  }

  public rowCount(): number | string {
    return 0;
  }

  public columnCount(): number {
    return 0;
  }

  public free(): void {}
}

class StubDriverStatement implements DriverStatement {
  public bindValue(): void {}

  public async execute(): Promise<DriverResult> {
    return new StubDriverResult();
  }
}

class SpyDriverConnection implements DriverConnection {
  public serverVersionCalls = 0;
  public nativeConnection = {};

  public async prepare(_sql: string): Promise<DriverStatement> {
    return new StubDriverStatement();
  }

  public async query(_sql: string): Promise<DriverResult> {
    return new StubDriverResult();
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
    this.serverVersionCalls += 1;
    return "1.2.3";
  }

  public getNativeConnection(): unknown {
    return this.nativeConnection;
  }
}

describe("Portability/Connection (Doctrine parity)", () => {
  it("delegates getServerVersion()", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      driverConnection,
      new Converter(false, false, ColumnCase.LOWER),
    );

    await expect(connection.getServerVersion()).resolves.toBe("1.2.3");
    expect(driverConnection.serverVersionCalls).toBe(1);
  });

  it("delegates getNativeConnection()", () => {
    const driverConnection = new SpyDriverConnection();
    const nativeConnection = { kind: "native" };
    driverConnection.nativeConnection = nativeConnection;

    const connection = new Connection(
      driverConnection,
      new Converter(false, false, ColumnCase.LOWER),
    );

    expect(connection.getNativeConnection()).toBe(nativeConnection);
  });
});
