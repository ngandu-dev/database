import { describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
import { MissingNamedParameter } from "../../array-parameters/exception/missing-named-parameter";
import { MissingPositionalParameter } from "../../array-parameters/exception/missing-positional-parameter";
import { ExpandArrayParameters } from "../../expand-array-parameters";
import { ParameterType } from "../../parameter-type";
import type { QueryParameterTypes, QueryParameters, QueryScalarParameterType } from "../../query";
import { Parser } from "../../sql/parser";

function expand(
  sql: string,
  parameters: QueryParameters,
  types: QueryParameterTypes,
): {
  parameters: unknown[];
  sql: string;
  types: QueryScalarParameterType[];
} {
  const visitor = new ExpandArrayParameters(parameters, types);
  new Parser(true).parse(sql, visitor);

  return {
    parameters: visitor.getParameters(),
    sql: visitor.getSQL(),
    types: visitor.getTypes(),
  };
}

type ExpandCase = {
  name: string;
  sql: string;
  parameters: QueryParameters;
  types: QueryParameterTypes;
  expectedSQL: string;
  expectedParameters: unknown[];
  expectedTypes: QueryScalarParameterType[];
};

const doctrineExpandCases: ExpandCase[] = [
  {
    name: "Positional: Very simple with one needle",
    sql: "SELECT * FROM Foo WHERE foo IN (?)",
    parameters: [[1, 2, 3]],
    types: [ArrayParameterType.INTEGER],
    expectedSQL: "SELECT * FROM Foo WHERE foo IN (?, ?, ?)",
    expectedParameters: [1, 2, 3],
    expectedTypes: [ParameterType.INTEGER, ParameterType.INTEGER, ParameterType.INTEGER],
  },
  {
    name: "Positional: One non-list before and one after list-needle",
    sql: "SELECT * FROM Foo WHERE foo = ? AND bar IN (?) AND baz = ?",
    parameters: [1, [1, 2, 3], 4],
    types: [ParameterType.INTEGER, ArrayParameterType.INTEGER, ParameterType.INTEGER],
    expectedSQL: "SELECT * FROM Foo WHERE foo = ? AND bar IN (?, ?, ?) AND baz = ?",
    expectedParameters: [1, 1, 2, 3, 4],
    expectedTypes: [
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
    ],
  },
  {
    name: "Positional: Empty integer array",
    sql: "SELECT * FROM Foo WHERE foo IN (?)",
    parameters: [[]],
    types: [ArrayParameterType.INTEGER],
    expectedSQL: "SELECT * FROM Foo WHERE foo IN (NULL)",
    expectedParameters: [],
    expectedTypes: [],
  },
  {
    name: "Positional: explicit keys for params and types",
    sql: "SELECT * FROM Foo WHERE foo = ? AND bar = ? AND baz = ?",
    parameters: Object.assign([], { 1: "bar", 2: "baz", 0: 1 }) as unknown[],
    types: Object.assign([], {
      2: ParameterType.STRING,
      1: ParameterType.STRING,
    }) as QueryParameterTypes,
    expectedSQL: "SELECT * FROM Foo WHERE foo = ? AND bar = ? AND baz = ?",
    expectedParameters: Object.assign([], { 1: "bar", 0: 1, 2: "baz" }) as unknown[],
    expectedTypes: Object.assign([], {
      1: ParameterType.STRING,
      2: ParameterType.STRING,
    }) as QueryScalarParameterType[],
  },
  {
    name: "Named: Very simple with param int and string",
    sql: "SELECT * FROM Foo WHERE foo = :foo AND bar = :bar",
    parameters: { bar: "Some String", foo: 1 },
    types: { foo: ParameterType.INTEGER, bar: ParameterType.STRING },
    expectedSQL: "SELECT * FROM Foo WHERE foo = ? AND bar = ?",
    expectedParameters: [1, "Some String"],
    expectedTypes: [ParameterType.INTEGER, ParameterType.STRING],
  },
  {
    name: "Named: Very simple with one needle",
    sql: "SELECT * FROM Foo WHERE foo IN (:foo)",
    parameters: { foo: [1, 2, 3] },
    types: { foo: ArrayParameterType.INTEGER },
    expectedSQL: "SELECT * FROM Foo WHERE foo IN (?, ?, ?)",
    expectedParameters: [1, 2, 3],
    expectedTypes: [ParameterType.INTEGER, ParameterType.INTEGER, ParameterType.INTEGER],
  },
  {
    name: "Named: Same name appears twice",
    sql: "SELECT * FROM Foo WHERE foo <> :arg AND bar = :arg",
    parameters: { arg: "Some String" },
    types: { arg: ParameterType.STRING },
    expectedSQL: "SELECT * FROM Foo WHERE foo <> ? AND bar = ?",
    expectedParameters: ["Some String", "Some String"],
    expectedTypes: [ParameterType.STRING, ParameterType.STRING],
  },
  {
    name: "Named: Array parameter reused twice",
    sql: "SELECT * FROM Foo WHERE foo IN (:arg) AND NOT bar IN (:arg)",
    parameters: { arg: [1, 2, 3] },
    types: { arg: ArrayParameterType.INTEGER },
    expectedSQL: "SELECT * FROM Foo WHERE foo IN (?, ?, ?) AND NOT bar IN (?, ?, ?)",
    expectedParameters: [1, 2, 3, 1, 2, 3],
    expectedTypes: [
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
    ],
  },
  {
    name: "Named: Empty arrays",
    sql: "SELECT * FROM Foo WHERE foo IN (:foo) OR bar IN (:bar)",
    parameters: { foo: [], bar: [] },
    types: { foo: ArrayParameterType.STRING, bar: ArrayParameterType.STRING },
    expectedSQL: "SELECT * FROM Foo WHERE foo IN (NULL) OR bar IN (NULL)",
    expectedParameters: [],
    expectedTypes: [],
  },
  {
    name: "Named: partially implicit types preserve sparse converted types",
    sql: "SELECT * FROM Foo WHERE foo IN (:foo) OR bar = :bar OR baz = :baz",
    parameters: { foo: [1, 2], bar: "bar", baz: "baz" },
    types: { foo: ArrayParameterType.INTEGER, baz: "string" },
    expectedSQL: "SELECT * FROM Foo WHERE foo IN (?, ?) OR bar = ? OR baz = ?",
    expectedParameters: [1, 2, "bar", "baz"],
    expectedTypes: Object.assign([], {
      0: ParameterType.INTEGER,
      1: ParameterType.INTEGER,
      3: "string",
    }) as QueryScalarParameterType[],
  },
  {
    name: "Named: no type on second parameter stays untyped",
    sql: "SELECT * FROM Foo WHERE foo = :foo OR bar = :bar",
    parameters: { foo: "foo", bar: "bar" },
    types: { foo: ParameterType.INTEGER },
    expectedSQL: "SELECT * FROM Foo WHERE foo = ? OR bar = ?",
    expectedParameters: ["foo", "bar"],
    expectedTypes: [ParameterType.INTEGER],
  },
  {
    name: "Untyped array value is not expanded",
    sql: "SELECT * FROM users WHERE id IN (:ids)",
    parameters: { ids: [1, 2, 3] },
    types: { ids: ParameterType.INTEGER },
    expectedSQL: "SELECT * FROM users WHERE id IN (?)",
    expectedParameters: [[1, 2, 3]],
    expectedTypes: [ParameterType.INTEGER],
  },
];

describe("ExpandArrayParameters", () => {
  describe.each(doctrineExpandCases)("$name", (testCase) => {
    it("rewrites SQL, parameters, and types", () => {
      const result = expand(testCase.sql, testCase.parameters, testCase.types);

      expect(result.sql).toBe(testCase.expectedSQL);
      expect(result.parameters).toEqual(testCase.expectedParameters);
      expect(result.types).toEqual(testCase.expectedTypes);
    });
  });

  it("does not parse placeholders inside string literals", () => {
    const result = expand(
      "SELECT ':not_a_param' AS value, col FROM users WHERE id = :id",
      { id: 1 },
      { id: ParameterType.INTEGER },
    );

    expect(result.sql).toBe("SELECT ':not_a_param' AS value, col FROM users WHERE id = ?");
    expect(result.parameters).toEqual([1]);
  });

  it("does not parse placeholders inside comments", () => {
    const oneLine = expand(
      "SELECT 1 -- :ignored ? \nFROM users WHERE id = :id",
      { id: 7 },
      { id: ParameterType.INTEGER },
    );
    const multiLine = expand(
      "SELECT /* :ignored ? */ id FROM users WHERE status = :status",
      { status: "active" },
      { status: ParameterType.STRING },
    );

    expect(oneLine.sql).toBe("SELECT 1 -- :ignored ? \nFROM users WHERE id = ?");
    expect(oneLine.parameters).toEqual([7]);
    expect(multiLine.sql).toBe("SELECT /* :ignored ? */ id FROM users WHERE status = ?");
    expect(multiLine.parameters).toEqual(["active"]);
  });

  it("preserves postgres cast operators and repeated colon tokens", () => {
    const cast = expand(
      "SELECT :value::int AS val",
      { value: "10" },
      { value: ParameterType.STRING },
    );
    const repeated = expand(
      "SELECT :::operator, :value AS v",
      { value: 42 },
      { value: ParameterType.INTEGER },
    );

    expect(cast.sql).toBe("SELECT ?::int AS val");
    expect(cast.parameters).toEqual(["10"]);
    expect(repeated.sql).toBe("SELECT :::operator, ? AS v");
    expect(repeated.parameters).toEqual([42]);
  });

  it("does not treat ?? as positional placeholders", () => {
    const result = expand("SELECT ?? AS json_op, ? AS id", [10], [ParameterType.INTEGER]);

    expect(result.sql).toBe("SELECT ?? AS json_op, ? AS id");
    expect(result.parameters).toEqual([10]);
  });

  it("requires exact named parameter keys without colon prefix", () => {
    expect(() =>
      expand("SELECT * FROM users WHERE id = :id", { ":id": 5 }, { ":id": ParameterType.INTEGER }),
    ).toThrow(MissingNamedParameter);
  });

  it("duplicates values when the same named placeholder appears multiple times", () => {
    const result = expand(
      "SELECT * FROM users WHERE id = :id OR parent_id = :id",
      { id: 12 },
      { id: ParameterType.INTEGER },
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id = ? OR parent_id = ?");
    expect(result.parameters).toEqual([12, 12]);
    expect(result.types).toEqual([ParameterType.INTEGER, ParameterType.INTEGER]);
  });

  it("parses placeholders inside ARRAY[] and ignores bracket identifiers", () => {
    const result = expand(
      "SELECT ARRAY[:id] AS ids, [col:name] AS col, :status AS status",
      { id: 1, status: "ok" },
      { id: ParameterType.INTEGER, status: ParameterType.STRING },
    );

    expect(result.sql).toBe("SELECT ARRAY[?] AS ids, [col:name] AS col, ? AS status");
    expect(result.parameters).toEqual([1, "ok"]);
    expect(result.types).toEqual([ParameterType.INTEGER, ParameterType.STRING]);
  });

  describe("missing named parameters (Doctrine-style provider)", () => {
    const cases: Array<{
      name: string;
      sql: string;
      params: Record<string, unknown>;
      types: Record<string, unknown>;
    }> = [
      {
        name: "other parameter only",
        sql: "SELECT * FROM foo WHERE bar = :param",
        params: { other: "val" },
        types: {},
      },
      {
        name: "no parameters",
        sql: "SELECT * FROM foo WHERE bar = :param",
        params: {},
        types: {},
      },
      {
        name: "type exists but param missing",
        sql: "SELECT * FROM foo WHERE bar = :param",
        params: {},
        types: { bar: ArrayParameterType.INTEGER },
      },
      {
        name: "wrong parameter name",
        sql: "SELECT * FROM foo WHERE bar = :param",
        params: { bar: "value" },
        types: { bar: ArrayParameterType.INTEGER },
      },
    ];

    describe.each(cases)("$name", ({ sql, params, types }) => {
      it("throws MissingNamedParameter", () => {
        expect(() => expand(sql, params, types as QueryParameterTypes)).toThrow(
          MissingNamedParameter,
        );
      });
    });
  });

  describe("missing positional parameters (Doctrine-style provider)", () => {
    const cases = [
      { name: "No parameters", sql: "SELECT * FROM foo WHERE bar = ?", params: [] as unknown[] },
      {
        name: "Too few parameters",
        sql: "SELECT * FROM foo WHERE bar = ? AND baz = ?",
        params: [1] as unknown[],
      },
    ];

    describe.each(cases)("$name", ({ sql, params }) => {
      it("throws MissingPositionalParameter", () => {
        expect(() => expand(sql, params, [])).toThrow(MissingPositionalParameter);
      });
    });
  });
});
