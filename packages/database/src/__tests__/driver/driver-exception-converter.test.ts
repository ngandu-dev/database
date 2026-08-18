import { describe, expect, it } from "vitest";

import { ExceptionConverter as MySQLExceptionConverter } from "../../driver/api/mysql/exception-converter";
import { ExceptionConverter as PostgreSQLExceptionConverter } from "../../driver/api/postgresql/exception-converter";
import { ExceptionConverter as SQLiteExceptionConverter } from "../../driver/api/sqlite/exception-converter";
import { ExceptionConverter as SQLServerExceptionConverter } from "../../driver/api/sqlserver/exception-converter";
import { ConnectionException } from "../../exception/connection-exception";
import { ConnectionLost } from "../../exception/connection-lost";
import { DatabaseDoesNotExist } from "../../exception/database-does-not-exist";
import { DatabaseObjectNotFoundException } from "../../exception/database-object-not-found-exception";
import { DeadlockException } from "../../exception/deadlock-exception";
import { DriverException } from "../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../exception/invalid-field-name-exception";
import { LockWaitTimeoutException } from "../../exception/lock-wait-timeout-exception";
import { NonUniqueFieldNameException } from "../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../exception/not-null-constraint-violation-exception";
import { ReadOnlyException } from "../../exception/read-only-exception";
import { SchemaDoesNotExist } from "../../exception/schema-does-not-exist";
import { SyntaxErrorException } from "../../exception/syntax-error-exception";
import { TableExistsException } from "../../exception/table-exists-exception";
import { TableNotFoundException } from "../../exception/table-not-found-exception";
import { UniqueConstraintViolationException } from "../../exception/unique-constraint-violation-exception";
import { Query } from "../../query";

describe("Driver exception converters", () => {
  it("maps mysql duplicate key to UniqueConstraintViolationException", () => {
    const converter = new MySQLExceptionConverter();
    const error = Object.assign(new Error("Duplicate entry '1' for key 'PRIMARY'"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
      sqlState: "23000",
    });

    const converted = converter.convert(error, {
      operation: "executeStatement",
      query: new Query("INSERT INTO users (id) VALUES (?)", [1]),
    });

    expect(converted).toBeInstanceOf(UniqueConstraintViolationException);
    expect(converted.code).toBe(1062);
    expect(converted.sqlState).toBe("23000");
    expect(converted.sql).toBe("INSERT INTO users (id) VALUES (?)");
    expect(converted.parameters).toEqual([1]);
  });

  it("maps mysql deadlock error code", () => {
    const converter = new MySQLExceptionConverter();
    const error = Object.assign(new Error("Deadlock found when trying to get lock"), {
      errno: 1213,
    });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(DeadlockException);
    expect(converted.operation).toBe("executeQuery");
  });

  it.each([
    [1008, DatabaseDoesNotExist],
    [1205, LockWaitTimeoutException],
    [1050, TableExistsException],
    [1146, TableNotFoundException],
    [1054, InvalidFieldNameException],
    [1060, NonUniqueFieldNameException],
    [2006, ConnectionLost],
    [4031, ConnectionLost],
    [1048, NotNullConstraintViolationException],
    [1064, SyntaxErrorException],
  ])("maps mysql code %s to %p", (errno, expectedClass) => {
    const converter = new MySQLExceptionConverter();
    const error = Object.assign(new Error(`mysql error ${errno}`), { errno });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(expectedClass);
    expect(converted.code).toBe(errno);
  });

  it("maps mysql connection failures from string codes", () => {
    const converter = new MySQLExceptionConverter();
    const error = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });

    const converted = converter.convert(error, { operation: "connect" });

    expect(converted).toBeInstanceOf(ConnectionException);
    expect(converted.code).toBe("ECONNREFUSED");
  });

  it.each([
    ["40001", DeadlockException],
    ["40P01", DeadlockException],
    ["23502", NotNullConstraintViolationException],
    ["23503", ForeignKeyConstraintViolationException],
    ["23505", UniqueConstraintViolationException],
    ["3D000", DatabaseDoesNotExist],
    ["3F000", SchemaDoesNotExist],
    ["42601", SyntaxErrorException],
    ["42702", NonUniqueFieldNameException],
    ["42703", InvalidFieldNameException],
    ["42P01", TableNotFoundException],
    ["42P07", TableExistsException],
    ["08006", ConnectionException],
  ])("maps pg SQLSTATE %s to %p", (sqlState, expectedClass) => {
    const converter = new PostgreSQLExceptionConverter();
    const error = Object.assign(new Error(`pg error ${sqlState}`), { code: sqlState });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(expectedClass);
    expect(converted.sqlState).toBe(sqlState);
  });

  it("maps pg 0A000 TRUNCATE feature-not-supported errors to foreign key violations", () => {
    const converter = new PostgreSQLExceptionConverter();
    const error = Object.assign(
      new Error("cannot truncate a table referenced in a foreign key constraint"),
      { code: "0A000" },
    );

    const converted = converter.convert(error, { operation: "executeStatement" });

    expect(converted).toBeInstanceOf(ForeignKeyConstraintViolationException);
    expect(converted.sqlState).toBe("0A000");
  });

  it("maps pg terminating connection messages to ConnectionLost", () => {
    const converter = new PostgreSQLExceptionConverter();
    const error = Object.assign(new Error("terminating connection due to administrator command"), {
      code: "57P01",
    });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(ConnectionLost);
    expect(converted.constructor).toBe(ConnectionLost);
    expect(converted.sqlState).toBe("57P01");
  });

  it.each([
    ["database is locked", LockWaitTimeoutException],
    ["UNIQUE constraint failed: users.email", UniqueConstraintViolationException],
    ["column foo may not be NULL", NotNullConstraintViolationException],
    ["NOT NULL constraint failed: users.email", NotNullConstraintViolationException],
    ["no such table: users", TableNotFoundException],
    ["table users already exists", TableExistsException],
    ["table users has no column named emali", InvalidFieldNameException],
    ["ambiguous column name: id", NonUniqueFieldNameException],
    ['near "FROM": syntax error', SyntaxErrorException],
    ["attempt to write a readonly database", ReadOnlyException],
    ["unable to open database file", ConnectionException],
    ["FOREIGN KEY constraint failed", ForeignKeyConstraintViolationException],
  ])('maps sqlite message "%s" to %p', (message, expectedClass) => {
    const converter = new SQLiteExceptionConverter();
    const error = Object.assign(new Error(message), { code: "SQLITE_ERROR" });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(expectedClass);
  });

  it("falls back to DriverException for unmapped sqlite errors", () => {
    const converter = new SQLiteExceptionConverter();
    const error = Object.assign(new Error("some sqlite failure"), { code: "SQLITE_ERROR" });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(DriverException);
  });

  it("maps mssql not null constraint violations", () => {
    const converter = new SQLServerExceptionConverter();
    const error = Object.assign(new Error("Cannot insert the value NULL"), {
      code: "EREQUEST",
      number: 515,
    });

    const converted = converter.convert(error, { operation: "executeStatement" });

    expect(converted).toBeInstanceOf(NotNullConstraintViolationException);
    expect(converted.code).toBe(515);
  });

  it.each([
    [102, SyntaxErrorException],
    [207, InvalidFieldNameException],
    [208, TableNotFoundException],
    [209, NonUniqueFieldNameException],
    [515, NotNullConstraintViolationException],
    [547, ForeignKeyConstraintViolationException],
    [4712, ForeignKeyConstraintViolationException],
    [2601, UniqueConstraintViolationException],
    [2627, UniqueConstraintViolationException],
    [2714, TableExistsException],
    [3701, DatabaseObjectNotFoundException],
    [15151, DatabaseObjectNotFoundException],
    [11001, ConnectionException],
    [18456, ConnectionException],
  ])("maps mssql code %s to %p", (number, expectedClass) => {
    const converter = new SQLServerExceptionConverter();
    const error = Object.assign(new Error(`mssql error ${number}`), { number });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(expectedClass);
    expect(converted.code).toBe(number);
  });

  it("maps mssql foreign key violations", () => {
    const converter = new SQLServerExceptionConverter();
    const error = Object.assign(new Error("The DELETE statement conflicted with the REFERENCE"), {
      number: 547,
    });

    const converted = converter.convert(error, { operation: "executeStatement" });

    expect(converted).toBeInstanceOf(ForeignKeyConstraintViolationException);
  });

  it("maps mssql syntax and unique violations", () => {
    const converter = new SQLServerExceptionConverter();
    const syntaxError = Object.assign(new Error("Incorrect syntax near 'FROM'"), { number: 102 });
    const uniqueError = Object.assign(new Error("Violation of UNIQUE KEY constraint"), {
      number: 2627,
    });

    expect(converter.convert(syntaxError, { operation: "executeQuery" })).toBeInstanceOf(
      SyntaxErrorException,
    );
    expect(converter.convert(uniqueError, { operation: "executeStatement" })).toBeInstanceOf(
      UniqueConstraintViolationException,
    );
  });

  it("falls back to DriverException for unmapped driver exceptions", () => {
    const converter = new SQLServerExceptionConverter();
    const error = Object.assign(new Error("Unknown driver failure"), { code: "EREQUEST" });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(DriverException);
    expect(converted).not.toBeInstanceOf(ConnectionException);
  });
});
