import { describe, expect, it } from "vitest";

import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/ModExpressionTest", () => {
  const functional = useFunctionalTestCase();

  it("mod expression", async () => {
    const platform = functional.connection().getDatabasePlatform();
    const query = platform.getDummySelectSQL(platform.getModExpression("5", "2"));

    expect(String(await functional.connection().fetchOne(query))).toBe("1");
  });
});
