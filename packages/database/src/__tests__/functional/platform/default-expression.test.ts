import { describe, expect, it } from "vitest";

import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { OraclePlatform } from "../../../platforms/oracle-platform";
import { Column } from "../../../schema/column";
import type { DefaultExpression } from "../../../schema/default-expression";
import { CurrentDate } from "../../../schema/default-expression/current-date";
import { CurrentTime } from "../../../schema/default-expression/current-time";
import { CurrentTimestamp } from "../../../schema/default-expression/current-timestamp";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/DefaultExpressionTest", () => {
  const functional = useFunctionalTestCase();

  it("current date", async ({ skip }) => {
    const platform = functional.connection().getDatabasePlatform();
    if (platform instanceof AbstractMySQLPlatform) {
      skip();
    }

    await assertDefaultExpression(functional, Types.DATE_MUTABLE, new CurrentDate());
  });

  it("current time", async ({ skip }) => {
    const platform = functional.connection().getDatabasePlatform();
    if (platform instanceof AbstractMySQLPlatform || platform instanceof OraclePlatform) {
      skip();
    }

    await assertDefaultExpression(functional, Types.TIME_MUTABLE, new CurrentTime());
  });

  it("current timestamp", async () => {
    await assertDefaultExpression(functional, Types.DATETIME_MUTABLE, new CurrentTimestamp());
  });
});

async function assertDefaultExpression(
  functional: ReturnType<typeof useFunctionalTestCase>,
  typeName: string,
  expression: DefaultExpression,
): Promise<void> {
  await functional.dropAndCreateTable(
    Table.editor()
      .setUnquotedName("default_expr_test")
      .setColumns(
        Column.editor().setUnquotedName("actual_value").setTypeName(typeName).create(),
        Column.editor()
          .setUnquotedName("default_value")
          .setTypeName(typeName)
          .setDefaultValue(expression)
          .create(),
      )
      .create(),
  );

  const connection = functional.connection();

  await connection.executeStatement(
    `INSERT INTO default_expr_test (actual_value) VALUES (${expression.toSQL(
      connection.getDatabasePlatform(),
    )})`,
  );

  const row = await connection.fetchNumeric<[unknown, unknown]>(
    "SELECT default_value, actual_value FROM default_expr_test",
  );
  expect(row).toBeDefined();
  if (row === undefined) {
    return;
  }

  const left = connection.convertToNodeValue(row[0], typeName);
  const right = connection.convertToNodeValue(row[1], typeName);

  if (left instanceof Date && right instanceof Date) {
    expect(left.getTime()).toBe(right.getTime());
    return;
  }

  expect(left).toEqual(right);
}
