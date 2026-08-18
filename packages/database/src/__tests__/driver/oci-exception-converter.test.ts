import { describe, expect, it } from "vitest";

import { ExceptionConverter as OCIExceptionConverter } from "../../driver/api/oci/exception-converter";
import { ConnectionException } from "../../exception/connection-exception";
import { DatabaseDoesNotExist } from "../../exception/database-does-not-exist";
import { DatabaseObjectNotFoundException } from "../../exception/database-object-not-found-exception";
import { DriverException } from "../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../exception/invalid-field-name-exception";
import { NonUniqueFieldNameException } from "../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../exception/not-null-constraint-violation-exception";
import { SyntaxErrorException } from "../../exception/syntax-error-exception";
import { TableExistsException } from "../../exception/table-exists-exception";
import { TableNotFoundException } from "../../exception/table-not-found-exception";
import { TransactionRolledBack } from "../../exception/transaction-rolled-back";
import { UniqueConstraintViolationException } from "../../exception/unique-constraint-violation-exception";
import { Query } from "../../query";

describe("OCI ExceptionConverter", () => {
  it.each([
    [1, UniqueConstraintViolationException],
    [2299, UniqueConstraintViolationException],
    [38911, UniqueConstraintViolationException],
    [904, InvalidFieldNameException],
    [918, NonUniqueFieldNameException],
    [960, NonUniqueFieldNameException],
    [923, SyntaxErrorException],
    [942, TableNotFoundException],
    [955, TableExistsException],
    [1017, ConnectionException],
    [12545, ConnectionException],
    [1400, NotNullConstraintViolationException],
    [1918, DatabaseDoesNotExist],
    [2289, DatabaseObjectNotFoundException],
    [2443, DatabaseObjectNotFoundException],
    [4080, DatabaseObjectNotFoundException],
    [2266, ForeignKeyConstraintViolationException],
    [2291, ForeignKeyConstraintViolationException],
    [2292, ForeignKeyConstraintViolationException],
  ])("maps Oracle code %s to %p", (code, expectedClass) => {
    const converter = new OCIExceptionConverter();
    const operation = code === 1017 || code === 12545 ? "connect" : "executeQuery";
    const error = Object.assign(new Error(`ORA-${String(code).padStart(5, "0")}: test`), {
      errorNum: code,
    });

    const converted = converter.convert(error, { operation });

    expect(converted).toBeInstanceOf(expectedClass);
    expect(converted.code).toBe(code);
  });

  it("captures query metadata and SQLSTATE for mapped Oracle errors", () => {
    const converter = new OCIExceptionConverter();
    const query = new Query("SELECT missing_col FROM users", []);
    const error = Object.assign(new Error("SQLSTATE[HY000]: ORA-00904: invalid identifier"), {
      code: "ORA-00904",
    });

    const converted = converter.convert(error, { operation: "executeQuery", query });

    expect(converted).toBeInstanceOf(InvalidFieldNameException);
    expect(converted.code).toBe(904);
    expect(converted.sqlState).toBe("HY000");
    expect(converted.sql).toBe("SELECT missing_col FROM users");
    expect(converted.driverName).toBe("oci8");
  });

  it("wraps ORA-02091 as TransactionRolledBack with converted nested Oracle cause", () => {
    const converter = new OCIExceptionConverter();
    const error = new Error(
      "ORA-02091: transaction rolled back\nORA-00001: unique constraint (APP.USERS_PK) violated",
    );
    const query = new Query("COMMIT");

    const converted = converter.convert(Object.assign(error, { errorNum: 2091 }), {
      operation: "commit",
      query,
    });

    expect(converted).toBeInstanceOf(TransactionRolledBack);
    expect(converted.code).toBe(2091);
    expect(converted.operation).toBe("commit");
    expect(converted.sql).toBe("COMMIT");

    const cause = (converted as Error & { cause?: unknown }).cause;
    expect(cause).toBeInstanceOf(UniqueConstraintViolationException);
    expect((cause as DriverException).code).toBe(1);
  });

  it("falls back to DriverException for unknown codes", () => {
    const converter = new OCIExceptionConverter();
    const error = Object.assign(new Error("ORA-99999: unknown"), { errorNum: 99999 });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(DriverException);
    expect(converted).not.toBeInstanceOf(ConnectionException);
    expect(converted.code).toBe(99999);
  });
});
