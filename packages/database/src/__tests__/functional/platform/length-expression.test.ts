import { describe, expect, it } from "vitest";

import { SQLServerPlatform } from "../../../platforms/sqlserver-platform";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/LengthExpressionTest", () => {
  const functional = useFunctionalTestCase();

  for (const [value, expected, isMultibyte] of [
    ["Hello, world!", 13, false],
    ["Привет, мир!", 12, true],
    ["你好，世界", 5, true],
    ["💩", 1, true],
  ] as const) {
    it(`length expression: ${JSON.stringify(value)}`, async ({ skip }) => {
      const connection = functional.connection();
      const platform = connection.getDatabasePlatform();

      if (isMultibyte && platform instanceof SQLServerPlatform) {
        const version = Number(
          await connection.fetchOne("SELECT SERVERPROPERTY('ProductMajorVersion')"),
        );

        if (version < 15) {
          skip();
        }

        if (value === "💩") {
          const collation = String(
            await connection.fetchOne(
              "SELECT CONVERT(sysname, DATABASEPROPERTYEX(DB_NAME(), 'Collation'))",
            ),
          ).toUpperCase();

          if (!collation.includes("_UTF8")) {
            skip();
          }
        }
      }

      const query = platform.getDummySelectSQL(platform.getLengthExpression("?"));
      expect(Number(await connection.fetchOne(query, [value]))).toBe(expected);
    });
  }
});
