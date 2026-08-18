import { ConnectionException } from "../../../exception/connection-exception";
import { DriverException, type DriverExceptionDetails } from "../../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../../exception/invalid-field-name-exception";
import { LockWaitTimeoutException } from "../../../exception/lock-wait-timeout-exception";
import { NonUniqueFieldNameException } from "../../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../../exception/not-null-constraint-violation-exception";
import { ReadOnlyException } from "../../../exception/read-only-exception";
import { SyntaxErrorException } from "../../../exception/syntax-error-exception";
import { TableExistsException } from "../../../exception/table-exists-exception";
import { TableNotFoundException } from "../../../exception/table-not-found-exception";
import { UniqueConstraintViolationException } from "../../../exception/unique-constraint-violation-exception";
import type {
  ExceptionConverterContext,
  ExceptionConverter as ExceptionConverterInterface,
} from "../exception-converter";

export class ExceptionConverter implements ExceptionConverterInterface {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    const details = this.createDetails(error, context);
    const code = typeof details.code === "string" ? details.code.toUpperCase() : undefined;
    const message = details.message.toLowerCase();

    if (message.includes("database is locked")) {
      return new LockWaitTimeoutException(details.message, details);
    }

    if (
      message.includes("must be unique") ||
      message.includes("is not unique") ||
      message.includes("are not unique") ||
      message.includes("unique constraint failed")
    ) {
      return new UniqueConstraintViolationException(details.message, details);
    }

    if (message.includes("may not be null") || message.includes("not null constraint failed")) {
      return new NotNullConstraintViolationException(details.message, details);
    }

    if (message.includes("no such table:")) {
      return new TableNotFoundException(details.message, details);
    }

    if (message.includes("already exists")) {
      return new TableExistsException(details.message, details);
    }

    if (message.includes("has no column named")) {
      return new InvalidFieldNameException(details.message, details);
    }

    if (message.includes("ambiguous column name")) {
      return new NonUniqueFieldNameException(details.message, details);
    }

    if (message.includes("syntax error")) {
      return new SyntaxErrorException(details.message, details);
    }

    if (message.includes("attempt to write a readonly database")) {
      return new ReadOnlyException(details.message, details);
    }

    if (message.includes("unable to open database file")) {
      return new ConnectionException(details.message, details);
    }

    if (message.includes("foreign key constraint failed")) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") {
      return new LockWaitTimeoutException(details.message, details);
    }

    if (code === "SQLITE_CANTOPEN") {
      return new ConnectionException(details.message, details);
    }

    if (code?.startsWith("SQLITE_CONSTRAINT_FOREIGNKEY") === true) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (code?.startsWith("SQLITE_CONSTRAINT_NOTNULL") === true) {
      return new NotNullConstraintViolationException(details.message, details);
    }

    if (
      code?.startsWith("SQLITE_CONSTRAINT_UNIQUE") === true ||
      code?.startsWith("SQLITE_CONSTRAINT_PRIMARYKEY") === true
    ) {
      return new UniqueConstraintViolationException(details.message, details);
    }

    if (code === "SQLITE_ERROR" && message.includes("syntax")) {
      return new SyntaxErrorException(details.message, details);
    }

    return new DriverException(details.message, details);
  }

  private createDetails(
    error: unknown,
    context: ExceptionConverterContext,
  ): DriverExceptionDetails & { message: string } {
    const record = this.asRecord(error);
    const message = this.extractMessage(error);

    return {
      cause: error,
      code: this.extractCode(record),
      driverName: "sqlite3",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState: undefined,
    };
  }

  private extractCode(record: Record<string, unknown>): number | string | undefined {
    const code = record.code;
    if (typeof code === "string" || typeof code === "number") {
      return code;
    }

    const errno = record.errno;
    if (typeof errno === "number") {
      return errno;
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "sqlite3 driver error.";
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
