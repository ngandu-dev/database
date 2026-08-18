import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { OraclePlatform } from "../../platforms/oracle-platform";
import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { Identifier } from "../../schema/identifier";

describe("Schema/AbstractAsset (Doctrine parity, adapted)", () => {
  it.each([
    ["select", new OraclePlatform()],
    ["SELECT", new PostgreSQLPlatform()],
    ['"_".id', new OraclePlatform()],
    ['"_".ID', new PostgreSQLPlatform()],
    ['"example.com"', new MySQLPlatform()],
    ["", new MySQLPlatform()],
    ["schema.table", new MySQLPlatform()],
    ['"select"', new OraclePlatform()],
    ['"SELECT"', new PostgreSQLPlatform()],
    ["SELECT", new OraclePlatform()],
    ["select", new PostgreSQLPlatform()],
    ["SELECT", new MySQLPlatform()],
    ["select", new MySQLPlatform()],
    ["id", new OraclePlatform()],
    ["ID", new OraclePlatform()],
    ["id", new PostgreSQLPlatform()],
    ["ID", new PostgreSQLPlatform()],
  ])("quotes representative identifier %s without throwing", (name, platform) => {
    expect(() => new Identifier(name).getQuotedName(platform)).not.toThrow();
    expect(typeof new Identifier(name).getQuotedName(platform)).toBe("string");
  });

  it.skip("Doctrine deprecation-only constructor-without-args case is not modeled in TypeScript");
  it.skip("Doctrine deprecation-only parser creation fallback case is not modeled in Node");
});
