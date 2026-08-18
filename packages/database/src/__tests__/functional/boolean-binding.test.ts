import { beforeEach, describe, expect, it } from "vitest";

import { ParameterType } from "../../parameter-type";
import { Column } from "../../schema/column";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/BooleanBindingTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("boolean_test_table")
        .setColumns(
          Column.editor()
            .setUnquotedName("val")
            .setTypeName(Types.BOOLEAN)
            .setNotNull(false)
            .create(),
        )
        .create(),
    );
  });

  it.each([
    true,
    false,
    null,
  ] as const)("binds boolean parameter values via ParameterType::BOOLEAN (%s)", async (input) => {
    const connection = functional.connection();
    const qb = connection.createQueryBuilder();

    const affected = await qb
      .insert("boolean_test_table")
      .values({ val: qb.createNamedParameter(input, ParameterType.BOOLEAN) })
      .executeStatement();

    expect(affected).toBe(1);
    expect(
      connection.convertToNodeValue(
        await connection.fetchOne("SELECT val FROM boolean_test_table"),
        Types.BOOLEAN,
      ),
    ).toBe(input);
  });

  it.each([
    true,
    false,
    null,
  ] as const)("binds boolean parameter values via Datazen type name (%s)", async (input) => {
    const connection = functional.connection();
    const qb = connection.createQueryBuilder();

    const affected = await qb
      .insert("boolean_test_table")
      .values({ val: qb.createNamedParameter(input, Types.BOOLEAN) })
      .executeStatement();

    expect(affected).toBe(1);
    expect(
      connection.convertToNodeValue(
        await connection.fetchOne("SELECT val FROM boolean_test_table"),
        Types.BOOLEAN,
      ),
    ).toBe(input);
  });
});
