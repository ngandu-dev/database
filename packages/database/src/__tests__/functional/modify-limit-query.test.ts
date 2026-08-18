import { beforeEach, describe, expect, it } from "vitest";

import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/ModifyLimitQueryTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("modify_limit_table")
        .setColumns(Column.editor().setUnquotedName("test_int").setTypeName(Types.INTEGER).create())
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("test_int").create(),
        )
        .create(),
    );

    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("modify_limit_table2")
        .setColumns(
          Column.editor()
            .setUnquotedName("id")
            .setTypeName(Types.INTEGER)
            .setAutoincrement(true)
            .create(),
          Column.editor().setUnquotedName("test_int").setTypeName(Types.INTEGER).create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );
  });

  it("modifies limit query for a simple ordered query", async () => {
    const c = functional.connection();
    for (const value of [1, 2, 3, 4]) {
      await c.insert("modify_limit_table", { test_int: value });
    }

    const sql = "SELECT * FROM modify_limit_table ORDER BY test_int ASC";

    await assertLimitResult(c, [1, 2, 3, 4], sql, 10, 0);
    await assertLimitResult(c, [1, 2], sql, 2, 0);
    await assertLimitResult(c, [3, 4], sql, 2, 2);
    if (functional.getTarget().platform !== "sqlite3") {
      await assertLimitResult(c, [2, 3, 4], sql, null, 1);
    }
  });

  it("modifies limit query for a join query", async () => {
    const c = functional.connection();
    await c.insert("modify_limit_table", { test_int: 1 });
    await c.insert("modify_limit_table", { test_int: 2 });
    for (const value of [1, 1, 1, 2, 2]) {
      await c.insert("modify_limit_table2", { test_int: value });
    }

    const sql =
      "SELECT modify_limit_table.test_int FROM modify_limit_table " +
      "INNER JOIN modify_limit_table2 ON modify_limit_table.test_int = modify_limit_table2.test_int " +
      "ORDER BY modify_limit_table.test_int DESC";

    await assertLimitResult(c, [2, 2, 1, 1, 1], sql, 10, 0);
    await assertLimitResult(c, [1, 1, 1], sql, 3, 2);
    await assertLimitResult(c, [2, 2], sql, 2, 0);
  });

  it("modifies limit query for group by", async () => {
    const c = functional.connection();
    await c.insert("modify_limit_table", { test_int: 1 });
    await c.insert("modify_limit_table", { test_int: 2 });
    for (const value of [1, 1, 1, 2, 2]) {
      await c.insert("modify_limit_table2", { test_int: value });
    }

    const sql =
      "SELECT modify_limit_table.test_int FROM modify_limit_table " +
      "INNER JOIN modify_limit_table2 ON modify_limit_table.test_int = modify_limit_table2.test_int " +
      "GROUP BY modify_limit_table.test_int ORDER BY modify_limit_table.test_int ASC";

    await assertLimitResult(c, [1, 2], sql, 10, 0);
    await assertLimitResult(c, [1], sql, 1, 0);
    await assertLimitResult(c, [2], sql, 1, 1);
  });

  it("modifies limit query with line breaks", async () => {
    const c = functional.connection();
    for (const value of [1, 2, 3]) {
      await c.insert("modify_limit_table", { test_int: value });
    }

    const sql = "SELECT\n*\nFROM\nmodify_limit_table\nORDER\nBY\ntest_int\nASC";
    await assertLimitResult(c, [2], sql, 1, 1);
  });

  it("handles zero offset with no limit", async () => {
    const c = functional.connection();
    await c.insert("modify_limit_table", { test_int: 1 });
    await c.insert("modify_limit_table", { test_int: 2 });

    await assertLimitResult(
      c,
      [1, 2],
      "SELECT test_int FROM modify_limit_table ORDER BY test_int ASC",
      null,
      0,
    );
  });
});

async function assertLimitResult(
  connection: ReturnType<ReturnType<typeof useFunctionalTestCase>["connection"]>,
  expected: number[],
  sql: string,
  limit: number | null,
  offset: number,
): Promise<void> {
  const rows = await connection.fetchAllAssociative(
    connection.getDatabasePlatform().modifyLimitQuery(sql, limit, offset),
  );
  const values = rows.map((row) => Number((row.test_int ?? row.TEST_INT) as number | string));
  expect(values).toEqual(expected);
}
