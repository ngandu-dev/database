import { describe, expect, it } from "vitest";

import type { Connection as DBALConnection } from "../../connection";
import { ArrayResult } from "../../driver/array-result";
import type { Result as DriverResult } from "../../driver/result";
import { InvalidColumnIndex } from "../../exception/invalid-column-index";
import { NoKeyValue } from "../../exception/no-key-value";
import { Result } from "../../result";

function expectUserRow(_row: { id: number; name: string } | undefined): void {}

const passthroughConnection = {
  convertException(error: unknown): never {
    throw error as Error;
  },
} as unknown as DBALConnection;

function createResult<TRow extends Record<string, unknown> = Record<string, unknown>>(
  driverResult: DriverResult,
): Result<TRow> {
  return new Result<TRow>(driverResult, passthroughConnection);
}

describe("Result", () => {
  it("uses class-level row type for fetchAssociative() by default", () => {
    const result = createResult<{ id: number; name: string }>(
      new ArrayResult([{ id: 1, name: "Alice" }]),
    );

    const row = result.fetchAssociative();
    expectUserRow(row);
    expect(row).toEqual({ id: 1, name: "Alice" });
  });

  it("fetches associative rows sequentially", () => {
    const result = createResult(
      new ArrayResult([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]),
    );

    expect(result.fetchAssociative()).toEqual({ id: 1, name: "Alice" });
    expect(result.fetchAssociative()).toEqual({ id: 2, name: "Bob" });
    expect(result.fetchAssociative()).toBeUndefined();
  });

  it("returns a clone when fetching associative rows", () => {
    const result = createResult(new ArrayResult([{ id: 1, name: "Alice" }]));

    const row = result.fetchAssociative<{ id: number; name: string }>();
    expect(row).toEqual({ id: 1, name: "Alice" });
    if (row !== undefined) {
      row.name = "Changed";
    }

    expect(result.fetchAssociative()).toBeUndefined();
  });

  it("fetches numeric rows using explicit column order", () => {
    const result = createResult(new ArrayResult([{ id: 7, name: "Carol" }], ["name", "id"]));

    expect(result.fetchNumeric<[string, number]>()).toEqual(["Carol", 7]);
  });

  it("fetches single values and first column values", () => {
    const result = createResult(
      new ArrayResult([
        { id: 10, name: "A" },
        { id: 20, name: "B" },
      ]),
    );

    expect(result.fetchOne<number>()).toBe(10);
    expect(result.fetchFirstColumn<number>()).toEqual([20]);
  });

  it("fetches all numeric and associative rows", () => {
    const resultForNumeric = createResult(
      new ArrayResult([
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ]),
    );

    const resultForAssociative = createResult(
      new ArrayResult([
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ]),
    );

    expect(resultForNumeric.fetchAllNumeric<[number, string]>()).toEqual([
      [1, "A"],
      [2, "B"],
    ]);
    expect(resultForAssociative.fetchAllAssociative<{ id: number; name: string }>()).toEqual([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
  });

  it("fetches key/value pairs", () => {
    const result = createResult(
      new ArrayResult([
        { id: "one", value: 100, extra: "x" },
        { id: "two", value: 200, extra: "y" },
      ]),
    );

    expect(result.fetchAllKeyValue<number>()).toEqual({
      one: 100,
      two: 200,
    });
  });

  it("throws when key/value fetch has less than two columns", () => {
    const result = createResult(new ArrayResult([{ id: 1 }]));

    expect(() => result.fetchAllKeyValue()).toThrow(NoKeyValue);
  });

  it("fetches associative rows indexed by first column", () => {
    const result = createResult(
      new ArrayResult([
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ]),
    );

    expect(result.fetchAllAssociativeIndexed<{ name: string; active: boolean }>()).toEqual({
      u1: { active: true, name: "Alice" },
      u2: { active: false, name: "Bob" },
    });
  });

  it("supports explicit row and column metadata", () => {
    const result = createResult(new ArrayResult([], ["id", "name"], 42));

    expect(result.rowCount()).toBe(42);
    expect(result.columnCount()).toBe(2);
    expect(result.getColumnName(0)).toBe("id");
    expect(() => result.getColumnName(2)).toThrow(InvalidColumnIndex);
  });

  it("releases rows when free() is called", () => {
    const result = createResult(new ArrayResult([{ id: 1 }]));

    result.free();
    expect(result.fetchAssociative()).toBeUndefined();
    expect(result.rowCount()).toBe(0);
  });

  it("iterates rows and columns using Doctrine-style iterator helpers", () => {
    const numericResult = createResult(
      new ArrayResult([
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ]),
    );
    const associativeResult = createResult(
      new ArrayResult([
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ]),
    );
    const keyValueResult = createResult(
      new ArrayResult([
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ]),
    );
    const indexedResult = createResult(
      new ArrayResult([
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ]),
    );
    const columnResult = createResult(
      new ArrayResult([
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ]),
    );

    expect([...numericResult.iterateNumeric<[string, string, boolean]>()]).toEqual([
      ["u1", "Alice", true],
      ["u2", "Bob", false],
    ]);
    expect([
      ...associativeResult.iterateAssociative<{ id: string; name: string; active: boolean }>(),
    ]).toEqual([
      { id: "u1", name: "Alice", active: true },
      { id: "u2", name: "Bob", active: false },
    ]);
    expect([...keyValueResult.iterateKeyValue<string>()]).toEqual([
      ["u1", "Alice"],
      ["u2", "Bob"],
    ]);
    expect([
      ...indexedResult.iterateAssociativeIndexed<{ name: string; active: boolean }>(),
    ]).toEqual([
      ["u1", { active: true, name: "Alice" }],
      ["u2", { active: false, name: "Bob" }],
    ]);
    expect([...columnResult.iterateColumn<string>()]).toEqual(["u1", "u2"]);
  });

  it("converts driver exceptions using the connection", () => {
    const driverError = new Error("driver failure");
    const convertedError = new Error("converted failure");
    const calls: Array<{ error: unknown; operation: string }> = [];
    const connection = {
      convertException(error: unknown, operation: string): Error {
        calls.push({ error, operation });
        return convertedError;
      },
    } as unknown as DBALConnection;

    const failingResult: DriverResult = {
      fetchNumeric: () => {
        throw driverError;
      },
      fetchAssociative: () => undefined,
      fetchOne: () => undefined,
      fetchAllNumeric: () => [],
      fetchAllAssociative: () => [],
      fetchFirstColumn: () => [],
      rowCount: () => 0,
      columnCount: () => 0,
      free: () => {},
    };

    const result = new Result(failingResult, connection);

    expect(() => result.fetchNumeric()).toThrow(convertedError);
    expect(calls).toEqual([{ error: driverError, operation: "fetchNumeric" }]);
  });
});
