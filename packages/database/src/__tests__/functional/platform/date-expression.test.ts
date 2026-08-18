import { beforeEach, describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/DateExpressionTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("date_expr_test")
        .setColumns(
          Column.editor().setUnquotedName("date1").setTypeName(Types.DATETIME_MUTABLE).create(),
          Column.editor().setUnquotedName("date2").setTypeName(Types.DATETIME_MUTABLE).create(),
        )
        .create(),
    );
  });

  it.each([
    ["2018-04-14 23:59:59", "2018-04-14 00:00:00", 0],
    ["2018-04-14 00:00:00", "2018-04-13 23:59:59", 1],
  ] as const)("date diff expression", async (date1, date2, expected) => {
    await functional.connection().executeStatement("DELETE FROM date_expr_test");
    await functional.connection().insert("date_expr_test", { date1, date2 });

    const platform = functional.connection().getDatabasePlatform();
    const sql = `SELECT ${platform.getDateDiffExpression("date1", "date2")} FROM date_expr_test`;

    expect(Number(await functional.connection().fetchOne(sql))).toBe(expected);
  });
});
