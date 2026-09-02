import { describe, expect, it } from "vitest";

import { driverForDsn } from "../database/connection-factory";

describe("driverForDsn", () => {
  it.each([
    ["postgres://host/db", "pg"],
    ["postgresql://host/db", "pg"],
    ["pg://host/db", "pg"],
    ["mysql://host/db", "mysql2"],
    ["mysql2://host/db", "mysql2"],
    ["mariadb://host/db", "mysql2"],
    ["mssql://host/db", "mssql"],
    ["sqlserver://host/db", "mssql"],
    ["sqlite:///tmp/db.sqlite", "sqlite3"],
    ["sqlite3:///tmp/db.sqlite", "sqlite3"],
    ["file:///tmp/db.sqlite", "sqlite3"],
  ] as const)("maps %s to %s", (dsn, driver) => {
    expect(driverForDsn(dsn)).toBe(driver);
  });

  it("rejects unknown schemes", () => {
    expect(() => driverForDsn("oracle://host/db")).toThrow("Unsupported database URL scheme");
  });
});
