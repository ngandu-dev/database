import { describe, expect, it } from "vitest";

import { AbstractResultMiddleware } from "../../../driver/middleware/abstract-result-middleware";
import type { Result as DriverResult } from "../../../driver/result";

class TestResultMiddleware extends AbstractResultMiddleware {}

describe("AbstractResultMiddleware", () => {
  it("delegates fetchAssociative()", () => {
    const row = { another_field: 42, field: "value" };
    const result = createResultStub({
      fetchAssociative: () => row,
    });

    expect(new TestResultMiddleware(result).fetchAssociative()).toBe(row);
  });

  it("delegates getColumnName() when supported", () => {
    const result = Object.assign(createResultStub(), {
      getColumnName: (index: number) => `col_${index}`,
    });

    expect(new TestResultMiddleware(result).getColumnName(0)).toBe("col_0");
  });

  it("throws when getColumnName() is unsupported", () => {
    expect(() => new TestResultMiddleware(createResultStub()).getColumnName(0)).toThrow(
      "does not support accessing the column name",
    );
  });
});

function createResultStub(overrides: Partial<DriverResult> = {}): DriverResult {
  return {
    columnCount: () => 1,
    fetchAllAssociative: () => [],
    fetchAllNumeric: () => [],
    fetchAssociative: () => false,
    fetchFirstColumn: () => [],
    fetchNumeric: () => false,
    fetchOne: () => false,
    free: () => undefined,
    rowCount: () => 0,
    ...overrides,
  };
}
