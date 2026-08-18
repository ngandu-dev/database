import { describe, expect, it } from "vitest";

import { LockMode } from "../../lock-mode";
import { DB2Platform } from "../../platforms/db2-platform";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { OraclePlatform } from "../../platforms/oracle-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { TransactionIsolationLevel } from "../../transaction-isolation-level";

describe("Platform parity", () => {
  it("mysql applies offset-only limit semantics", () => {
    const platform = new MySQLPlatform();

    expect(platform.modifyLimitQuery("SELECT * FROM users", null, 5)).toBe(
      "SELECT * FROM users LIMIT 18446744073709551615 OFFSET 5",
    );
  });

  it("mysql escapes backslashes in string literals", () => {
    const platform = new MySQLPlatform();

    expect(platform.quoteStringLiteral("a\\b'c")).toBe("'a\\\\b''c'");
  });

  it("sql server injects ORDER BY when paginating unordered query", () => {
    const platform = new SQLServerPlatform();

    expect(platform.modifyLimitQuery("SELECT id FROM users", 10, 5)).toBe(
      "SELECT id FROM users ORDER BY (SELECT 0) OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY",
    );
  });

  it("sql server applies lock hints", () => {
    const platform = new SQLServerPlatform();

    expect(platform.appendLockHint("users u", LockMode.PESSIMISTIC_READ)).toBe(
      "users u WITH (HOLDLOCK, ROWLOCK)",
    );
    expect(platform.appendLockHint("users u", LockMode.PESSIMISTIC_WRITE)).toBe(
      "users u WITH (UPDLOCK, ROWLOCK)",
    );
  });

  it("oracle maps repeatable read to serializable", () => {
    const platform = new OraclePlatform();

    expect(platform.getSetTransactionIsolationSQL(TransactionIsolationLevel.REPEATABLE_READ)).toBe(
      "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE",
    );
  });

  it("db2 marks set transaction isolation as unsupported", () => {
    const platform = new DB2Platform();

    expect(() =>
      platform.getSetTransactionIsolationSQL(TransactionIsolationLevel.READ_COMMITTED),
    ).toThrowError();
  });

  it("db2 disables savepoints", () => {
    const platform = new DB2Platform();

    expect(platform.supportsSavepoints()).toBe(false);
  });
});
