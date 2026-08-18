import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { ParameterType } from "../../../parameter-type";
import { Column } from "../../../schema/column";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Type } from "../../../types/type";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Types/BinaryTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("binary_table")
        .setColumns(
          Column.editor()
            .setUnquotedName("id")
            .setTypeName(Types.BINARY)
            .setLength(16)
            .setFixed(true)
            .create(),
          Column.editor().setUnquotedName("val").setTypeName(Types.BINARY).setLength(64).create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );
  });

  it("insert and select", async () => {
    const id1 = randomBytes(16);
    const id2 = randomBytes(16);
    const value1 = randomBytes(64);
    const value2 = randomBytes(64);

    await insert(functional, id1, value1);
    await insert(functional, id2, value2);

    expect(await select(functional, id1)).toEqual(value1);
    expect(await select(functional, id2)).toEqual(value2);
  });
});

async function insert(
  functional: ReturnType<typeof useFunctionalTestCase>,
  id: Buffer,
  value: Buffer,
): Promise<void> {
  const result = await functional.connection().insert(
    "binary_table",
    {
      id,
      val: value,
    },
    [ParameterType.BINARY, ParameterType.BINARY],
  );

  expect(result).toBe(1);
}

async function select(
  functional: ReturnType<typeof useFunctionalTestCase>,
  id: Buffer,
): Promise<Buffer> {
  const raw = await functional
    .connection()
    .fetchOne("SELECT val FROM binary_table WHERE id = ?", [id], [ParameterType.BINARY]);
  const converted = Type.getType(Types.BINARY).convertToNodeValue(
    raw,
    functional.connection().getDatabasePlatform(),
  );

  if (converted instanceof Uint8Array) {
    return Buffer.from(converted);
  }

  if (typeof converted === "string") {
    return Buffer.from(converted, "binary");
  }

  throw new Error("Expected binary value to convert to Uint8Array or string.");
}
