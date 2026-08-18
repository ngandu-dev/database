import { describe, expect, it } from "vitest";

import { InvalidState } from "../../schema/exception/invalid-state";
import { ForeignKeyConstraint } from "../../schema/foreign-key-constraint";
import { Table } from "../../schema/table";
import { TableDiff } from "../../schema/table-diff";
import { Types } from "../../types/types";

describe("Schema/TableDiff (Doctrine parity)", () => {
  it("throws for unnamed dropped foreign keys when reading dropped FK names", () => {
    const oldTable = new Table("t1");
    oldTable.addColumn("c1", Types.INTEGER);

    const newTable = new Table("t1");
    newTable.addColumn("c1", Types.INTEGER);

    const droppedForeignKey = ForeignKeyConstraint.editor()
      .setUnquotedReferencingColumnNames("c1")
      .setUnquotedReferencedTableName("t2")
      .setUnquotedReferencedColumnNames("c1")
      .create();

    const diff = new TableDiff(oldTable, newTable, {
      droppedForeignKeys: [droppedForeignKey],
    });

    expect(() => diff.getDroppedForeignKeyConstraintNames()).toThrow(InvalidState);
  });
});
