import { describe, expect, it } from "vitest";

import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/LikeWildcardsEscapingTest", () => {
  const functional = useFunctionalTestCase();

  it("fetches LIKE expression result with escaped wildcards", async () => {
    const connection = functional.connection();
    const platform = connection.getDatabasePlatform();
    const source = "_25% off_ your next purchase \\o/ [$] (^_^)";
    const escapeChar = "!";
    const escaped = platform.escapeStringForLike(source, escapeChar);

    const sql = platform.getDummySelectSQL(
      `(CASE WHEN '${source.replace(/'/g, "''")}' LIKE '${escaped}' ESCAPE '${escapeChar}' THEN 1 ELSE 0 END)`,
    );

    const result = await (await connection.prepare(sql)).executeQuery();
    expect(Boolean(result.fetchOne())).toBe(true);
  });
});
