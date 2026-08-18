import { describe, expect, it } from "vitest";

import { CompositeExpression } from "../../../query/expression/composite-expression";

describe("Query/Expression/CompositeExpression (Doctrine parity)", () => {
  it("counts parts and preserves immutability in with()", () => {
    let expr = CompositeExpression.or("u.group_id = 1");

    expect(expr.count()).toBe(1);

    expr = expr.with("u.group_id = 2");
    expect(expr.count()).toBe(2);
  });

  it("keeps with() immutable until the returned expression is assigned", () => {
    let expr = CompositeExpression.or("u.group_id = 1");

    expect(expr.count()).toBe(1);

    expr.with(CompositeExpression.or("u.user_id = 1"));
    expect(expr.count()).toBe(1);

    expr = expr.with(CompositeExpression.or("u.user_id = 1"));
    expect(expr.count()).toBe(2);

    expr = expr.with("u.user_id = 1");
    expect(expr.count()).toBe(3);
  });

  it.each([
    [CompositeExpression.and("u.user = 1"), "u.user = 1"],
    [CompositeExpression.and("u.user = 1", "u.group_id = 1"), "(u.user = 1) AND (u.group_id = 1)"],
    [CompositeExpression.or("u.user = 1"), "u.user = 1"],
    [
      CompositeExpression.or("u.group_id = 1", "u.group_id = 2"),
      "(u.group_id = 1) OR (u.group_id = 2)",
    ],
    [
      CompositeExpression.and(
        "u.user = 1",
        CompositeExpression.or("u.group_id = 1", "u.group_id = 2"),
      ),
      "(u.user = 1) AND ((u.group_id = 1) OR (u.group_id = 2))",
    ],
    [
      CompositeExpression.or(
        "u.group_id = 1",
        CompositeExpression.and("u.user = 1", "u.group_id = 2"),
      ),
      "(u.group_id = 1) OR ((u.user = 1) AND (u.group_id = 2))",
    ],
  ])("renders composite expressions", (expr, expected) => {
    expect(String(expr)).toBe(expected);
  });
});
