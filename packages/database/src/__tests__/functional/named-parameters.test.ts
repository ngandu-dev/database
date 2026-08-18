import { beforeEach, describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
import { ParameterType } from "../../parameter-type";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/NamedParametersTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("ddc1372_foobar")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
          Column.editor().setUnquotedName("foo").setTypeName(Types.STRING).setLength(1).create(),
          Column.editor().setUnquotedName("bar").setTypeName(Types.STRING).setLength(1).create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );

    const connection = functional.connection();
    await connection.insert("ddc1372_foobar", { id: 1, foo: 1, bar: 1 });
    await connection.insert("ddc1372_foobar", { id: 2, foo: 1, bar: 2 });
    await connection.insert("ddc1372_foobar", { id: 3, foo: 1, bar: 3 });
    await connection.insert("ddc1372_foobar", { id: 4, foo: 1, bar: 4 });
    await connection.insert("ddc1372_foobar", { id: 5, foo: 2, bar: 1 });
    await connection.insert("ddc1372_foobar", { id: 6, foo: 2, bar: 2 });
  });

  it.each(
    ticketProvider(),
  )("expands named parameters and array types correctly (%s)", async (query, params, types, expected) => {
    const rows = await functional.connection().fetchAllAssociative(query, params, types);
    const normalized = rows.map(normalizeRowForDoctrineStyleComparison);

    expect(normalized).toEqual(expected);
  });
});

function ticketProvider(): Array<
  [
    query: string,
    params: Record<string, unknown>,
    types: Record<string, unknown>,
    expected: Array<Record<string, unknown>>,
  ]
> {
  return [
    [
      "SELECT * FROM ddc1372_foobar f WHERE f.foo = :foo AND f.bar IN (:bar)",
      { foo: 1, bar: [1, 2, 3] },
      { foo: ParameterType.INTEGER, bar: ArrayParameterType.INTEGER },
      [
        { id: 1, foo: 1, bar: 1 },
        { id: 2, foo: 1, bar: 2 },
        { id: 3, foo: 1, bar: 3 },
      ],
    ],
    [
      "SELECT * FROM ddc1372_foobar f WHERE f.foo = :foo AND f.bar IN (:bar)",
      { foo: 1, bar: [1, 2, 3] },
      { bar: ArrayParameterType.INTEGER, foo: ParameterType.INTEGER },
      [
        { id: 1, foo: 1, bar: 1 },
        { id: 2, foo: 1, bar: 2 },
        { id: 3, foo: 1, bar: 3 },
      ],
    ],
    [
      "SELECT * FROM ddc1372_foobar f WHERE f.bar IN (:bar) AND f.foo = :foo",
      { foo: 1, bar: [1, 2, 3] },
      { bar: ArrayParameterType.INTEGER, foo: ParameterType.INTEGER },
      [
        { id: 1, foo: 1, bar: 1 },
        { id: 2, foo: 1, bar: 2 },
        { id: 3, foo: 1, bar: 3 },
      ],
    ],
    [
      "SELECT * FROM ddc1372_foobar f WHERE f.bar IN (:bar) AND f.foo = :foo",
      { foo: 1, bar: ["1", "2", "3"] },
      { bar: ArrayParameterType.STRING, foo: ParameterType.INTEGER },
      [
        { id: 1, foo: 1, bar: 1 },
        { id: 2, foo: 1, bar: 2 },
        { id: 3, foo: 1, bar: 3 },
      ],
    ],
    [
      "SELECT * FROM ddc1372_foobar f WHERE f.bar IN (:bar) AND f.foo IN (:foo)",
      { foo: ["1"], bar: [1, 2, 3, 4] },
      { bar: ArrayParameterType.STRING, foo: ArrayParameterType.INTEGER },
      [
        { id: 1, foo: 1, bar: 1 },
        { id: 2, foo: 1, bar: 2 },
        { id: 3, foo: 1, bar: 3 },
        { id: 4, foo: 1, bar: 4 },
      ],
    ],
    [
      "SELECT * FROM ddc1372_foobar f WHERE f.bar IN (:bar) AND f.foo IN (:foo)",
      { foo: 1, bar: 2 },
      { bar: ParameterType.INTEGER, foo: ParameterType.INTEGER },
      [{ id: 2, foo: 1, bar: 2 }],
    ],
    [
      "SELECT * FROM ddc1372_foobar f WHERE f.bar = :arg AND f.foo <> :arg",
      { arg: "1" },
      { arg: ParameterType.STRING },
      [{ id: 5, foo: 2, bar: 1 }],
    ],
    [
      "SELECT * FROM ddc1372_foobar f WHERE f.bar NOT IN (:arg) AND f.foo IN (:arg)",
      { arg: [1, 2] },
      { arg: ArrayParameterType.INTEGER },
      [
        { id: 3, foo: 1, bar: 3 },
        { id: 4, foo: 1, bar: 4 },
      ],
    ],
  ];
}

function normalizeRowForDoctrineStyleComparison(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const lowered = key.toLowerCase();

    if (typeof value === "string" && /^-?\d+$/.test(value)) {
      normalized[lowered] = Number(value);
      continue;
    }

    normalized[lowered] = value;
  }

  return normalized;
}
