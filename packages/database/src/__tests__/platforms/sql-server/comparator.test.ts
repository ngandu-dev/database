import { describe, expect, it } from "vitest";

import { Comparator } from "../../../platforms/sqlserver/comparator";
import { SQLServerPlatform } from "../../../platforms/sqlserver-platform";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";

describe("SQLServer Comparator (Doctrine parity, adapted)", () => {
  it("ignores the database default collation when comparing columns", () => {
    const databaseCollation = "SQL_Latin1_General_CP1_CI_AS";
    const oldTable = new Table("foo");
    oldTable.addColumn("name", Types.STRING, {
      length: 255,
      platformOptions: { collation: databaseCollation },
    });

    const newTable = new Table("foo");
    newTable.addColumn("name", Types.STRING, { length: 255 });

    const diff = new Comparator(new SQLServerPlatform(), databaseCollation).compareTables(
      oldTable,
      newTable,
    );
    expect(diff === null || diff.isEmpty()).toBe(true);
  });
});
