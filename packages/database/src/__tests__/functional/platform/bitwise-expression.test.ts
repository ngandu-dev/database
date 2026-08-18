import { describe, expect, it } from "vitest";

import type { AbstractPlatform } from "../../../platforms/abstract-platform";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/BitwiseExpressionTest", () => {
  const functional = useFunctionalTestCase();

  it("bitwise and", async () => {
    await assertExpressionEquals(functional, "2", (platform) =>
      platform.getBitAndComparisonExpression("3", "6"),
    );
  });

  it("bitwise or", async () => {
    await assertExpressionEquals(functional, "7", (platform) =>
      platform.getBitOrComparisonExpression("3", "6"),
    );
  });
});

async function assertExpressionEquals(
  functional: ReturnType<typeof useFunctionalTestCase>,
  expected: string,
  expression: (platform: AbstractPlatform) => string,
): Promise<void> {
  const platform = functional.connection().getDatabasePlatform();
  const query = platform.getDummySelectSQL(expression(platform));

  expect(String(await functional.connection().fetchOne(query))).toBe(expected);
}
