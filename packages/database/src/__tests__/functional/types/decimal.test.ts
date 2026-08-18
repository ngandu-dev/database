import { describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Type } from "../../../types/type";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Types/DecimalTest", () => {
  const functional = useFunctionalTestCase();

  it.each(["13.37", "13.0"] as const)("insert and retrieve decimal (%s)", async (expected) => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("decimal_table")
        .setColumns(
          Column.editor()
            .setUnquotedName("val")
            .setTypeName(Types.DECIMAL)
            .setPrecision(4)
            .setScale(2)
            .create(),
        )
        .create(),
    );

    await functional
      .connection()
      .insert("decimal_table", { val: expected }, { val: Types.DECIMAL });

    const value = Type.getType(Types.DECIMAL).convertToNodeValue(
      await functional.connection().fetchOne("SELECT val FROM decimal_table"),
      functional.connection().getDatabasePlatform(),
    );

    expect(typeof value).toBe("string");
    expect(stripTrailingZero(value as string)).toBe(stripTrailingZero(expected));
  });
});

function stripTrailingZero(value: string): string {
  return value.replace(/\.?0+$/, "");
}
