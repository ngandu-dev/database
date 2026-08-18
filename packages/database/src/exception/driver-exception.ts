import { Query } from "../query";
import { initializeException } from "./_internal";

export interface DriverExceptionDetails {
  driverName: string;
  operation: string;
  sql?: string;
  parameters?: unknown;
  code?: number | string;
  sqlState?: string;
  cause?: unknown;
}

export class DriverException extends Error {
  public readonly driverName: string;
  public readonly operation: string;
  public readonly sql?: string;
  public readonly parameters?: unknown;
  public readonly code?: number | string;
  public readonly sqlState?: string;
  private readonly query: Query | null;

  constructor(message: string, details: DriverExceptionDetails);
  constructor(driverException: Error, query?: Query | null);
  constructor(
    messageOrDriverException: string | Error,
    detailsOrQuery?: DriverExceptionDetails | Query | null,
  ) {
    if (typeof messageOrDriverException === "string") {
      const details = detailsOrQuery as DriverExceptionDetails;

      super(messageOrDriverException);
      initializeException(this, new.target);
      this.driverName = details.driverName;
      this.operation = details.operation;
      this.sql = details.sql;
      this.parameters = details.parameters;
      this.code = details.code;
      this.sqlState = details.sqlState;
      this.query = null;

      if (details.cause !== undefined) {
        Object.defineProperty(this, "cause", {
          configurable: true,
          enumerable: false,
          value: details.cause,
          writable: true,
        });
      }

      return;
    }

    const driverException = messageOrDriverException;
    const query = detailsOrQuery instanceof Query ? detailsOrQuery : null;
    const wrappedMessage =
      query !== null
        ? `An exception occurred while executing a query: ${driverException.message}`
        : `An exception occurred in the driver: ${driverException.message}`;

    super(wrappedMessage);
    initializeException(this, new.target);
    this.driverName = driverException.constructor.name || "driver";
    this.operation = query !== null ? "query" : "driver";
    this.sql = query?.sql;
    this.parameters = query?.parameters;
    this.code = this.readCode(driverException);
    this.sqlState = this.readSqlState(driverException);
    this.query = query;

    Object.defineProperty(this, "cause", {
      configurable: true,
      enumerable: false,
      value: driverException,
      writable: true,
    });
  }

  public getSQLState(): string | null {
    return this.sqlState ?? null;
  }

  public getQuery(): Query | null {
    return this.query;
  }

  private readCode(error: Error): number | string | undefined {
    const record = error as Error & { code?: unknown };
    return typeof record.code === "number" || typeof record.code === "string"
      ? record.code
      : undefined;
  }

  private readSqlState(error: Error): string | undefined {
    const record = error as Error & {
      getSQLState?: () => string | null;
      sqlState?: unknown;
      sqlstate?: unknown;
    };

    if (typeof record.getSQLState === "function") {
      const state = record.getSQLState();
      if (typeof state === "string") {
        return state;
      }
    }

    if (typeof record.sqlState === "string") {
      return record.sqlState;
    }

    if (typeof record.sqlstate === "string") {
      return record.sqlstate;
    }

    return undefined;
  }
}
