import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { OraclePlatform } from "../../platforms/oracle-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { Identifier } from "../../schema/identifier";

describe("Platform keyword lists", () => {
  it("detects reserved keywords case-insensitively", () => {
    const mysql = new MySQLPlatform();
    const sqlServer = new SQLServerPlatform();
    const oracle = new OraclePlatform();

    expect(mysql.getReservedKeywordsList().isKeyword("select")).toBe(true);
    expect(sqlServer.getReservedKeywordsList().isKeyword("transaction")).toBe(true);
    expect(oracle.getReservedKeywordsList().isKeyword("group")).toBe(true);
  });

  it("reuses the same keyword list instance per platform", () => {
    const mysql = new MySQLPlatform();

    const listA = mysql.getReservedKeywordsList();
    const listB = mysql.getReservedKeywordsList();

    expect(listA).toBe(listB);
  });

  it("quotes reserved identifiers via schema assets", () => {
    const mysql = new MySQLPlatform();

    expect(new Identifier("users").getQuotedName(mysql)).toBe("users");
    expect(new Identifier("select").getQuotedName(mysql)).toBe("`select`");
    expect(new Identifier("app.select").getQuotedName(mysql)).toBe("app.`select`");
  });
});
