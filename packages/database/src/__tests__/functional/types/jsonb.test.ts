import { describe, expect, it } from "vitest";

import { PostgreSQLPlatform } from "../../../platforms/postgresql-platform";
import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Types/JsonbTest", () => {
  const functional = useFunctionalTestCase();

  it("jsonb column introspection", async ({ skip }) => {
    const connection = functional.connection();

    if (!(connection.getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("test_jsonb")
      .setColumns(Column.editor().setUnquotedName("v").setTypeName(Types.JSONB).create())
      .create();

    await functional.dropAndCreateTable(table);

    const schemaManager = await connection.createSchemaManager();
    const comparator = schemaManager.createComparator();
    const actual = await schemaManager.introspectTableByUnquotedName("test_jsonb");

    const actualToDesired = comparator.compareTables(actual, table);
    const desiredToActual = comparator.compareTables(table, actual);

    expect(actualToDesired === null || actualToDesired.isEmpty()).toBe(true);
    expect(desiredToActual === null || desiredToActual.isEmpty()).toBe(true);
  });
});
