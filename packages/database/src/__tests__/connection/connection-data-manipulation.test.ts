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
import { Query } from "../../query";

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
        const stringKeys = [...boundValues.keys()].filter(
          (key): key is string => typeof key === "string",
        );

        if (stringKeys.length > 0) {
          this.latestStatement = {
            sql,
            parameters: Object.fromEntries(stringKeys.map((key) => [key, boundValues.get(key)])),
            types: Object.fromEntries(
              stringKeys.map((key) => [key, boundTypes.get(key) ?? ParameterType.STRING]),
            ),
          };
        } else {
          const numericKeys = [...boundValues.keys()]
            .filter((key): key is number => typeof key === "number")
            .sort((a, b) => a - b);

          this.latestStatement = {
            sql,
            parameters: numericKeys.map((key) => boundValues.get(key)),
            types: numericKeys.map((key) => boundTypes.get(key) ?? ParameterType.STRING),
          };
        }

        return new ArrayResult([], [], 1);
      },
    };
  }

  public async query(_sql: string) {
    return new ArrayResult([]);
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

class PositionalSpyDriver implements Driver {
  public readonly name = "mysql2";
  public readonly bindingStyle: ParameterBindingStyle = ParameterBindingStyle.POSITIONAL;
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

class NamedSpyDriver extends PositionalSpyDriver {
  public override readonly bindingStyle = ParameterBindingStyle.NAMED;
}

describe("Connection convenience data manipulation methods", () => {
  it("supports empty INSERT payload like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.insert("logs", {});
    expect(capture.latestStatement?.sql).toBe("INSERT INTO logs () VALUES ()");
    expect(capture.latestStatement?.parameters).toEqual([]);
  });

  it("updates with different columns in data and criteria like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.update(
      "TestTable",
      {
        is_edited: true,
        text: "some text",
      },
      {
        id: 1,
        name: "foo",
      },
      {
        id: ParameterType.INTEGER,
        is_edited: ParameterType.BOOLEAN,
        name: ParameterType.STRING,
        text: ParameterType.STRING,
      },
    );

    expect(capture.latestStatement?.sql).toBe(
      "UPDATE TestTable SET is_edited = ?, text = ? WHERE id = ? AND name = ?",
    );
    expect(capture.latestStatement?.parameters).toEqual([true, "some text", 1, "foo"]);
    expect(capture.latestStatement?.types).toEqual([
      ParameterType.BOOLEAN,
      ParameterType.STRING,
      ParameterType.INTEGER,
      ParameterType.STRING,
    ]);
  });

  it("updates with same column in data and criteria like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.update(
      "TestTable",
      {
        is_edited: true,
        text: "some text",
      },
      {
        id: 1,
        is_edited: false,
      },
      {
        id: ParameterType.INTEGER,
        is_edited: ParameterType.BOOLEAN,
        text: ParameterType.STRING,
      },
    );

    expect(capture.latestStatement?.sql).toBe(
      "UPDATE TestTable SET is_edited = ?, text = ? WHERE id = ? AND is_edited = ?",
    );
    expect(capture.latestStatement?.parameters).toEqual([true, "some text", 1, false]);
    expect(capture.latestStatement?.types).toEqual([
      ParameterType.BOOLEAN,
      ParameterType.STRING,
      ParameterType.INTEGER,
      ParameterType.BOOLEAN,
    ]);
  });

  it("updates with IS NULL criteria like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.update(
      "TestTable",
      {
        is_edited: null,
        text: "some text",
      },
      {
        id: null,
        name: "foo",
      },
      {
        id: ParameterType.INTEGER,
        is_edited: ParameterType.BOOLEAN,
        name: ParameterType.STRING,
        text: ParameterType.STRING,
      },
    );

    expect(capture.latestStatement?.sql).toBe(
      "UPDATE TestTable SET is_edited = ?, text = ? WHERE id IS NULL AND name = ?",
    );
    expect(capture.latestStatement?.parameters).toEqual([null, "some text", "foo"]);
    expect(capture.latestStatement?.types).toEqual([
      ParameterType.BOOLEAN,
      ParameterType.STRING,
      ParameterType.STRING,
    ]);
  });

  it("deletes with IS NULL criteria like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.delete(
      "TestTable",
      {
        id: null,
        name: "foo",
      },
      {
        id: ParameterType.INTEGER,
        name: ParameterType.STRING,
      },
    );

    expect(capture.latestStatement?.sql).toBe(
      "DELETE FROM TestTable WHERE id IS NULL AND name = ?",
    );
    expect(capture.latestStatement?.parameters).toEqual(["foo"]);
    expect(capture.latestStatement?.types).toEqual([ParameterType.STRING]);
  });

  it("compiles convenience method statements for named-binding drivers", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new NamedSpyDriver(capture));

    await connection.update(
      "users",
      { email: "john@example.com" },
      { id: 3 },
      { id: ParameterType.INTEGER },
    );

    expect(capture.latestStatement).toEqual({
      parameters: { p1: "john@example.com", p2: 3 },
      sql: "UPDATE users SET email = @p1 WHERE id = @p2",
      types: { p1: ParameterType.STRING, p2: ParameterType.INTEGER },
    });
  });
});
