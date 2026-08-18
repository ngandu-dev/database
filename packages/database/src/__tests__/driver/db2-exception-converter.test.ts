import { describe, expect, it } from "vitest";

import { ExceptionConverter as DB2ExceptionConverter } from "../../driver/api/db2/exception-converter";
import { ConnectionException } from "../../exception/connection-exception";
import { DriverException } from "../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../exception/invalid-field-name-exception";
import { NonUniqueFieldNameException } from "../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../exception/not-null-constraint-violation-exception";
import { SyntaxErrorException } from "../../exception/syntax-error-exception";
import { TableExistsException } from "../../exception/table-exists-exception";
import { TableNotFoundException } from "../../exception/table-not-found-exception";
import { UniqueConstraintViolationException } from "../../exception/unique-constraint-violation-exception";
import { Query } from "../../query";

describe("DB2 ExceptionConverter", () => {
  it.each([
    [-104, SyntaxErrorException],
    [-203, NonUniqueFieldNameException],
    [-204, TableNotFoundException],
    [-206, InvalidFieldNameException],
    [-407, NotNullConstraintViolationException],
    [-530, ForeignKeyConstraintViolationException],
    [-531, ForeignKeyConstraintViolationException],
    [-532, ForeignKeyConstraintViolationException],
    [-20356, ForeignKeyConstraintViolationException],
    [-601, TableExistsException],
    [-803, UniqueConstraintViolationException],
    [-1336, ConnectionException],
    [-30082, ConnectionException],
  ])("maps DB2 SQLCODE %s to %p", (sqlcode, expectedClass) => {
    const converter = new DB2ExceptionConverter();
    const converted = converter.convert(
      Object.assign(new Error(`DB2 SQLCODE ${sqlcode}`), { sqlcode }),
      {
        operation: sqlcode === -1336 || sqlcode === -30082 ? "connect" : "executeQuery",
      },
    );

    expect(converted).toBeInstanceOf(expectedClass);
    expect(converted.code).toBe(sqlcode);
  });

  it("captures query metadata and sqlstate", () => {
    const converter = new DB2ExceptionConverter();
    const query = new Query("SELECT * FROM users WHERE id = ?", [7]);
    const error = Object.assign(new Error("SQL0204N USERS not found. SQLSTATE=42704"), {
      sqlcode: "-204",
    });

    const converted = converter.convert(error, { operation: "executeQuery", query });

    expect(converted).toBeInstanceOf(TableNotFoundException);
    expect(converted.code).toBe(-204);
    expect(converted.sqlState).toBe("42704");
    expect(converted.sql).toBe("SELECT * FROM users WHERE id = ?");
    expect(converted.parameters).toEqual([7]);
    expect(converted.driverName).toBe("db2");
  });

  it("falls back to DriverException for unknown codes", () => {
    const converter = new DB2ExceptionConverter();
    const error = Object.assign(new Error("Unknown DB2 driver failure"), { code: "SOMETHING" });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(DriverException);
    expect(converted).not.toBeInstanceOf(ConnectionException);
    expect(converted.code).toBe("SOMETHING");
  });
});
