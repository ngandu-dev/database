import { beforeEach, describe, expect, it } from "vitest";

import { ParameterType } from "../../../parameter-type";
import { Column } from "../../../schema/column";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Type } from "../../../types/type";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Types/JsonTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("json_test_table")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
          Column.editor().setUnquotedName("val").setTypeName(Types.JSON).create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );
  });

  it("insert and select", async () => {
    const value1 = {
      firstKey: "firstVal",
      secondKey: "secondVal",
      nestedKey: {
        nestedKey1: "nestedVal1",
        nestedKey2: 2,
      },
    };
    const value2 = JSON.parse('{"key1":"Val1","key2":2,"key3":"Val3"}') as Record<string, unknown>;

    await insert(functional, 1, value1);
    await insert(functional, 2, value2);

    expect(sortObject(await select(functional, 1))).toEqual(sortObject(value1));
    expect(sortObject(await select(functional, 2))).toEqual(sortObject(value2));
  });
});

async function insert(
  functional: ReturnType<typeof useFunctionalTestCase>,
  id: number,
  value: Record<string, unknown>,
): Promise<void> {
  const result = await functional.connection().insert(
    "json_test_table",
    {
      id,
      val: value,
    },
    [ParameterType.INTEGER, Type.getType(Types.JSON)],
  );

  expect(result).toBe(1);
}

async function select(
  functional: ReturnType<typeof useFunctionalTestCase>,
  id: number,
): Promise<Record<string, unknown>> {
  const value = await functional
    .connection()
    .fetchOne("SELECT val FROM json_test_table WHERE id = ?", [id], [ParameterType.INTEGER]);

  const decoded = functional.connection().convertToNodeValue(value, Types.JSON);
  expect(decoded).not.toBeNull();
  expect(typeof decoded).toBe("object");
  expect(Array.isArray(decoded)).toBe(false);
  return decoded as Record<string, unknown>;
}

function sortObject<T extends Record<string, unknown>>(value: T): T {
  const sortedEntries = Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, itemValue]) => {
      if (itemValue !== null && typeof itemValue === "object" && !Array.isArray(itemValue)) {
        return [key, sortObject(itemValue as Record<string, unknown>)];
      }

      return [key, itemValue];
    });

  return Object.fromEntries(sortedEntries) as T;
}
