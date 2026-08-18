import { describe, expect, it } from "vitest";

import { Connection } from "../../connection";
import type { Driver } from "../../driver";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import type { Statement as DriverStatement } from "../../driver/statement";
import { DriverException } from "../../exception/driver-exception";
import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { Statement } from "../../statement";
import { DateType } from "../../types/date-type";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Types } from "../../types/types";

class NoopDriverConnection implements DriverConnection {
  public async prepare(_sql: string): Promise<DriverStatement> {
    throw new Error("not used");
  }

  public async query(_sql: string) {
    throw new Error("not used");
  }

  public quote(value: string): string {
    return `'${value}'`;
  }

  public async exec(_sql: string): Promise<number | string> {
    throw new Error("not used");
  }

  public async lastInsertId(): Promise<number | string> {
    return 1;
  }

  public async beginTransaction(): Promise<void> {}
  public async commit(): Promise<void> {}
  public async rollBack(): Promise<void> {}
  public async getServerVersion(): Promise<string> {
    return "1.0.0";
  }
  public getNativeConnection(): unknown {
    return this;
  }
}

class SpyExceptionConverter implements ExceptionConverter {
  public lastContext: ExceptionConverterContext | undefined;

  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    this.lastContext = context;

    return new DriverException("converted", {
      cause: error,
      driverName: "spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class SpyDriver implements Driver {
  constructor(private readonly converter: ExceptionConverter = new SpyExceptionConverter()) {}

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return new NoopDriverConnection();
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

class SpyDriverStatement implements DriverStatement {
  public readonly boundValues: Array<{
    param: string | number;
    type: ParameterType | undefined;
    value: unknown;
  }> = [];
  public bindError: unknown;
  public executeError: unknown;
  public executeResult = new ArrayResult([{ ok: true }], ["ok"], 1);

  public bindValue(param: string | number, value: unknown, type?: ParameterType): void {
    if (this.bindError !== undefined) {
      throw this.bindError;
    }

    this.boundValues.push({ param, type, value });
  }

  public async execute() {
    if (this.executeError !== undefined) {
      throw this.executeError;
    }

    return this.executeResult;
  }
}

describe("Statement", () => {
  registerBuiltInTypes();

  it("keeps SQL and exposes wrapped driver statement", () => {
    const driverStatement = new SpyDriverStatement();
    const statement = new Statement(
      new Connection({}, new SpyDriver()),
      driverStatement,
      "SELECT 1",
    );

    expect(statement.getSQL()).toBe("SELECT 1");
    expect(statement.getWrappedStatement()).toBe(driverStatement);
  });

  it("binds raw parameter types directly to the driver statement", () => {
    const driverStatement = new SpyDriverStatement();
    const statement = new Statement(
      new Connection({}, new SpyDriver()),
      driverStatement,
      "SELECT * FROM users WHERE id = ?",
    );

    statement.bindValue(1, 99, ParameterType.INTEGER);

    expect(driverStatement.boundValues).toEqual([
      { param: 1, type: ParameterType.INTEGER, value: 99 },
    ]);
  });

  it("converts Datazen type names in bindValue() before driver binding", () => {
    const driverStatement = new SpyDriverStatement();
    const statement = new Statement(
      new Connection({}, new SpyDriver()),
      driverStatement,
      "SELECT :active",
    );

    statement.bindValue(":active", true, Types.BOOLEAN);

    expect(driverStatement.boundValues).toEqual([
      { param: ":active", type: ParameterType.BOOLEAN, value: 1 },
    ]);
  });

  it("converts Datazen Type instances in bindValue() before driver binding", () => {
    const driverStatement = new SpyDriverStatement();
    const statement = new Statement(
      new Connection({}, new SpyDriver()),
      driverStatement,
      "SELECT ?",
    );

    statement.bindValue(1, new Date(2024, 0, 2), new DateType());

    expect(driverStatement.boundValues).toEqual([
      { param: 1, type: ParameterType.STRING, value: "2024-01-02" },
    ]);
  });

  it("wraps driver execute() result for executeQuery()", async () => {
    const driverStatement = new SpyDriverStatement();
    driverStatement.executeResult = new ArrayResult([{ ok: true }], ["ok"], 1);
    const statement = new Statement(
      new Connection({}, new SpyDriver()),
      driverStatement,
      "SELECT 1 AS ok",
    );

    const result = await statement.executeQuery<{ ok: boolean }>();

    expect(result.fetchAssociative()).toEqual({ ok: true });
  });

  it("returns rowCount() from executeStatement()", async () => {
    const driverStatement = new SpyDriverStatement();
    driverStatement.executeResult = new ArrayResult([], [], "3");
    const statement = new Statement(
      new Connection({}, new SpyDriver()),
      driverStatement,
      "UPDATE users SET active = 1",
    );

    await expect(statement.executeStatement()).resolves.toBe("3");
  });

  it("converts driver execution errors with SQL, params, and original types", async () => {
    const converter = new SpyExceptionConverter();
    const driverStatement = new SpyDriverStatement();
    driverStatement.executeError = new Error("driver execute failed");
    const statement = new Statement(
      new Connection({}, new SpyDriver(converter)),
      driverStatement,
      "SELECT ?",
    );

    statement.bindValue(1, true, Types.BOOLEAN);

    await expect(statement.executeQuery()).rejects.toBeInstanceOf(DriverException);
    expect(converter.lastContext?.operation).toBe("query");
    expect(converter.lastContext?.query?.sql).toBe("SELECT ?");

    const parameters = converter.lastContext?.query?.parameters;
    expect(Array.isArray(parameters)).toBe(true);
    expect((parameters as unknown[])[1]).toBe(true);

    const types = converter.lastContext?.query?.types;
    expect(Array.isArray(types)).toBe(true);
    expect((types as unknown[])[1]).toBe(Types.BOOLEAN);
  });
});
