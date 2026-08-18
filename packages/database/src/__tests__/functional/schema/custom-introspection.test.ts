import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Type } from "../../../types/type";
import { TypeRegistry } from "../../../types/type-registry";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";
import { MoneyType } from "./types/money-type";

describe("Functional/Schema/CustomIntrospectionTest", () => {
  const functional = useFunctionalTestCase();
  const originalRegistry = Type.getTypeRegistry();

  beforeAll(() => {
    Type.setTypeRegistry(new TypeRegistry(originalRegistry.getMap()));
    if (!Type.hasType(MoneyType.NAME)) {
      Type.addType(MoneyType.NAME, new MoneyType());
    }
  });

  afterAll(() => {
    Type.setTypeRegistry(originalRegistry);
  });

  it("custom column introspection", async ({ skip }) => {
    if (!(functional.connection().getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      skip();
    }

    const table = Table.editor()
      .setUnquotedName("test_custom_column_introspection")
      .setColumns(
        Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
        Column.editor()
          .setUnquotedName("quantity")
          .setTypeName(Types.DECIMAL)
          .setPrecision(10)
          .setScale(2)
          .setNotNull(false)
          .create(),
        Column.editor()
          .setUnquotedName("amount")
          .setTypeName(MoneyType.NAME)
          .setPrecision(10)
          .setScale(2)
          .setNotNull(false)
          .create(),
      )
      .create();

    await functional.dropAndCreateTable(table);

    const schemaManager = await functional.connection().createSchemaManager();
    const onlineTable = await schemaManager.introspectTableByUnquotedName(
      "test_custom_column_introspection",
    );
    const diff = schemaManager.createComparator().compareTables(onlineTable, table);

    expect(diff).not.toBeNull();
    expect(diff?.isEmpty()).toBe(true);
  });
});
