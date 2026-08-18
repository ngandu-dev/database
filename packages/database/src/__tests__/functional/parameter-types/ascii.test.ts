import { describe, expect, it } from "vitest";

import { ParameterType } from "../../../parameter-type";
import { SQLServerPlatform } from "../../../platforms/sqlserver-platform";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/ParameterTypes/AsciiTest", () => {
  const functional = useFunctionalTestCase();

  it("ascii binding", async ({ skip }) => {
    const connection = functional.connection();

    if (!(connection.getDatabasePlatform() instanceof SQLServerPlatform)) {
      skip();
    }

    const statement = await connection.prepare("SELECT sql_variant_property(?, 'BaseType')");
    statement.bindValue(1, "test", ParameterType.ASCII);

    const result = (await statement.executeQuery()).fetchOne();
    expect(String(result).toLowerCase()).toBe("varchar");
  });
});
