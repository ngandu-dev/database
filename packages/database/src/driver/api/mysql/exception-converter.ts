import { ConnectionException } from "../../../exception/connection-exception";
import { ConnectionLost } from "../../../exception/connection-lost";
import { DatabaseDoesNotExist } from "../../../exception/database-does-not-exist";
import { DeadlockException } from "../../../exception/deadlock-exception";
import { DriverException, type DriverExceptionDetails } from "../../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../../exception/invalid-field-name-exception";
import { LockWaitTimeoutException } from "../../../exception/lock-wait-timeout-exception";
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

const DATABASE_DOES_NOT_EXIST_CODES = new Set([1008]);
const TABLE_EXISTS_CODES = new Set([1050]);
const TABLE_NOT_FOUND_CODES = new Set([1051, 1146]);
const FOREIGN_KEY_CONSTRAINT_CODES = new Set([1216, 1217, 1451, 1452, 1701]);
const UNIQUE_CONSTRAINT_CODES = new Set([1062, 1557, 1569, 1586]);
const INVALID_FIELD_NAME_CODES = new Set([1054, 1166, 1611]);
const NON_UNIQUE_FIELD_NAME_CODES = new Set([1052, 1060, 1110]);
const NOT_NULL_CONSTRAINT_CODES = new Set([1048, 1121, 1138, 1171, 1252, 1263, 1364, 1566]);
const SQL_SYNTAX_CODES = new Set([
  1064, 1149, 1287, 1341, 1342, 1343, 1344, 1382, 1479, 1541, 1554, 1626,
]);
const CONNECTION_ERROR_CODES = new Set([
  1044, 1045, 1046, 1049, 1095, 1142, 1143, 1227, 1370, 1429, 2002, 2005, 2054,
]);
const CONNECTION_LOST_CODES = new Set([2006, 2013, 4031]);
const CONNECTION_LOST_STRINGS = new Set([
  "ECONNRESET",
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "PROTOCOL_ENQUEUE_AFTER_QUIT",
]);
const CONNECTION_ERROR_STRINGS = new Set([
  "ECONNREFUSED",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ETIMEDOUT",
]);

export class ExceptionConverter implements ExceptionConverterInterface {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    const details = this.createDetails(error, context);

    if (typeof details.code === "number" && DATABASE_DOES_NOT_EXIST_CODES.has(details.code)) {
      return new DatabaseDoesNotExist(details.message, details);
    }

    if (details.code === 1213) {
      return new DeadlockException(details.message, details);
    }

    if (details.code === 1205) {
      return new LockWaitTimeoutException(details.message, details);
    }

    if (typeof details.code === "number" && TABLE_EXISTS_CODES.has(details.code)) {
      return new TableExistsException(details.message, details);
    }

    if (typeof details.code === "number" && TABLE_NOT_FOUND_CODES.has(details.code)) {
      return new TableNotFoundException(details.message, details);
    }

    if (typeof details.code === "number" && FOREIGN_KEY_CONSTRAINT_CODES.has(details.code)) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (typeof details.code === "number" && UNIQUE_CONSTRAINT_CODES.has(details.code)) {
      return new UniqueConstraintViolationException(details.message, details);
    }

    if (typeof details.code === "number" && INVALID_FIELD_NAME_CODES.has(details.code)) {
      return new InvalidFieldNameException(details.message, details);
    }

    if (typeof details.code === "number" && NON_UNIQUE_FIELD_NAME_CODES.has(details.code)) {
      return new NonUniqueFieldNameException(details.message, details);
    }

    if (typeof details.code === "number" && NOT_NULL_CONSTRAINT_CODES.has(details.code)) {
      return new NotNullConstraintViolationException(details.message, details);
    }

    if (typeof details.code === "number" && SQL_SYNTAX_CODES.has(details.code)) {
      return new SyntaxErrorException(details.message, details);
    }

    if (typeof details.code === "number" && CONNECTION_LOST_CODES.has(details.code)) {
      return new ConnectionLost(details.message, details);
    }

    if (this.isConnectionLost(details.code, details.message)) {
      return new ConnectionLost(details.message, details);
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
      driverName: "mysql2",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState: this.extractSqlState(errorRecord),
    };
  }

  private extractCode(errorRecord: Record<string, unknown>): number | string | undefined {
    const errno = errorRecord.errno;
    if (typeof errno === "number") {
      return errno;
    }

    const code = errorRecord.code;
    if (typeof code === "number" || typeof code === "string") {
      return code;
    }

    return undefined;
  }

  private extractSqlState(errorRecord: Record<string, unknown>): string | undefined {
    const sqlState = errorRecord.sqlState;
    if (typeof sqlState === "string") {
      return sqlState;
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "mysql2 driver error.";
  }

  private isConnectionLost(code: number | string | undefined, message: string): boolean {
    if (typeof code === "number") {
      return CONNECTION_LOST_CODES.has(code);
    }

    if (typeof code === "string" && CONNECTION_LOST_STRINGS.has(code)) {
      return true;
    }

    const normalizedMessage = message.toLowerCase();
    return (
      normalizedMessage.includes("socket has been ended by the other party") ||
      normalizedMessage.includes("server has gone away") ||
      normalizedMessage.includes("lost connection to mysql server") ||
      normalizedMessage.includes("closed state")
    );
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

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
