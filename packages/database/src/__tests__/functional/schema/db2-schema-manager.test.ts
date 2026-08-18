import { describe, expect, it } from "vitest";

import { DB2Platform } from "../../../platforms/db2-platform";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/Db2SchemaManagerTest", () => {
  const functional = useFunctionalTestCase();

  it("introspect database names", async ({ skip }) => {
    if (!(functional.connection().getDatabasePlatform() instanceof DB2Platform)) {
      skip();
    }

    await expect(
      (await functional.connection().createSchemaManager()).introspectDatabaseNames(),
    ).rejects.toThrow();
  });
});
