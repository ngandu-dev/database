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
import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import type { Query } from "../../query";

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

class CaptureConnection implements DriverConnection {
  public latestQuery: Query | null = null;

  public async prepare(sql: string) {
    const boundValues = new Map<string | number, unknown>();
    const boundTypes = new Map<string | number, ParameterType | undefined>();

    return {
      bindValue: (param: string | number, value: unknown, type?: ParameterType) => {
        boundValues.set(param, value);
        boundTypes.set(param, type);
      },
      execute: async () => {
        const stringKeys = [...boundValues.keys()].filter(
          (key): key is string => typeof key === "string",
        );

        if (stringKeys.length > 0) {
          const parameters: Record<string, unknown> = {};
          const types: Record<string, ParameterType> = {};

          for (const key of stringKeys) {
            parameters[key] = boundValues.get(key);
            types[key] = boundTypes.get(key) ?? ParameterType.STRING;
          }

          this.latestQuery = { sql, parameters, types };
        } else {
          const numericKeys = [...boundValues.keys()]
            .filter((key): key is number => typeof key === "number")
            .sort((a, b) => a - b);

          const parameters = numericKeys.map((key) => boundValues.get(key));
          const types = numericKeys.map((key) => boundTypes.get(key) ?? ParameterType.STRING);

          this.latestQuery = { sql, parameters, types };
        }

        return new ArrayResult([]);
      },
    };
  }

  public async query(sql: string) {
    this.latestQuery = { sql, parameters: [], types: [] };
    return new ArrayResult([]);
  }

  public quote(value: string): string {
    return `'${value}'`;
  }

  public async exec(sql: string): Promise<number | string> {
    this.latestQuery = { sql, parameters: [], types: [] };
    return 1;
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
  public async close(): Promise<void> {}
  public getNativeConnection(): unknown {
    return {};
  }
}

class NamedSpyDriver implements Driver {
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.NAMED;
  private readonly converter = new NoopExceptionConverter();

  constructor(private readonly connection: CaptureConnection) {}

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

describe("Connection parameter compilation", () => {
  it("treats undefined named parameters as SQL NULL", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new NamedSpyDriver(capture));

    await connection.executeQuery(
      "SELECT * FROM users WHERE deleted_at = :deletedAt",
      { deletedAt: undefined },
      { deletedAt: ParameterType.STRING },
    );

    expect(capture.latestQuery).toEqual({
      parameters: {
        p1: null,
      },
      sql: "SELECT * FROM users WHERE deleted_at = @p1",
      types: {
        p1: ParameterType.STRING,
      },
    });
  });

  it("compiles named placeholders to sqlserver style named bindings", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new NamedSpyDriver(capture));

    await connection.executeQuery(
      "SELECT * FROM users WHERE id = :id AND status = :status",
      { id: 10, status: "active" },
      { id: ParameterType.INTEGER, status: ParameterType.STRING },
    );

    expect(capture.latestQuery).toEqual({
      parameters: {
        p1: 10,
        p2: "active",
      },
      sql: "SELECT * FROM users WHERE id = @p1 AND status = @p2",
      types: {
        p1: ParameterType.INTEGER,
        p2: ParameterType.STRING,
      },
    });
  });

  it("compiles positional placeholders to sqlserver style named bindings", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new NamedSpyDriver(capture));

    await connection.executeQuery(
      "SELECT * FROM users WHERE id = ? OR parent_id = ?",
      [12, 12],
      [ParameterType.INTEGER, ParameterType.INTEGER],
    );

    expect(capture.latestQuery).toEqual({
      parameters: {
        p1: 12,
        p2: 12,
      },
      sql: "SELECT * FROM users WHERE id = @p1 OR parent_id = @p2",
      types: {
        p1: ParameterType.INTEGER,
        p2: ParameterType.INTEGER,
      },
    });
  });

  it("compiles mixed placeholder styles without throwing", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new NamedSpyDriver(capture));

    await connection.executeQuery(
      "SELECT * FROM users WHERE id = :id AND parent_id = ?",
      { id: 1, 0: 2 },
      { id: ParameterType.INTEGER, 0: ParameterType.INTEGER },
    );

    expect(capture.latestQuery).toEqual({
      parameters: {
        p1: 1,
        p2: 2,
      },
      sql: "SELECT * FROM users WHERE id = @p1 AND parent_id = @p2",
      types: {
        p1: ParameterType.INTEGER,
        p2: ParameterType.INTEGER,
      },
    });
  });
});
