import { ConnectionException } from "../../../exception/connection-exception";
import { DatabaseObjectNotFoundException } from "../../../exception/database-object-not-found-exception";
import { DeadlockException } from "../../../exception/deadlock-exception";
import { DriverException, type DriverExceptionDetails } from "../../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../../exception/invalid-field-name-exception";
import { NonUniqueFieldNameException } from "../../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../../exception/not-null-constraint-violation-exception";
import { SyntaxErrorException } from "../../../exception/syntax-error-exception";
import { TableExistsException } from "../../../exception/table-exists-exception";
import { TableNotFoundException } from "../../../exception/table-not-found-exception";
import { UniqueConstraintViolationException } from "../../../exception/unique-constraint-violation-exception";
import type {
  ExceptionConverterContext,
  ExceptionConverter as ExceptionConverterInterface,
} from "../exception-converter";

const FOREIGN_KEY_CONSTRAINT_CODES = new Set([547, 4712]);
const UNIQUE_CONSTRAINT_CODES = new Set([2601, 2627]);
const DATABASE_OBJECT_NOT_FOUND_CODES = new Set([3701, 15151]);
const CONNECTION_ERROR_CODES = new Set([11001, 18456]);
const CONNECTION_ERROR_STRINGS = new Set([
  "EALREADYBEGUN",
  "EALREADYCONNECTED",
  "ECANCEL",
  "ECONNCLOSED",
  "ECONNRESET",
  "EINSTLOOKUP",
  "ELOGIN",
  "ESOCKET",
  "ETIMEOUT",
]);
const SQL_SYNTAX_CODES = new Set([102, 156]);

export class ExceptionConverter implements ExceptionConverterInterface {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    const details = this.createDetails(error, context);

    if (details.code === 1205) {
      return new DeadlockException(details.message, details);
    }

    if (details.code === 515) {
      return new NotNullConstraintViolationException(details.message, details);
    }

    if (details.code === 207) {
      return new InvalidFieldNameException(details.message, details);
    }

    if (details.code === 208) {
      return new TableNotFoundException(details.message, details);
    }

    if (details.code === 209) {
      return new NonUniqueFieldNameException(details.message, details);
    }

    if (typeof details.code === "number" && FOREIGN_KEY_CONSTRAINT_CODES.has(details.code)) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (typeof details.code === "number" && UNIQUE_CONSTRAINT_CODES.has(details.code)) {
      return new UniqueConstraintViolationException(details.message, details);
    }

    if (details.code === 2714) {
      return new TableExistsException(details.message, details);
    }

    if (typeof details.code === "number" && DATABASE_OBJECT_NOT_FOUND_CODES.has(details.code)) {
      return new DatabaseObjectNotFoundException(details.message, details);
    }

    if (typeof details.code === "number" && SQL_SYNTAX_CODES.has(details.code)) {
      return new SyntaxErrorException(details.message, details);
    }

    if (this.isConnectionError(details.code)) {
      return new ConnectionException(details.message, details);
    }

    return new DriverException(details.message, details);
  }

  private createDetails(
    error: unknown,
    context: ExceptionConverterContext,
  ): DriverExceptionDetails & { message: string } {
    const errorRecord = this.asRecord(error);
    const code = this.extractCode(errorRecord);
    const message = this.extractMessage(error);

    return {
      cause: error,
      code,
      driverName: "mssql",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState: this.extractSqlState(errorRecord),
    };
  }

  private extractCode(errorRecord: Record<string, unknown>): number | string | undefined {
    const candidates: unknown[] = [
      errorRecord.number,
      this.getNestedValue(errorRecord, "originalError", "info", "number"),
      this.getNestedValue(errorRecord, "originalError", "number"),
      errorRecord.code,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "number" || typeof candidate === "string") {
        return candidate;
      }
    }

    return undefined;
  }

  private extractSqlState(errorRecord: Record<string, unknown>): string | undefined {
    const candidates: unknown[] = [
      errorRecord.sqlState,
      errorRecord.sqlstate,
      errorRecord.state,
      this.getNestedValue(errorRecord, "originalError", "info", "state"),
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        return candidate;
      }
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "mssql driver error.";
  }

  private isConnectionError(code: number | string | undefined): boolean {
    if (typeof code === "number") {
      return CONNECTION_ERROR_CODES.has(code);
    }

    if (typeof code === "string") {
      return CONNECTION_ERROR_STRINGS.has(code);
    }

    return false;
  }

  private getNestedValue(record: Record<string, unknown>, ...keys: string[]): unknown {
    let current: unknown = record;
    for (const key of keys) {
      if (current === null || typeof current !== "object") {
        return undefined;
      }

      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
