import type { Connection as DriverConnection } from "../driver/connection";
import { Converter } from "./converter";
import { Result } from "./result";
import { DriverStatementWrapper } from "./statement";

export class Connection implements DriverConnection {
  public static readonly PORTABILITY_ALL = 255;
  public static readonly PORTABILITY_NONE = 0;
  public static readonly PORTABILITY_RTRIM = 1;
  public static readonly PORTABILITY_EMPTY_TO_NULL = 4;
  public static readonly PORTABILITY_FIX_CASE = 8;

  constructor(
    private readonly connection: DriverConnection,
    private readonly converter: Converter,
  ) {}

  public async prepare(sql: string): Promise<Awaited<ReturnType<DriverConnection["prepare"]>>> {
    const statement = await this.connection.prepare(sql);
    return new DriverStatementWrapper(statement, this.converter);
  }

  public async query(sql: string): Promise<Awaited<ReturnType<DriverConnection["query"]>>> {
    const result = await this.connection.query(sql);
    return new Result(result, this.converter);
  }

  public quote(value: string): string {
    return this.connection.quote(value);
  }

  public async exec(sql: string): Promise<number | string> {
    return this.connection.exec(sql);
  }

  public async lastInsertId(): Promise<number | string> {
    return this.connection.lastInsertId();
  }

  public async beginTransaction(): Promise<void> {
    await this.connection.beginTransaction();
  }

  public async commit(): Promise<void> {
    await this.connection.commit();
  }

  public async rollBack(): Promise<void> {
    await this.connection.rollBack();
  }

  public async getServerVersion(): Promise<string> {
    return this.connection.getServerVersion();
  }

  public async close(): Promise<void> {
    const closable = this.connection as DriverConnection & { close?: () => Promise<void> };
    await closable.close?.();
  }

  public getNativeConnection(): unknown {
    return this.connection.getNativeConnection();
  }
}
