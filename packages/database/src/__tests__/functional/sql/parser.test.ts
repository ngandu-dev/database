import { describe, expect, it } from "vitest";

import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { PostgreSQLPlatform } from "../../../platforms/postgresql-platform";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/SQL/ParserTest", () => {
  const functional = useFunctionalTestCase();

  it("mysql escaping", async ({ skip }) => {
    const connection = functional.connection();

    if (!(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      skip();
    }

    const result = await connection.fetchNumeric("SELECT '\\'?', :parameter", {
      parameter: "value",
    });
    expect(result).toEqual(["'?", "value"]);
  });

  it("postgresql jsonb question operator", async ({ skip }) => {
    const connection = functional.connection();

    if (!(connection.getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      skip();
    }

    const result = await connection.fetchOne(`SELECT '{"a":null}'::jsonb ?? :key`, { key: "a" });

    expect(result === true || result === "1").toBe(true);
  });
});
