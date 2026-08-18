import { describe, expect, it } from "vitest";

import { Comparator } from "../../../platforms/sqlite/comparator";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";

describe("SQLite Comparator (Doctrine parity, adapted)", () => {
  it("ignores explicit BINARY collation like Doctrine SQLite comparator", () => {
    const oldTable = new Table("foo");
    oldTable.addColumn("name", Types.STRING, { platformOptions: { collation: "BINARY" } });

    const newTable = new Table("foo");
    newTable.addColumn("name", Types.STRING);

    const diff = new Comparator().compareTables(oldTable, newTable);
    expect(diff === null || diff.isEmpty()).toBe(true);
  });

  it.skip(
    "compare changed binary column is skipped in Doctrine SQLite comparator tests (SQLite maps binary columns to BLOB)",
  );
});
