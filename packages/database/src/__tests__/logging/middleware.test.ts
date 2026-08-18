import { describe, expect, it } from "vitest";

import { Configuration } from "../../configuration";
import { Connection } from "../../connection";
import { type Driver } from "../../driver";
import { ParameterBindingStyle } from "../../driver/_internal";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import { DriverManager } from "../../driver-manager";
import { DriverException } from "../../exception/driver-exception";
import type { Logger } from "../../logging/logger";
import { Middleware } from "../../logging/middleware";
import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import type { Query } from "../../query";

interface LogEntry {
  level: "debug" | "error" | "info" | "warn";
  message: string;
  context?: Record<string, unknown>;
}

class RecordingLogger implements Logger {
  public readonly entries: LogEntry[] = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ context, level: "debug", message });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ context, level: "info", message });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ context, level: "warn", message });
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ context, level: "error", message });
  }
}

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
  public readonly queriedSql: string[] = [];
  public readonly execSql: string[] = [];
  public readonly preparedExecutions: Query[] = [];
  public beginCalls = 0;
  public closeCalls = 0;
  public commitCalls = 0;
  public rollBackCalls = 0;

  public async prepare(sql: string) {
    const boundValues = new Map<string | number, unknown>();
    const boundTypes = new Map<string | number, unknown>();

    return {
      bindValue: (param: string | number, value: unknown, type?: unknown) => {
        boundValues.set(param, value);
        boundTypes.set(param, type);
      },
      execute: async () => {
        const numericKeys = [...boundValues.keys()]
          .filter((key): key is number => typeof key === "number")
          .sort((a, b) => a - b);

        this.preparedExecutions.push({
          parameters: numericKeys.map((key) => boundValues.get(key)),
          sql,
          types: numericKeys.map((key) => boundTypes.get(key)),
        });

        return new ArrayResult([{ id: 1 }], ["id"], 1);
      },
    };
  }

  public async query(sql: string) {
    this.queriedSql.push(sql);
    return new ArrayResult([{ id: 1 }], ["id"], 1);
  }

  public quote(value: string): string {
    return `<${value}>`;
  }

  public async exec(sql: string): Promise<number | string> {
    this.execSql.push(sql);
    return 1;
  }

  public async lastInsertId(): Promise<number | string> {
    return 2;
  }

  public async beginTransaction(): Promise<void> {
    this.beginCalls += 1;
  }

  public async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  public async rollBack(): Promise<void> {
    this.rollBackCalls += 1;
  }

  public async getServerVersion(): Promise<string> {
    return "1.2.3";
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }

  public getNativeConnection(): unknown {
    return { connection: "native" };
  }
}

class SpyDriver implements Driver {
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  public params: Record<string, unknown> | null = null;
  private readonly converter = new NoopExceptionConverter();

  constructor(private readonly connection: SpyConnection) {}

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    this.params = params;
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

describe("Logging Middleware", () => {
  it("logs connection parameters and redacts password", async () => {
    const logger = new RecordingLogger();
    const driver = new SpyDriver(new SpyConnection());
    const configuration = new Configuration({
      middlewares: [new Middleware(logger)],
    });
    const connection = DriverManager.getConnection(
      {
        driverInstance: driver,
        password: "123456",
        user: "bernard",
      },
      configuration,
    );

    await connection.getServerVersion();

    expect(driver.params?.password).toBe("123456");

    const connectLog = logger.entries.find(
      (entry) => entry.level === "info" && entry.message === "Connecting with parameters {params}",
    );
    const params = connectLog?.context?.params as Record<string, unknown>;

    expect(params.password).toBe("<redacted>");
    expect(params.user).toBe("bernard");
  });

  it("logs query and statement execution details", async () => {
    const logger = new RecordingLogger();
    const nativeConnection = new SpyConnection();
    const connection = DriverManager.getConnection(
      {
        driverInstance: new SpyDriver(nativeConnection),
      },
      new Configuration({ middlewares: [new Middleware(logger)] }),
    );

    await connection.executeQuery("SELECT :id AS id", { id: 1 }, { id: ParameterType.INTEGER });
    await connection.executeStatement(
      "UPDATE users SET name = :name WHERE id = :id",
      { id: 1, name: "alice" },
      { id: ParameterType.INTEGER, name: ParameterType.STRING },
    );

    expect(nativeConnection.preparedExecutions[0]).toEqual({
      parameters: [1],
      sql: "SELECT ? AS id",
      types: [ParameterType.INTEGER],
    });
    expect(nativeConnection.preparedExecutions[1]).toEqual({
      parameters: ["alice", 1],
      sql: "UPDATE users SET name = ? WHERE id = ?",
      types: [ParameterType.STRING, ParameterType.INTEGER],
    });

    const queryLog = logger.entries.find(
      (entry) =>
        entry.level === "debug" &&
        entry.message ===
          "Executing prepared statement: {sql} (parameters: {params}, types: {types})" &&
        entry.context?.sql === "SELECT ? AS id",
    );
    expect(queryLog?.context).toEqual({
      params: [1],
      sql: "SELECT ? AS id",
      types: [ParameterType.INTEGER],
    });

    const statementLog = logger.entries.find(
      (entry) =>
        entry.level === "debug" &&
        entry.message ===
          "Executing prepared statement: {sql} (parameters: {params}, types: {types})" &&
        entry.context?.sql === "UPDATE users SET name = ? WHERE id = ?",
    );
    expect(statementLog?.context).toEqual({
      params: ["alice", 1],
      sql: "UPDATE users SET name = ? WHERE id = ?",
      types: [ParameterType.STRING, ParameterType.INTEGER],
    });
  });

  it("applies logging middleware when Connection is constructed directly", async () => {
    const logger = new RecordingLogger();
    const nativeConnection = new SpyConnection();
    const connection = new Connection(
      {
        driver: "mysql2",
      },
      new SpyDriver(nativeConnection),
      new Configuration({ middlewares: [new Middleware(logger)] }),
    );

    await connection.executeQuery("SELECT 1");

    expect(nativeConnection.queriedSql).toEqual(["SELECT 1"]);
    expect(logger.entries).toContainEqual({
      context: { sql: "SELECT 1" },
      level: "debug",
      message: "Executing query: {sql}",
    });
  });

  it("preserves savepoint and quote behavior while logging transactions", async () => {
    const logger = new RecordingLogger();
    const nativeConnection = new SpyConnection();
    const connection = DriverManager.getConnection(
      {
        driverInstance: new SpyDriver(nativeConnection),
      },
      new Configuration({ middlewares: [new Middleware(logger)] }),
    );

    await connection.beginTransaction();
    await connection.beginTransaction();
    await connection.rollBack();
    await connection.commit();

    const quoted = await connection.quote("value");
    await connection.close();

    expect(nativeConnection.beginCalls).toBe(1);
    expect(nativeConnection.commitCalls).toBe(1);
    expect(nativeConnection.rollBackCalls).toBe(0);
    expect(nativeConnection.execSql).toEqual([
      "SAVEPOINT DATAZEN_2",
      "ROLLBACK TO SAVEPOINT DATAZEN_2",
    ]);
    expect(quoted).toBe("<value>");
    expect(nativeConnection.closeCalls).toBe(1);

    expect(logger.entries).toContainEqual({
      context: undefined,
      level: "debug",
      message: "Beginning transaction",
    });
    expect(logger.entries).toContainEqual({
      context: { sql: "SAVEPOINT DATAZEN_2" },
      level: "debug",
      message: "Executing statement: {sql}",
    });
    expect(logger.entries).toContainEqual({
      context: { sql: "ROLLBACK TO SAVEPOINT DATAZEN_2" },
      level: "debug",
      message: "Executing statement: {sql}",
    });
    expect(logger.entries).toContainEqual({
      context: undefined,
      level: "debug",
      message: "Committing transaction",
    });
    expect(logger.entries).toContainEqual({
      context: undefined,
      level: "info",
      message: "Disconnecting",
    });
  });
});
