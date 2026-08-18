import { describe, expect, it } from "vitest";

import { ColumnCase } from "../../column-case";
import { Configuration } from "../../configuration";
import type { Driver } from "../../driver";
import { ParameterBindingStyle } from "../../driver/_internal";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import { DriverManager } from "../../driver-manager";
import { DriverException } from "../../exception/driver-exception";
import { OraclePlatform } from "../../platforms/oracle-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { Connection } from "../../portability/connection";
import { Middleware } from "../../portability/middleware";

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
  public queryResult: { columns?: string[]; rows: Array<Record<string, unknown>> };

  constructor(queryResult: { columns?: string[]; rows: Array<Record<string, unknown>> }) {
    this.queryResult = queryResult;
  }

  public async prepare(_sql: string) {
    return {
      bindValue: () => undefined,
      execute: async () =>
        new ArrayResult(
          this.queryResult.rows,
          this.queryResult.columns ?? [],
          this.queryResult.rows.length,
        ),
    };
  }

  public async query(_sql: string) {
    return new ArrayResult(
      this.queryResult.rows,
      this.queryResult.columns ?? [],
      this.queryResult.rows.length,
    );
  }

  public quote(value: string): string {
    return `'${value}'`;
  }

  public async exec(_sql: string): Promise<number | string> {
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
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly converter = new NoopExceptionConverter();
  private readonly platform: OraclePlatform | null;

  constructor(
    private readonly connection: SpyConnection,
    platform?: OraclePlatform,
  ) {
    this.platform = platform ?? null;
  }

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform() {
    return this.platform ?? new SQLServerPlatform();
  }
}

describe("Portability Middleware", () => {
  it("returns the original driver when portability mode is disabled", () => {
    const middleware = new Middleware(Connection.PORTABILITY_NONE, ColumnCase.LOWER);
    const driver = new SpyDriver(new SpyConnection({ rows: [] }));

    expect(middleware.wrap(driver)).toBe(driver);
  });

  it("converts row values and column names", async () => {
    const connection = DriverManager.getConnection(
      {
        driverInstance: new SpyDriver(
          new SpyConnection({
            columns: ["ID", "EMPTY", "NAME"],
            rows: [{ ID: "A  ", EMPTY: "", NAME: " Bob  " }],
          }),
        ),
      },
      new Configuration({
        middlewares: [
          new Middleware(
            Connection.PORTABILITY_RTRIM |
              Connection.PORTABILITY_EMPTY_TO_NULL |
              Connection.PORTABILITY_FIX_CASE,
            ColumnCase.LOWER,
          ),
        ],
      }),
    );

    const result = await connection.executeQuery("SELECT 1");

    expect(result.fetchAssociative()).toEqual({
      empty: null,
      id: "A",
      name: " Bob",
    });
    expect(result.fetchNumeric()).toBeUndefined();
    expect(result.getColumnName(0)).toBe("id");
    expect(result.getColumnName(1)).toBe("empty");
  });

  it("skips empty-string conversion for oracle platform", async () => {
    const connection = DriverManager.getConnection(
      {
        driverInstance: new SpyDriver(
          new SpyConnection({
            columns: ["VAL"],
            rows: [{ VAL: "" }],
          }),
          new OraclePlatform(),
        ),
      },
      new Configuration({
        middlewares: [
          new Middleware(
            Connection.PORTABILITY_EMPTY_TO_NULL | Connection.PORTABILITY_FIX_CASE,
            ColumnCase.LOWER,
          ),
        ],
      }),
    );

    const result = await connection.executeQuery("SELECT 1");
    expect(result.fetchAssociative()).toEqual({
      val: "",
    });
  });
});
