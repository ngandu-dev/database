import { describe, expect, it } from "vitest";

import { Result as MSSQLResult } from "../../driver/mssql/result";
import { Result as MySQL2Result } from "../../driver/mysql2/result";
import { Result as PgResult } from "../../driver/pg/result";
import type { Result as DriverResult } from "../../driver/result";
import { Result as SQLite3Result } from "../../driver/sqlite3/result";

type DriverResultCtor = new (
  rows: Array<Record<string, unknown>>,
  columns?: string[],
  affectedRowCount?: number | string,
) => DriverResult;

const driverResultCtors: Array<[string, DriverResultCtor]> = [
  ["mysql2", MySQL2Result],
  ["pg", PgResult],
  ["sqlite3", SQLite3Result],
  ["mssql", MSSQLResult],
];

describe("driver result classes", () => {
  it.each(driverResultCtors)("%s result fetches rows and metadata", (_name, ResultCtor) => {
    const result = new ResultCtor(
      [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
      ["id", "name"],
      2,
    );

    expect(result.fetchOne<number>()).toBe(1);
    expect(result.fetchNumeric<[number, string]>()).toEqual([2, "Bob"]);
    expect(result.fetchAssociative()).toBeUndefined();
    expect(result.rowCount()).toBe(2);
    expect(result.columnCount()).toBe(2);
    expect(
      (result as DriverResult & { getColumnName: (index: number) => string }).getColumnName(1),
    ).toBe("name");
  });

  it.each(
    driverResultCtors,
  )("%s result supports fetchAll helpers and free()", (_name, ResultCtor) => {
    const result = new ResultCtor(
      [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ],
      ["id", "name"],
      "3",
    );

    expect(result.fetchAllNumeric<[number, string]>()).toEqual([
      [1, "A"],
      [2, "B"],
    ]);
    expect(result.rowCount()).toBe("3");

    result.free();
    expect(result.fetchFirstColumn()).toEqual([]);
    expect(result.rowCount()).toBe("3");
  });
});
