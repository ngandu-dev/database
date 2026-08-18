import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/FetchBooleanTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;

  beforeEach(async () => {
    connection = functional.connection();
  });

  it.each([
    ["true", true],
    ["false", false],
  ])("fetches native boolean literal %s", async (literal, expected) => {
    if (!(connection.getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      return;
    }

    expect(
      await connection.fetchNumeric(connection.getDatabasePlatform().getDummySelectSQL(literal)),
    ).toEqual([expected]);
  });
});
