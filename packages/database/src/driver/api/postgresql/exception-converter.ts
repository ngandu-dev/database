import { ConnectionException } from "../../../exception/connection-exception";
import { ConnectionLost } from "../../../exception/connection-lost";
import { DatabaseDoesNotExist } from "../../../exception/database-does-not-exist";
import { DeadlockException } from "../../../exception/deadlock-exception";
import { DriverException, type DriverExceptionDetails } from "../../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../../exception/invalid-field-name-exception";
import { NonUniqueFieldNameException } from "../../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../../exception/not-null-constraint-violation-exception";
import { SchemaDoesNotExist } from "../../../exception/schema-does-not-exist";
import { SyntaxErrorException } from "../../../exception/syntax-error-exception";
import { TableExistsException } from "../../../exception/table-exists-exception";
import { TableNotFoundException } from "../../../exception/table-not-found-exception";
import { UniqueConstraintViolationException } from "../../../exception/unique-constraint-violation-exception";
import type {
  ExceptionConverterContext,
  ExceptionConverter as ExceptionConverterInterface,
} from "../exception-converter";

const UNIQUE_CONSTRAINT_SQLSTATES = new Set(["23505"]);
const FOREIGN_KEY_CONSTRAINT_SQLSTATES = new Set(["23503"]);
const NOT_NULL_CONSTRAINT_SQLSTATES = new Set(["23502"]);
const DEADLOCK_SQLSTATES = new Set(["40001", "40P01"]);
const SYNTAX_SQLSTATES = new Set(["42601"]);
const CONNECTION_SQLSTATES = new Set(["57P01", "57P02", "57P03"]);

export class ExceptionConverter implements ExceptionConverterInterface {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    const details = this.createDetails(error, context);

    if (details.sqlState !== undefined && DEADLOCK_SQLSTATES.has(details.sqlState)) {
      return new DeadlockException(details.message, details);
    }

    if (details.sqlState === "0A000" && details.message.toLowerCase().includes("truncate")) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (details.sqlState !== undefined && UNIQUE_CONSTRAINT_SQLSTATES.has(details.sqlState)) {
      return new UniqueConstraintViolationException(details.message, details);
    }

    if (details.sqlState !== undefined && FOREIGN_KEY_CONSTRAINT_SQLSTATES.has(details.sqlState)) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (details.sqlState !== undefined && NOT_NULL_CONSTRAINT_SQLSTATES.has(details.sqlState)) {
      return new NotNullConstraintViolationException(details.message, details);
    }

    if (details.sqlState !== undefined && SYNTAX_SQLSTATES.has(details.sqlState)) {
      return new SyntaxErrorException(details.message, details);
    }

    if (details.sqlState === "42702") {
      return new NonUniqueFieldNameException(details.message, details);
    }

    if (details.sqlState === "42703") {
      return new InvalidFieldNameException(details.message, details);
    }

    if (details.sqlState === "42P01") {
      return new TableNotFoundException(details.message, details);
    }

    if (details.sqlState === "42P07") {
      return new TableExistsException(details.message, details);
    }

    if (details.sqlState === "3D000") {
      return new DatabaseDoesNotExist(details.message, details);
    }

    if (details.sqlState === "3F000") {
      return new SchemaDoesNotExist(details.message, details);
    }

    if (details.sqlState === "08006") {
      return new ConnectionException(details.message, details);
    }

    if (this.isConnectionLostMessage(details.message)) {
      return new ConnectionLost(details.message, details);
    }

    if (this.isConnectionError(details)) {
      return new ConnectionException(details.message, details);
    }

    return new DriverException(details.message, details);
  }

  private createDetails(
    error: unknown,
    context: ExceptionConverterContext,
  ): DriverExceptionDetails & { message: string } {
    const record = this.asRecord(error);
    const code = this.extractCode(record);
    const sqlState = this.extractSqlState(record);
    const message = this.extractMessage(error);

    return {
      cause: error,
      code,
      driverName: "pg",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState,
    };
  }

  private extractCode(record: Record<string, unknown>): number | string | undefined {
    const code = record.code;
    if (typeof code === "string" || typeof code === "number") {
      return code;
    }

    return undefined;
  }

  private extractSqlState(record: Record<string, unknown>): string | undefined {
    const state = record.code;
    if (typeof state === "string") {
      return state;
    }

    const sqlState = record.sqlState;
    if (typeof sqlState === "string") {
      return sqlState;
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "pg driver error.";
  }

  private isConnectionError(details: { code?: number | string; sqlState?: string }): boolean {
    if (details.sqlState !== undefined) {
      if (details.sqlState.startsWith("08") || CONNECTION_SQLSTATES.has(details.sqlState)) {
        return true;
      }
    }

    if (typeof details.code === "string") {
      return details.code.startsWith("ECONN") || details.code === "ETIMEDOUT";
    }

    return false;
  }

  private isConnectionLostMessage(message: string): boolean {
    const normalized = message.toLowerCase();

    return (
      normalized.includes("terminating connection") ||
      normalized.includes("not queryable") ||
      normalized.includes("connection terminated unexpectedly") ||
      normalized.includes("server closed the connection unexpectedly")
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
