import { ConnectionException } from "../../../exception/connection-exception";
import { DatabaseDoesNotExist } from "../../../exception/database-does-not-exist";
import { DatabaseObjectNotFoundException } from "../../../exception/database-object-not-found-exception";
import { DriverException, type DriverExceptionDetails } from "../../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../../exception/invalid-field-name-exception";
import { NonUniqueFieldNameException } from "../../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../../exception/not-null-constraint-violation-exception";
import { SyntaxErrorException } from "../../../exception/syntax-error-exception";
import { TableExistsException } from "../../../exception/table-exists-exception";
import { TableNotFoundException } from "../../../exception/table-not-found-exception";
import { TransactionRolledBack } from "../../../exception/transaction-rolled-back";
import { UniqueConstraintViolationException } from "../../../exception/unique-constraint-violation-exception";
import type {
  ExceptionConverterContext,
  ExceptionConverter as ExceptionConverterInterface,
} from "../exception-converter";

const UNIQUE_CONSTRAINT_CODES = new Set([1, 2299, 38911]);
const NON_UNIQUE_FIELD_NAME_CODES = new Set([918, 960]);
const CONNECTION_CODES = new Set([1017, 12545]);
const FOREIGN_KEY_CONSTRAINT_CODES = new Set([2266, 2291, 2292]);
const DATABASE_OBJECT_NOT_FOUND_CODES = new Set([2289, 2443, 4080]);

export class ExceptionConverter implements ExceptionConverterInterface {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    const details = this.createDetails(error, context);

    if (typeof details.code === "number" && UNIQUE_CONSTRAINT_CODES.has(details.code)) {
      return new UniqueConstraintViolationException(details.message, details);
    }

    if (details.code === 923) {
      return new SyntaxErrorException(details.message, details);
    }

    if (details.code === 904) {
      return new InvalidFieldNameException(details.message, details);
    }

    if (typeof details.code === "number" && NON_UNIQUE_FIELD_NAME_CODES.has(details.code)) {
      return new NonUniqueFieldNameException(details.message, details);
    }

    if (details.code === 942) {
      return new TableNotFoundException(details.message, details);
    }

    if (details.code === 955) {
      return new TableExistsException(details.message, details);
    }

    if (details.code === 1400) {
      return new NotNullConstraintViolationException(details.message, details);
    }

    if (details.code === 1918) {
      return new DatabaseDoesNotExist(details.message, details);
    }

    if (typeof details.code === "number" && CONNECTION_CODES.has(details.code)) {
      return new ConnectionException(details.message, details);
    }

    if (details.code === 2091) {
      const rolledBackReason = this.convertRolledBackCause(error, context);
      if (rolledBackReason !== null) {
        return new TransactionRolledBack(details.message, {
          ...details,
          cause: rolledBackReason,
        });
      }

      return new DriverException(details.message, details);
    }

    if (typeof details.code === "number" && FOREIGN_KEY_CONSTRAINT_CODES.has(details.code)) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (typeof details.code === "number" && DATABASE_OBJECT_NOT_FOUND_CODES.has(details.code)) {
      return new DatabaseObjectNotFoundException(details.message, details);
    }

    return new DriverException(details.message, details);
  }

  private convertRolledBackCause(
    error: unknown,
    context: ExceptionConverterContext,
  ): DriverException | null {
    const message = this.extractMessage(error);
    const lines = message.split(/\r?\n/, 2);

    if (lines.length < 2) {
      return null;
    }

    const causeMessage = lines[1];
    if (causeMessage === undefined || causeMessage.length === 0) {
      return null;
    }

    const causeCode = this.parseOracleCodeFromString(causeMessage);
    const record: Record<string, unknown> = {
      code: causeCode ?? this.extractCode(this.asRecord(error)),
      message: causeMessage,
      sqlState: this.extractSqlState(this.asRecord(error), message),
    };

    const nestedError = this.createNestedError(causeMessage, record);

    return this.convert(nestedError, context);
  }

  private createNestedError(
    causeMessage: string,
    record: Record<string, unknown>,
  ): Error & Record<string, unknown> {
    const nested = new Error(causeMessage) as Error & Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      nested[key] = value;
    }

    return nested;
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
      driverName: "oci8",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState: this.extractSqlState(record, message),
    };
  }

  private extractCode(record: Record<string, unknown>): number | string | undefined {
    const candidates: unknown[] = [record.errorNum, record.errornum, record.code, record.errno];

    for (const candidate of candidates) {
      if (typeof candidate === "number") {
        return candidate;
      }

      if (typeof candidate === "string") {
        const parsedOraCode = this.parseOracleCodeFromString(candidate);
        if (parsedOraCode !== undefined) {
          return parsedOraCode;
        }

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

    if (typeof record.message === "string") {
      const parsedFromMessage = this.parseOracleCodeFromString(record.message);
      if (parsedFromMessage !== undefined) {
        return parsedFromMessage;
      }
    }

    return undefined;
  }

  private extractSqlState(record: Record<string, unknown>, message: string): string | undefined {
    const candidates: unknown[] = [record.sqlState, record.sqlstate, record.state];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate;
      }
    }

    const bracketed = /SQLSTATE\[([0-9A-Z]{5})\]/i.exec(message);
    if (bracketed?.[1] !== undefined) {
      return bracketed[1].toUpperCase();
    }

    const inline = /SQLSTATE[=\s:]+([0-9A-Z]{5})/i.exec(message);
    if (inline?.[1] !== undefined) {
      return inline[1].toUpperCase();
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    const record = this.asRecord(error);
    if (typeof record.message === "string" && record.message.length > 0) {
      return record.message;
    }

    return "oci driver error.";
  }

  private parseOracleCodeFromString(value: string): number | undefined {
    const match = /ORA-(\d{3,5})/i.exec(value);
    if (match?.[1] === undefined) {
      return undefined;
    }

    const parsed = Number(match[1]);

    return Number.isInteger(parsed) ? parsed : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
