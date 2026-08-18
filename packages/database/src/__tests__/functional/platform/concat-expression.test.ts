import { describe, expect, it } from "vitest";

import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/ConcatExpressionTest", () => {
  const functional = useFunctionalTestCase();

  it.each([
    [["'foo'", "'bar'"], "foobar"],
    [["2010", "'-'", "2019"], "2010-2019"],
  ] as const)("concat expression", async (argumentsList, expected) => {
    const platform = functional.connection().getDatabasePlatform();
    const query = platform.getDummySelectSQL(platform.getConcatExpression(...argumentsList));

    expect(String(await functional.connection().fetchOne(query))).toBe(expected);
  });
});
