import { describe, expect, it } from "vitest";

import { Comparator as MySQLComparator } from "../../../platforms/mysql/comparator";
import { DefaultTableOptions } from "../../../platforms/mysql/default-table-options";
import { MySQLPlatform } from "../../../platforms/mysql-platform";
import { Comparator } from "../../../schema/comparator";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";

describe("Schema Platforms MySQLSchemaTest parity scaffold", () => {
  it("generates MySQL foreign-key SQL", () => {
    const platform = new MySQLPlatform();
    const table = new Table("test");
    table.addColumn("foo_id", Types.INTEGER, { columnDefinition: "INT" });
    table.addForeignKeyConstraint("test_foreign", ["foo_id"], ["foo_id"]);

    const sqls = table
      .getForeignKeys()
      .map((fk) => platform.getCreateForeignKeySQL(fk, table.getQuotedName(platform)));

    expect(sqls).toHaveLength(1);
    expect(sqls[0]).toContain("ALTER TABLE test ADD");
    expect(sqls[0]).toContain("FOREIGN KEY (foo_id) REFERENCES test_foreign (foo_id)");
  });

  it("does not report a diff when tables are unchanged under the generic comparator", () => {
    const platform = new MySQLPlatform();
    const oldTable = new Table("test");
    oldTable.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
    oldTable.addColumn("description", Types.STRING, { length: 65536 });

    const newTable = new Table("test");
    newTable.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
    newTable.addColumn("description", Types.STRING, { length: 65536 });

    const diff = new Comparator().compareTables(oldTable, newTable);

    expect(diff === null || diff.hasChanges() === false).toBe(true);
    expect(platform).toBeInstanceOf(MySQLPlatform);
  });

  it("does not emit a CLOB alter when only adding a primary key (Doctrine MySQLSchemaTest::testClobNoAlterTable)", () => {
    const platform = new MySQLPlatform();
    const tableOld = new Table("test");
    tableOld.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
    tableOld.addColumn("description", Types.STRING, { length: 65536 });

    const tableNew = tableOld
      .edit()
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setColumnNames("id").create())
      .create();

    const diff = createMySqlComparator().compareTables(tableOld, tableNew);

    expect(diff).not.toBeNull();
    expect(platform.getAlterTableSQL(diff)).toEqual(["ALTER TABLE test ADD PRIMARY KEY (id)"]);
  });
});

function createMySqlComparator(): MySQLComparator {
  return new MySQLComparator(
    new MySQLPlatform(),
    { getDefaultCharsetCollation: () => null },
    { getCollationCharset: () => null },
    new DefaultTableOptions("utf8mb4", "utf8mb4_general_ci"),
  );
}
