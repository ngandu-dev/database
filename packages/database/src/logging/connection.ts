import type { Connection as DriverConnection } from "../driver/connection";
import type { Logger } from "./logger";
import { DriverStatementWrapper } from "./statement";

export class Connection implements DriverConnection {
  constructor(
    private readonly connection: DriverConnection,
    private readonly logger: Logger,
  ) {}

  public async prepare(sql: string): Promise<Awaited<ReturnType<DriverConnection["prepare"]>>> {
    this.logger.debug("Preparing statement: {sql}", { sql });

    const statement = await this.connection.prepare(sql);
    return new DriverStatementWrapper(statement, this.logger, sql);
  }

  public async query(sql: string): Promise<Awaited<ReturnType<DriverConnection["query"]>>> {
    this.logger.debug("Executing query: {sql}", { sql });
    return this.connection.query(sql);
  }

  public quote(value: string): string {
    return this.connection.quote(value);
  }

  public async exec(sql: string): Promise<number | string> {
    this.logger.debug("Executing statement: {sql}", { sql });
    return this.connection.exec(sql);
  }

  public async lastInsertId(): Promise<number | string> {
    return this.connection.lastInsertId();
  }

  public async beginTransaction(): Promise<void> {
    this.logger.debug("Beginning transaction");
    await this.connection.beginTransaction();
  }

  public async commit(): Promise<void> {
    this.logger.debug("Committing transaction");
    await this.connection.commit();
  }

  public async rollBack(): Promise<void> {
    this.logger.debug("Rolling back transaction");
    await this.connection.rollBack();
  }

  public async getServerVersion(): Promise<string> {
    return this.connection.getServerVersion();
  }

  public async close(): Promise<void> {
    this.logger.info("Disconnecting");
    const closable = this.connection as DriverConnection & { close?: () => Promise<void> };
    await closable.close?.();
  }

  public getNativeConnection(): unknown {
    return this.connection.getNativeConnection();
  }
}
