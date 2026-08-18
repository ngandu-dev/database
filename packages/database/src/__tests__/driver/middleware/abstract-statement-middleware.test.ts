import { describe, expect, it } from "vitest";

import { ArrayResult } from "../../../driver/array-result";
import { AbstractStatementMiddleware } from "../../../driver/middleware/abstract-statement-middleware";
import type { Statement as DriverStatement } from "../../../driver/statement";
import { ParameterType } from "../../../parameter-type";

class TestStatementMiddleware extends AbstractStatementMiddleware {}

describe("AbstractStatementMiddleware", () => {
  it("delegates execute()", async () => {
    const result = new ArrayResult([], [], 0);
    const statement: DriverStatement = {
      bindValue: () => undefined,
      execute: async () => result,
    };

    await expect(new TestStatementMiddleware(statement).execute()).resolves.toBe(result);
  });

  it("delegates bindValue()", () => {
    const calls: unknown[] = [];
    const statement: DriverStatement = {
      bindValue: (param, value, type) => {
        calls.push([param, value, type]);
      },
      execute: async () => new ArrayResult([], [], 0),
    };

    new TestStatementMiddleware(statement).bindValue(1, "x", ParameterType.STRING);
    expect(calls).toEqual([[1, "x", ParameterType.STRING]]);
  });
});
