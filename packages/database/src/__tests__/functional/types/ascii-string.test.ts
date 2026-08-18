import { beforeEach, describe, expect, it } from "vitest";

import { ParameterType } from "../../../parameter-type";
import { Column } from "../../../schema/column";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Types/AsciiStringTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("ascii_table")
        .setColumns(
          Column.editor()
            .setUnquotedName("id")
            .setTypeName(Types.ASCII_STRING)
            .setLength(3)
            .setFixed(true)
            .create(),
          Column.editor()
            .setUnquotedName("val")
            .setTypeName(Types.ASCII_STRING)
            .setLength(4)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );
  });

  it("insert and select", async () => {
    await insert(functional, "id1", "val1");
    await insert(functional, "id2", "val2");

    expect(await select(functional, "id1")).toBe("val1");
    expect(await select(functional, "id2")).toBe("val2");
  });
});

async function insert(
  functional: ReturnType<typeof useFunctionalTestCase>,
  id: string,
  value: string,
): Promise<void> {
  const result = await functional.connection().insert(
    "ascii_table",
    {
      id,
      val: value,
    },
    [ParameterType.ASCII, ParameterType.ASCII],
  );

  expect(result).toBe(1);
}

async function select(
  functional: ReturnType<typeof useFunctionalTestCase>,
  id: string,
): Promise<string> {
  const value = await functional
    .connection()
    .fetchOne("SELECT val FROM ascii_table WHERE id = ?", [id], [ParameterType.ASCII]);

  expect(typeof value).toBe("string");
  return value as string;
}
