import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
import type { Connection } from "../../connection";
import { ParameterType } from "../../parameter-type";
import type { AbstractPlatform } from "../../platforms/abstract-platform";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { TrimMode } from "../../platforms/trim-mode";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import type { Statement } from "../../statement";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/DataAccessTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("fetch_table")
        .setColumns(
          Column.editor().setUnquotedName("test_int").setTypeName(Types.INTEGER).create(),
          Column.editor()
            .setUnquotedName("test_string")
            .setTypeName(Types.STRING)
            .setLength(32)
            .create(),
          Column.editor()
            .setUnquotedName("test_datetime")
            .setTypeName(Types.DATETIME_MUTABLE)
            .setNotNull(false)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("test_int").create(),
        )
        .create(),
    );

    await functional.connection().insert("fetch_table", {
      test_int: 1,
      test_string: "foo",
      test_datetime: "2010-01-01 10:10:10",
    });
  });

  afterEach(async () => {
    await functional.dropTableIfExists("fetch_table_date_math");
    await functional.dropTableIfExists("fetch_table");
  });

  it("prepare with bindValue", async () => {
    const stmt = await functional
      .connection()
      .prepare(
        "SELECT test_int, test_string FROM fetch_table WHERE test_int = ? AND test_string = ?",
      );

    stmt.bindValue(1, 1);
    stmt.bindValue(2, "foo");

    const row = lowerCaseKeys((await stmt.executeQuery()).fetchAssociative());
    expect(row).toEqual({ test_int: 1, test_string: "foo" });
  });

  it("prepare with fetchAllAssociative", async () => {
    const stmt = await functional
      .connection()
      .prepare(
        "SELECT test_int, test_string FROM fetch_table WHERE test_int = ? AND test_string = ?",
      );

    stmt.bindValue(1, 1);
    stmt.bindValue(2, "foo");

    const rows = (await stmt.executeQuery()).fetchAllAssociative().map((row) => lowerCaseKeys(row));
    expect(rows[0]).toEqual({ test_int: 1, test_string: "foo" });
  });

  it("prepare with fetchOne", async () => {
    const stmt = await functional
      .connection()
      .prepare("SELECT test_int FROM fetch_table WHERE test_int = ? AND test_string = ?");

    stmt.bindValue(1, 1);
    stmt.bindValue(2, "foo");

    expect((await stmt.executeQuery()).fetchOne()).toBe(1);
  });

  it("fetchAllAssociative", async () => {
    const rows = await functional
      .connection()
      .fetchAllAssociative(
        "SELECT test_int, test_string FROM fetch_table WHERE test_int = ? AND test_string = ?",
        [1, "foo"],
      );

    expect(rows).toHaveLength(1);
    const row = lowerCaseKeys(rows[0]);
    expect(row.test_int).toBe(1);
    expect(row.test_string).toBe("foo");
  });

  it("fetchAllAssociative with types", async () => {
    const datetime = new Date("2010-01-01T10:10:10");

    const rows = await functional
      .connection()
      .fetchAllAssociative(
        "SELECT test_int, test_datetime FROM fetch_table WHERE test_int = ? AND test_datetime = ?",
        [1, datetime],
        [ParameterType.STRING, Types.DATETIME_MUTABLE],
      );

    expect(rows).toHaveLength(1);
    const row = lowerCaseKeys(rows[0]);
    expect(row.test_int).toBe(1);
    expect(normalizeDateTimeSecondPrecision(row.test_datetime)).toBe("2010-01-01 10:10:10");
  });

  it("fetchAssociative", async () => {
    const row = await functional
      .connection()
      .fetchAssociative(
        "SELECT test_int, test_string FROM fetch_table WHERE test_int = ? AND test_string = ?",
        [1, "foo"],
      );

    expect(row).toBeDefined();
    const normalized = lowerCaseKeys(row);
    expect(normalized.test_int).toBe(1);
    expect(normalized.test_string).toBe("foo");
  });

  it("fetchAssociative with types", async () => {
    const datetime = new Date("2010-01-01T10:10:10");

    const row = await functional
      .connection()
      .fetchAssociative(
        "SELECT test_int, test_datetime FROM fetch_table WHERE test_int = ? AND test_datetime = ?",
        [1, datetime],
        [ParameterType.STRING, Types.DATETIME_MUTABLE],
      );

    expect(row).toBeDefined();
    const normalized = lowerCaseKeys(row);
    expect(normalized.test_int).toBe(1);
    expect(normalizeDateTimeSecondPrecision(normalized.test_datetime)).toBe("2010-01-01 10:10:10");
  });

  it("fetchNumeric", async () => {
    const row = await functional
      .connection()
      .fetchNumeric(
        "SELECT test_int, test_string FROM fetch_table WHERE test_int = ? AND test_string = ?",
        [1, "foo"],
      );

    expect(row).toBeDefined();
    expect(row?.[0]).toBe(1);
    expect(row?.[1]).toBe("foo");
  });

  it("fetchNumeric with types", async () => {
    const datetime = new Date("2010-01-01T10:10:10");

    const row = await functional
      .connection()
      .fetchNumeric(
        "SELECT test_int, test_datetime FROM fetch_table WHERE test_int = ? AND test_datetime = ?",
        [1, datetime],
        [ParameterType.STRING, Types.DATETIME_MUTABLE],
      );

    expect(row).toBeDefined();
    expect(row?.[0]).toBe(1);
    expect(normalizeDateTimeSecondPrecision(row?.[1])).toBe("2010-01-01 10:10:10");
  });

  it("fetchOne", async () => {
    const connection = functional.connection();

    expect(
      await connection.fetchOne(
        "SELECT test_int FROM fetch_table WHERE test_int = ? AND test_string = ?",
        [1, "foo"],
      ),
    ).toBe(1);

    expect(
      await connection.fetchOne(
        "SELECT test_string FROM fetch_table WHERE test_int = ? AND test_string = ?",
        [1, "foo"],
      ),
    ).toBe("foo");
  });

  it("fetchOne with types", async () => {
    const datetime = new Date("2010-01-01T10:10:10");

    const column = await functional
      .connection()
      .fetchOne(
        "SELECT test_datetime FROM fetch_table WHERE test_int = ? AND test_datetime = ?",
        [1, datetime],
        [ParameterType.STRING, Types.DATETIME_MUTABLE],
      );

    expect(typeof column === "string" || column instanceof Date).toBe(true);
    expect(normalizeDateTimeSecondPrecision(column)).toBe("2010-01-01 10:10:10");
  });

  it("executeQuery binds DateTime type", async () => {
    const value = await functional
      .connection()
      .fetchOne(
        "SELECT count(*) AS c FROM fetch_table WHERE test_datetime = ?",
        [new Date("2010-01-01T10:10:10")],
        [Types.DATETIME_MUTABLE],
      );

    expect(Number(value)).toBe(1);
  });

  it("executeStatement binds DateTime type", async () => {
    const datetime = new Date("2010-02-02T20:20:20");
    const connection = functional.connection();

    const affectedRows = await connection.executeStatement(
      "INSERT INTO fetch_table (test_int, test_string, test_datetime) VALUES (?, ?, ?)",
      [50, "foo", datetime],
      [ParameterType.INTEGER, ParameterType.STRING, Types.DATETIME_MUTABLE],
    );

    expect(affectedRows).toBe(1);
    expect(
      Number(
        (
          await connection.executeQuery(
            "SELECT count(*) AS c FROM fetch_table WHERE test_datetime = ?",
            [datetime],
            [Types.DATETIME_MUTABLE],
          )
        ).fetchOne(),
      ),
    ).toBe(1);
  });

  it("prepare query bindValue DateTime type", async () => {
    const stmt = await functional
      .connection()
      .prepare("SELECT count(*) AS c FROM fetch_table WHERE test_datetime = ?");

    stmt.bindValue(1, new Date("2010-01-01T10:10:10"), Types.DATETIME_MUTABLE);

    expect(Number((await stmt.executeQuery()).fetchOne())).toBe(1);
  });

  it("native array list support", async () => {
    const connection = functional.connection();
    for (let value = 100; value < 110; value += 1) {
      await connection.insert("fetch_table", {
        test_int: value,
        test_string: `foo${value}`,
        test_datetime: "2010-01-01 10:10:10",
      });
    }

    let result = await connection.executeQuery(
      "SELECT test_int FROM fetch_table WHERE test_int IN (?) ORDER BY test_int",
      [[100, 101, 102, 103, 104]],
      [ArrayParameterType.INTEGER],
    );
    expect(result.fetchAllNumeric()).toEqual([[100], [101], [102], [103], [104]]);

    result = await connection.executeQuery(
      "SELECT test_int FROM fetch_table WHERE test_string IN (?) ORDER BY test_int",
      [["foo100", "foo101", "foo102", "foo103", "foo104"]],
      [ArrayParameterType.STRING],
    );
    expect(result.fetchAllNumeric()).toEqual([[100], [101], [102], [103], [104]]);
  });

  it.each(trimExpressionCases)("trim expression (%j, %s, %j)", async ({
    value,
    mode,
    char,
    expected,
  }) => {
    const connection = functional.connection();
    const sql =
      "SELECT " +
      connection.getDatabasePlatform().getTrimExpression(value, mode, char) +
      " AS trimmed FROM fetch_table";

    const row = lowerCaseKeys(await connection.fetchAssociative(sql));
    expect(row.trimmed).toBe(expected);
  });

  for (const dateCase of dateArithmeticCases) {
    it.each(intervalModes)(`${dateCase.name} (%s interval mode)`, async ({
      buildQuery,
      bindParams,
    }) => {
      await assertDateExpression(
        functional.connection(),
        buildQuery,
        bindParams,
        dateCase.buildExpression,
        dateCase.interval,
        dateCase.expected,
      );
    });
  }

  it("sqlite date arithmetic with dynamic interval", async ({ skip }) => {
    const connection = functional.connection();
    const platform = connection.getDatabasePlatform();

    if (!(platform instanceof SQLitePlatform)) {
      skip();
    }

    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("fetch_table_date_math")
        .setColumns(
          Column.editor().setUnquotedName("test_date").setTypeName(Types.DATE_MUTABLE).create(),
          Column.editor().setUnquotedName("test_days").setTypeName(Types.INTEGER).create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("test_date").create(),
        )
        .create(),
    );

    await connection.insert("fetch_table_date_math", { test_date: "2010-01-01", test_days: 10 });
    await connection.insert("fetch_table_date_math", { test_date: "2010-06-01", test_days: 20 });

    let sql = "SELECT COUNT(*) FROM fetch_table_date_math WHERE ";
    sql += `${platform.getDateSubDaysExpression("test_date", "test_days")} < '2010-05-12'`;

    expect(Number(await connection.fetchOne(sql))).toBe(1);
  });

  it("locate expression", async () => {
    const platform = functional.connection().getDatabasePlatform();

    let sql = "SELECT ";
    sql += `${platform.getLocateExpression("test_string", "'oo'")} AS locate1, `;
    sql += `${platform.getLocateExpression("test_string", "'foo'")} AS locate2, `;
    sql += `${platform.getLocateExpression("test_string", "'bar'")} AS locate3, `;
    sql += `${platform.getLocateExpression("test_string", "test_string")} AS locate4, `;
    sql += `${platform.getLocateExpression("'foo'", "test_string")} AS locate5, `;
    sql += `${platform.getLocateExpression("'barfoobaz'", "test_string")} AS locate6, `;
    sql += `${platform.getLocateExpression("'bar'", "test_string")} AS locate7, `;
    sql += `${platform.getLocateExpression("test_string", "'oo'", "2")} AS locate8, `;
    sql += `${platform.getLocateExpression("test_string", "'oo'", "3")} AS locate9, `;
    sql += `${platform.getLocateExpression("test_string", "'foo'", "1")} AS locate10, `;
    sql += `${platform.getLocateExpression("test_string", "'oo'", "1 + 1")} AS locate11 `;
    sql += "FROM fetch_table";

    const row = lowerCaseKeys(await functional.connection().fetchAssociative(sql));
    expect(toNumberRecord(row)).toEqual({
      locate1: 2,
      locate2: 1,
      locate3: 0,
      locate4: 1,
      locate5: 1,
      locate6: 4,
      locate7: 0,
      locate8: 2,
      locate9: 0,
      locate10: 1,
      locate11: 2,
    });
  });

  it.each(substringExpressionCases)("substring expression (%s, %s, %s)", async ({
    string,
    start,
    length,
    expected,
  }) => {
    const platform = functional.connection().getDatabasePlatform();
    const query = platform.getDummySelectSQL(
      platform.getSubstringExpression(string, start, length),
    );
    expect(await functional.connection().fetchOne(query)).toBe(expected);
  });

  it("quote SQL injection", async () => {
    const quoted = await functional.connection().quote("bar' OR '1'='1");
    const rows = await functional
      .connection()
      .fetchAllAssociative(`SELECT * FROM fetch_table WHERE test_string = ${quoted}`);

    expect(rows).toHaveLength(0);
  });
});

type IntervalBuildQuery = (interval: number) => string;
type IntervalBindParams = (stmt: Statement, interval: number) => void;

async function assertDateExpression(
  connection: Connection,
  buildQuery: IntervalBuildQuery,
  bindParams: IntervalBindParams,
  expression: (platform: AbstractPlatform, intervalSql: string) => string,
  interval: number,
  expected: string,
): Promise<void> {
  const platform = connection.getDatabasePlatform();
  const query = `SELECT ${expression(platform, buildQuery(interval))} FROM fetch_table`;
  const stmt = await connection.prepare(query);
  bindParams(stmt, interval);

  const date = (await stmt.executeQuery()).fetchOne();
  expect(date).toBeDefined();
  expect(normalizeDateTimeSecondPrecision(date)).toBe(expected);
}

function lowerCaseKeys(row: Record<string, unknown> | undefined): Record<string, unknown> {
  if (row === undefined) {
    throw new Error("Expected a row.");
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.toLowerCase()] = value;
  }

  return normalized;
}

function normalizeDateTimeSecondPrecision(value: unknown): string {
  if (value instanceof Date) {
    return formatDateTimeLocal(value);
  }

  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(value);
    if (match !== null) {
      return `${match[1]} ${match[2]}`;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateTimeLocal(parsed);
    }
  }

  throw new Error(`Unsupported datetime value: ${String(value)}`);
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function toNumberRecord(row: Record<string, unknown>): Record<string, number> {
  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(row)) {
    output[key] = Number(value);
  }

  return output;
}

const intervalModes: Array<{
  name: string;
  buildQuery: IntervalBuildQuery;
  bindParams: IntervalBindParams;
}> = [
  {
    name: "bind",
    buildQuery: () => "?",
    bindParams: (stmt, interval) => stmt.bindValue(1, interval, ParameterType.INTEGER),
  },
  {
    name: "literal",
    buildQuery: (interval) => String(interval),
    bindParams: () => {},
  },
  {
    name: "expression",
    buildQuery: (interval) => `(0 + ${interval})`,
    bindParams: () => {},
  },
];

const dateArithmeticCases: Array<{
  name: string;
  interval: number;
  expected: string;
  buildExpression: (platform: AbstractPlatform, intervalSql: string) => string;
}> = [
  {
    name: "date add seconds",
    interval: 1,
    expected: "2010-01-01 10:10:11",
    buildExpression: (platform, intervalSql) =>
      platform.getDateAddSecondsExpression("test_datetime", intervalSql),
  },
  {
    name: "date sub seconds",
    interval: 1,
    expected: "2010-01-01 10:10:09",
    buildExpression: (platform, intervalSql) =>
      platform.getDateSubSecondsExpression("test_datetime", intervalSql),
  },
  {
    name: "date add minutes",
    interval: 5,
    expected: "2010-01-01 10:15:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateAddMinutesExpression("test_datetime", intervalSql),
  },
  {
    name: "date sub minutes",
    interval: 5,
    expected: "2010-01-01 10:05:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateSubMinutesExpression("test_datetime", intervalSql),
  },
  {
    name: "date add hours",
    interval: 3,
    expected: "2010-01-01 13:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateAddHourExpression("test_datetime", intervalSql),
  },
  {
    name: "date sub hours",
    interval: 3,
    expected: "2010-01-01 07:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateSubHourExpression("test_datetime", intervalSql),
  },
  {
    name: "date add days",
    interval: 10,
    expected: "2010-01-11 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateAddDaysExpression("test_datetime", intervalSql),
  },
  {
    name: "date sub days",
    interval: 10,
    expected: "2009-12-22 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateSubDaysExpression("test_datetime", intervalSql),
  },
  {
    name: "date add weeks",
    interval: 1,
    expected: "2010-01-08 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateAddWeeksExpression("test_datetime", intervalSql),
  },
  {
    name: "date sub weeks",
    interval: 1,
    expected: "2009-12-25 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateSubWeeksExpression("test_datetime", intervalSql),
  },
  {
    name: "date add months",
    interval: 2,
    expected: "2010-03-01 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateAddMonthExpression("test_datetime", intervalSql),
  },
  {
    name: "date sub months",
    interval: 2,
    expected: "2009-11-01 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateSubMonthExpression("test_datetime", intervalSql),
  },
  {
    name: "date add quarters",
    interval: 3,
    expected: "2010-10-01 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateAddQuartersExpression("test_datetime", intervalSql),
  },
  {
    name: "date sub quarters",
    interval: 3,
    expected: "2009-04-01 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateSubQuartersExpression("test_datetime", intervalSql),
  },
  {
    name: "date add years",
    interval: 6,
    expected: "2016-01-01 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateAddYearsExpression("test_datetime", intervalSql),
  },
  {
    name: "date sub years",
    interval: 6,
    expected: "2004-01-01 10:10:10",
    buildExpression: (platform, intervalSql) =>
      platform.getDateSubYearsExpression("test_datetime", intervalSql),
  },
];

const trimExpressionCases: Array<{
  value: string;
  mode: TrimMode;
  char: string | null;
  expected: string;
}> = [
  { value: "test_string", mode: TrimMode.UNSPECIFIED, char: null, expected: "foo" },
  { value: "test_string", mode: TrimMode.LEADING, char: null, expected: "foo" },
  { value: "test_string", mode: TrimMode.TRAILING, char: null, expected: "foo" },
  { value: "test_string", mode: TrimMode.BOTH, char: null, expected: "foo" },
  { value: "test_string", mode: TrimMode.UNSPECIFIED, char: "'f'", expected: "oo" },
  { value: "test_string", mode: TrimMode.UNSPECIFIED, char: "'o'", expected: "f" },
  { value: "test_string", mode: TrimMode.UNSPECIFIED, char: "'.'", expected: "foo" },
  { value: "test_string", mode: TrimMode.LEADING, char: "'f'", expected: "oo" },
  { value: "test_string", mode: TrimMode.LEADING, char: "'o'", expected: "foo" },
  { value: "test_string", mode: TrimMode.LEADING, char: "'.'", expected: "foo" },
  { value: "test_string", mode: TrimMode.TRAILING, char: "'f'", expected: "foo" },
  { value: "test_string", mode: TrimMode.TRAILING, char: "'o'", expected: "f" },
  { value: "test_string", mode: TrimMode.TRAILING, char: "'.'", expected: "foo" },
  { value: "test_string", mode: TrimMode.BOTH, char: "'f'", expected: "oo" },
  { value: "test_string", mode: TrimMode.BOTH, char: "'o'", expected: "f" },
  { value: "test_string", mode: TrimMode.BOTH, char: "'.'", expected: "foo" },
  { value: "' foo '", mode: TrimMode.UNSPECIFIED, char: null, expected: "foo" },
  { value: "' foo '", mode: TrimMode.LEADING, char: null, expected: "foo " },
  { value: "' foo '", mode: TrimMode.TRAILING, char: null, expected: " foo" },
  { value: "' foo '", mode: TrimMode.BOTH, char: null, expected: "foo" },
  { value: "' foo '", mode: TrimMode.UNSPECIFIED, char: "'f'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.UNSPECIFIED, char: "'o'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.UNSPECIFIED, char: "'.'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.UNSPECIFIED, char: "' '", expected: "foo" },
  { value: "' foo '", mode: TrimMode.LEADING, char: "'f'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.LEADING, char: "'o'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.LEADING, char: "'.'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.LEADING, char: "' '", expected: "foo " },
  { value: "' foo '", mode: TrimMode.TRAILING, char: "'f'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.TRAILING, char: "'o'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.TRAILING, char: "'.'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.TRAILING, char: "' '", expected: " foo" },
  { value: "' foo '", mode: TrimMode.BOTH, char: "'f'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.BOTH, char: "'o'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.BOTH, char: "'.'", expected: " foo " },
  { value: "' foo '", mode: TrimMode.BOTH, char: "' '", expected: "foo" },
];

const substringExpressionCases: Array<{
  string: string;
  start: string;
  length: string | null;
  expected: string;
}> = [
  { string: "'abcdef'", start: "3", length: null, expected: "cdef" },
  { string: "'abcdef'", start: "2", length: "4", expected: "bcde" },
  { string: "'abcdef'", start: "1 + 1", length: "1 + 1", expected: "bc" },
];
