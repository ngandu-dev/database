import { describe, expect, it } from "vitest";

import type { Connection } from "../../../connection";
import { CompositeExpression } from "../../../query/expression/composite-expression";
import { ExpressionBuilder } from "../../../query/expression/expression-builder";

function createExpressionBuilder(): ExpressionBuilder {
  return new ExpressionBuilder({} as Connection);
}

describe("Query/Expression/ExpressionBuilder (Doctrine parity)", () => {
  it.each([
    [["u.user = 1"], "u.user = 1"],
    [["u.user = 1", "u.group_id = 1"], "(u.user = 1) AND (u.group_id = 1)"],
    [
      ["u.user = 1", CompositeExpression.or("u.group_id = 1", "u.group_id = 2")],
      "(u.user = 1) AND ((u.group_id = 1) OR (u.group_id = 2))",
    ],
    [
      ["u.group_id = 1", CompositeExpression.and("u.user = 1", "u.group_id = 2")],
      "(u.group_id = 1) AND ((u.user = 1) AND (u.group_id = 2))",
    ],
  ])("builds AND composite expressions", (parts, expected) => {
    const expr = createExpressionBuilder();
    expect(String(expr.and(parts[0] as never, ...(parts.slice(1) as never[])))).toBe(expected);
  });

  it.each([
    [["u.user = 1"], "u.user = 1"],
    [["u.user = 1", "u.group_id = 1"], "(u.user = 1) OR (u.group_id = 1)"],
    [
      ["u.user = 1", CompositeExpression.or("u.group_id = 1", "u.group_id = 2")],
      "(u.user = 1) OR ((u.group_id = 1) OR (u.group_id = 2))",
    ],
    [
      ["u.group_id = 1", CompositeExpression.and("u.user = 1", "u.group_id = 2")],
      "(u.group_id = 1) OR ((u.user = 1) AND (u.group_id = 2))",
    ],
  ])("builds OR composite expressions", (parts, expected) => {
    const expr = createExpressionBuilder();
    expect(String(expr.or(parts[0] as never, ...(parts.slice(1) as never[])))).toBe(expected);
  });

  it.each([
    ["u.user_id", ExpressionBuilder.EQ, "1", "u.user_id = 1"],
    ["u.user_id", ExpressionBuilder.NEQ, "1", "u.user_id <> 1"],
    ["u.salary", ExpressionBuilder.LT, "10000", "u.salary < 10000"],
    ["u.salary", ExpressionBuilder.LTE, "10000", "u.salary <= 10000"],
    ["u.salary", ExpressionBuilder.GT, "10000", "u.salary > 10000"],
    ["u.salary", ExpressionBuilder.GTE, "10000", "u.salary >= 10000"],
  ])("builds comparisons", (leftExpr, operator, rightExpr, expected) => {
    const expr = createExpressionBuilder();
    expect(expr.comparison(leftExpr, operator, rightExpr)).toBe(expected);
  });

  it("builds comparison convenience methods", () => {
    const expr = createExpressionBuilder();

    expect(expr.eq("u.user_id", "1")).toBe("u.user_id = 1");
    expect(expr.neq("u.user_id", "1")).toBe("u.user_id <> 1");
    expect(expr.lt("u.salary", "10000")).toBe("u.salary < 10000");
    expect(expr.lte("u.salary", "10000")).toBe("u.salary <= 10000");
    expect(expr.gt("u.salary", "10000")).toBe("u.salary > 10000");
    expect(expr.gte("u.salary", "10000")).toBe("u.salary >= 10000");
  });

  it("builds null checks", () => {
    const expr = createExpressionBuilder();

    expect(expr.isNull("u.deleted")).toBe("u.deleted IS NULL");
    expect(expr.isNotNull("u.updated")).toBe("u.updated IS NOT NULL");
  });

  it("builds IN and NOT IN clauses for arrays and placeholders", () => {
    const expr = createExpressionBuilder();

    expect(expr.in("u.groups", ["1", "3", "4", "7"])).toBe("u.groups IN (1, 3, 4, 7)");
    expect(expr.in("u.groups", "?")).toBe("u.groups IN (?)");
    expect(expr.notIn("u.groups", ["1", "3", "4", "7"])).toBe("u.groups NOT IN (1, 3, 4, 7)");
    expect(expr.notIn("u.groups", ":values")).toBe("u.groups NOT IN (:values)");
  });

  it("builds LIKE and NOT LIKE clauses with and without escape", () => {
    const expr = createExpressionBuilder();

    expect(expr.like("a.song", "'a virgin'")).toBe("a.song LIKE 'a virgin'");
    expect(expr.like("a.song", "'a virgin'", "'#'")).toBe("a.song LIKE 'a virgin' ESCAPE '#'");
    expect(expr.notLike("s.last_words", "'this'")).toBe("s.last_words NOT LIKE 'this'");
    expect(expr.notLike("p.description", "'20#%'", "'#'")).toBe(
      "p.description NOT LIKE '20#%' ESCAPE '#'",
    );
  });
});
