import { describe, expect, it } from "vitest";

import { OraclePlatform } from "../../../platforms/oracle-platform";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/QuotingTest", () => {
  const functional = useFunctionalTestCase();

  for (const stringValue of ["\\", "'"] as const) {
    it(`quote string literal ${JSON.stringify(stringValue)}`, async () => {
      const platform = functional.connection().getDatabasePlatform();
      const query = platform.getDummySelectSQL(platform.quoteStringLiteral(stringValue));

      expect(await functional.connection().fetchOne(query)).toBe(stringValue);
    });
  }

  for (const identifier of ["[", "]", '"', "`"] as const) {
    it(`quote identifier ${JSON.stringify(identifier)}`, async ({ skip }) => {
      const platform = functional.connection().getDatabasePlatform();

      if (platform instanceof OraclePlatform && identifier === '"') {
        skip();
      }

      const query = platform.getDummySelectSQL(
        `NULL AS ${platform.quoteSingleIdentifier(identifier)}`,
      );
      const row = await functional.connection().fetchAssociative(query);

      expect(row).toBeDefined();
      if (row === undefined) {
        return;
      }

      expect(Object.keys(row)[0]).toBe(identifier);
    });
  }
});
