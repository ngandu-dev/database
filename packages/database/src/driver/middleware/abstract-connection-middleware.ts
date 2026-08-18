import type { Connection as DriverConnection } from "../connection";

export abstract class AbstractConnectionMiddleware implements DriverConnection {
  constructor(private readonly wrappedConnection: DriverConnection) {}

  public prepare(sql: string): ReturnType<DriverConnection["prepare"]> {
    return this.wrappedConnection.prepare(sql);
  }

  public query(sql: string): ReturnType<DriverConnection["query"]> {
    return this.wrappedConnection.query(sql);
  }

  public quote(value: string): string {
    return this.wrappedConnection.quote(value);
  }

  public exec(sql: string): ReturnType<DriverConnection["exec"]> {
    return this.wrappedConnection.exec(sql);
  }

  public lastInsertId(): ReturnType<DriverConnection["lastInsertId"]> {
    return this.wrappedConnection.lastInsertId();
  }

  public beginTransaction(): ReturnType<DriverConnection["beginTransaction"]> {
    return this.wrappedConnection.beginTransaction();
  }

  public commit(): ReturnType<DriverConnection["commit"]> {
    return this.wrappedConnection.commit();
  }

  public rollBack(): ReturnType<DriverConnection["rollBack"]> {
    return this.wrappedConnection.rollBack();
  }

  public getServerVersion(): ReturnType<DriverConnection["getServerVersion"]> {
    return this.wrappedConnection.getServerVersion();
  }

  public getNativeConnection(): unknown {
    return this.wrappedConnection.getNativeConnection();
  }

  public async close(): Promise<void> {
    const closable = this.wrappedConnection as DriverConnection & { close?: () => Promise<void> };
    await closable.close?.();
  }
}
