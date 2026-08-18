import { ConnectionException } from "../../../exception/connection-exception";
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

const FOREIGN_KEY_CONSTRAINT_CODES = new Set([-530, -531, -532, -20356]);
const CONNECTION_CODES = new Set([-1336, -30082]);
export class ExceptionConverter implements ExceptionConverterInterface {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    const details = this.createDetails(error, context);

    if (details.code === -104) {
      return new SyntaxErrorException(details.message, details);
    }

    if (details.code === -407) {
      return new NotNullConstraintViolationException(details.message, details);
    }

    if (details.code === -203) {
      return new NonUniqueFieldNameException(details.message, details);
    }

    if (details.code === -204) {
      return new TableNotFoundException(details.message, details);
    }

    if (details.code === -206) {
      return new InvalidFieldNameException(details.message, details);
    }

    if (details.code === -601) {
      return new TableExistsException(details.message, details);
    }

    if (details.code === -803) {
      return new UniqueConstraintViolationException(details.message, details);
    }

    if (typeof details.code === "number" && FOREIGN_KEY_CONSTRAINT_CODES.has(details.code)) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (typeof details.code === "number" && CONNECTION_CODES.has(details.code)) {
      return new ConnectionException(details.message, details);
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
      driverName: "db2",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState: this.extractSqlState(record, message),
    };
  }

  private extractCode(record: Record<string, unknown>): number | string | undefined {
    const candidates: unknown[] = [record.sqlcode, record.sqlCode, record.code];

    for (const candidate of candidates) {
      if (typeof candidate === "number") {
        return candidate;
      }

      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed.length === 0) {
          continue;
        }

        const parsed = Number(trimmed);
        if (Number.isInteger(parsed)) {
          return parsed;
        }

        return candidate;
      }
    }

    return undefined;
  }

  private extractSqlState(record: Record<string, unknown>, message: string): string | undefined {
    const candidates: unknown[] = [record.sqlstate, record.sqlState, record.state];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate;
      }
    }

    const match = /SQLSTATE[=\s:]+([0-9A-Z]{5})/i.exec(message);
    if (match?.[1] !== undefined) {
      return match[1].toUpperCase();
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "db2 driver error.";
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
