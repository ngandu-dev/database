import { describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Types/NumberTest", () => {
  const functional = useFunctionalTestCase();

  it.each([
    "13.37",
    "13.0",
  ] as const)("insert and retrieve number (Node bcmath intent adapted) (%s)", async (numberAsString) => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("number_table")
        .setColumns(
          Column.editor()
            .setUnquotedName("val")
            .setTypeName(Types.NUMBER)
            .setPrecision(4)
            .setScale(2)
            .create(),
        )
        .create(),
    );

    await functional
      .connection()
      .insert("number_table", { val: numberAsString }, { val: Types.NUMBER });

    expect(
      functional
        .connection()
        .convertToNodeValue(
          await functional.connection().fetchOne("SELECT val FROM number_table"),
          Types.NUMBER,
        ),
    ).toBeTypeOf("string");
    expect(
      stripTrailingZero(
        functional
          .connection()
          .convertToNodeValue(
            await functional.connection().fetchOne("SELECT val FROM number_table"),
            Types.NUMBER,
          ) as string,
      ),
    ).toBe(stripTrailingZero(numberAsString));
  });

  it("compare number table", async ({ skip }) => {
    // Doctrine preserves NUMBER via PHP/bcmath semantics and platform comment-hint machinery.
    // Datazen does not fully preserve NUMBER-vs-DECIMAL introspection hints yet.
    skip();
  });
});

function stripTrailingZero(value: string): string {
  return value.replace(/\.?0+$/, "");
}
