import { describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
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
import { DateType } from "../../types/date-type";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Types } from "../../types/types";

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
  public latestStatement: Query | null = null;

  public async prepare(sql: string) {
    const boundValues = new Map<string | number, unknown>();
    const boundTypes = new Map<string | number, ParameterType | undefined>();

    return {
      bindValue: (param: string | number, value: unknown, type?: ParameterType) => {
        boundValues.set(param, value);
        boundTypes.set(param, type);
      },
      execute: async () => {
        const numericKeys = [...boundValues.keys()]
          .filter((key): key is number => typeof key === "number")
          .sort((a, b) => a - b);
        const stringKeys = [...boundValues.keys()].filter(
          (key): key is string => typeof key === "string",
        );

        const compiled =
          stringKeys.length > 0
            ? {
                sql,
                parameters: Object.fromEntries(
                  stringKeys.map((key) => [key, boundValues.get(key)]),
                ),
                types: Object.fromEntries(
                  stringKeys.map((key) => [key, boundTypes.get(key) ?? ParameterType.STRING]),
                ),
              }
            : {
                sql,
                parameters: numericKeys.map((key) => boundValues.get(key)),
                types: numericKeys.map((key) => boundTypes.get(key) ?? ParameterType.STRING),
              };

        if (/^\s*select\b/i.test(sql)) {
          this.latestQuery = compiled;
          return new ArrayResult([{ ok: true }], ["ok"], 1);
        }

        this.latestStatement = compiled;
        return new ArrayResult([], [], 1);
      },
    };
  }

  public async query(sql: string) {
    this.latestQuery = { sql, parameters: [], types: [] };
    return new ArrayResult([{ ok: true }], ["ok"], 1);
  }

  public quote(value: string): string {
    return `'${value}'`;
  }

  public async exec(sql: string): Promise<number | string> {
    this.latestStatement = { sql, parameters: [], types: [] };
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
    return this;
  }
}

class SpyDriver implements Driver {
  public readonly name = "mysql2";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
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

describe("Connection type conversion", () => {
  registerBuiltInTypes();

  it("treats undefined positional parameters as SQL NULL", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new SpyDriver(capture));

    await connection.executeQuery("SELECT ? AS maybe", [undefined], [ParameterType.STRING]);

    expect(capture.latestQuery?.parameters).toEqual([null]);
    expect(capture.latestQuery?.types).toEqual([ParameterType.STRING]);
  });

  it("converts Datazen Type names to driver values and binding types", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new SpyDriver(capture));
    const now = new Date(2024, 0, 2, 3, 4, 5);

    await connection.executeQuery(
      "SELECT :dt AS dt, :ok AS ok, :tags AS tags",
      { dt: now, ok: true, tags: ["a", "b"] },
      { dt: Types.DATETIME_MUTABLE, ok: Types.BOOLEAN, tags: Types.SIMPLE_ARRAY },
    );

    expect(capture.latestQuery?.sql).toBe("SELECT ? AS dt, ? AS ok, ? AS tags");
    expect(capture.latestQuery?.parameters).toEqual(["2024-01-02 03:04:05", 1, "a,b"]);
    expect(capture.latestQuery?.types).toEqual([
      ParameterType.STRING,
      ParameterType.BOOLEAN,
      ParameterType.STRING,
    ]);
  });

  it("supports Type instances and preserves array parameter expansion", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new SpyDriver(capture));
    const dateType = new DateType();
    const date = new Date(2024, 0, 2, 0, 0, 0);

    await connection.executeQuery(
      "SELECT :d AS d, :ids AS ids",
      { d: date, ids: [1, 2] },
      { d: dateType, ids: ArrayParameterType.INTEGER },
    );

    expect(capture.latestQuery?.sql).toBe("SELECT ? AS d, ?, ? AS ids");
    expect(capture.latestQuery?.parameters).toEqual(["2024-01-02", 1, 2]);
    expect(capture.latestQuery?.types).toEqual([
      ParameterType.STRING,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
    ]);
  });
});
