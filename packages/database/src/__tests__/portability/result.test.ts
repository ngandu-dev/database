import { describe, expect, it } from "vitest";

import type { Result as DriverResult } from "../../driver/result";
import { Converter } from "../../portability/converter";
import { Result } from "../../portability/result";

class SpyDriverResult implements DriverResult {
  public fetchNumericCalls = 0;
  public fetchAssociativeCalls = 0;
  public fetchOneCalls = 0;
  public fetchAllNumericCalls = 0;
  public fetchAllAssociativeCalls = 0;
  public fetchFirstColumnCalls = 0;
  public rowCountCalls = 0;
  public columnCountCalls = 0;
  public freeCalls = 0;

  public constructor(
    private readonly values: {
      numeric?: unknown[] | undefined;
      associative?: Record<string, unknown> | undefined;
      one?: unknown | undefined;
      allNumeric?: unknown[][];
      allAssociative?: Array<Record<string, unknown>>;
      firstColumn?: unknown[];
      rowCount?: number | string;
      columnCount?: number;
    } = {},
  ) {}

  public fetchNumeric<T = unknown>(): T[] | undefined {
    this.fetchNumericCalls += 1;
    return this.values.numeric as T[] | undefined;
  }

  public fetchAssociative<T extends Record<string, unknown> = Record<string, unknown>>():
    | T
    | undefined {
    this.fetchAssociativeCalls += 1;
    return this.values.associative as T | undefined;
  }

  public fetchOne<T = unknown>(): T | undefined {
    this.fetchOneCalls += 1;
    return this.values.one as T | undefined;
  }

  public fetchAllNumeric<T = unknown>(): T[][] {
    this.fetchAllNumericCalls += 1;
    return (this.values.allNumeric ?? []) as T[][];
  }

  public fetchAllAssociative<T extends Record<string, unknown> = Record<string, unknown>>(): T[] {
    this.fetchAllAssociativeCalls += 1;
    return (this.values.allAssociative ?? []) as T[];
  }

  public fetchFirstColumn<T = unknown>(): T[] {
    this.fetchFirstColumnCalls += 1;
    return (this.values.firstColumn ?? []) as T[];
  }

  public rowCount(): number | string {
    this.rowCountCalls += 1;
    return this.values.rowCount ?? 0;
  }

  public columnCount(): number {
    this.columnCountCalls += 1;
    return this.values.columnCount ?? 0;
  }

  public free(): void {
    this.freeCalls += 1;
  }
}

function newResult(driverResult: DriverResult): Result {
  return new Result(driverResult, new Converter(false, false, null));
}

describe("Portability/Result (Doctrine parity)", () => {
  it.each([
    [
      "fetchNumeric",
      (result: Result) => result.fetchNumeric(),
      new SpyDriverResult({ numeric: ["bar"] }),
      ["bar"],
    ],
    [
      "fetchAssociative",
      (result: Result) => result.fetchAssociative(),
      new SpyDriverResult({ associative: { foo: "bar" } }),
      { foo: "bar" },
    ],
    ["fetchOne", (result: Result) => result.fetchOne(), new SpyDriverResult({ one: "bar" }), "bar"],
    [
      "fetchAllNumeric",
      (result: Result) => result.fetchAllNumeric(),
      new SpyDriverResult({ allNumeric: [["bar"], ["baz"]] }),
      [["bar"], ["baz"]],
    ],
    [
      "fetchAllAssociative",
      (result: Result) => result.fetchAllAssociative(),
      new SpyDriverResult({ allAssociative: [{ foo: "bar" }, { foo: "baz" }] }),
      [{ foo: "bar" }, { foo: "baz" }],
    ],
    [
      "fetchFirstColumn",
      (result: Result) => result.fetchFirstColumn(),
      new SpyDriverResult({ firstColumn: ["bar", "baz"] }),
      ["bar", "baz"],
    ],
  ])("delegates %s()", (_name, fetch, driverResult, expected) => {
    const result = newResult(driverResult);
    expect(fetch(result)).toEqual(expected);
  });

  it("delegates rowCount()", () => {
    const driverResult = new SpyDriverResult({ rowCount: 666 });
    const result = newResult(driverResult);

    expect(result.rowCount()).toBe(666);
    expect(driverResult.rowCountCalls).toBe(1);
  });

  it("delegates columnCount()", () => {
    const driverResult = new SpyDriverResult({ columnCount: 666 });
    const result = newResult(driverResult);

    expect(result.columnCount()).toBe(666);
    expect(driverResult.columnCountCalls).toBe(1);
  });

  it("delegates free()", () => {
    const driverResult = new SpyDriverResult();
    const result = newResult(driverResult);

    result.free();
    expect(driverResult.freeCalls).toBe(1);
  });
});
