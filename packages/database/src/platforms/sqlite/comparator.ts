import { Comparator as BaseComparator } from "../../schema/comparator";
import { Table } from "../../schema/table";
import type { TableDiff } from "../../schema/table-diff";

export class Comparator extends BaseComparator {
  public override compareTables(oldTable: Table, newTable: Table): TableDiff | null {
    return super.compareTables(this.normalizeColumns(oldTable), this.normalizeColumns(newTable));
  }

  private normalizeColumns(table: Table): Table {
    const normalized = cloneTable(table);

    for (const column of normalized.getColumns()) {
      const options = column.getPlatformOptions();
      const collation = options.collation;
      if (typeof collation !== "string" || collation.toLowerCase() !== "binary") {
        continue;
      }

      const next = { ...options };
      delete next.collation;
      column.setPlatformOptions(next);
    }

    return normalized;
  }
}

function cloneTable(table: Table): Table {
  const editor = Table.editor()
    .setName(table.getName())
    .setColumns(...table.getColumns().map((column) => column.edit().create()))
    .setIndexes(...table.getIndexes().map((index) => index.edit().create()))
    .setForeignKeyConstraints(...table.getForeignKeys().map((fk) => fk.edit().create()))
    .setUniqueConstraints(...table.getUniqueConstraints().map((uq) => uq.edit().create()))
    .setOptions(table.getOptions());

  const primaryKeyConstraint = table.getPrimaryKeyConstraint();
  if (primaryKeyConstraint !== null) {
    editor.setPrimaryKeyConstraint(primaryKeyConstraint.edit().create());
  }

  const cloned = editor.create();
  const renamedColumns = table.getRenamedColumns();
  const clonedInternals = cloned as unknown as { renamedColumns?: Record<string, string> };

  if (clonedInternals.renamedColumns !== undefined) {
    for (const [newColumnName, oldColumnName] of Object.entries(renamedColumns)) {
      clonedInternals.renamedColumns[newColumnName] = oldColumnName;
    }
  }

  return cloned;
}
