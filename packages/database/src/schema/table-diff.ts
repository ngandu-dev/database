import { Column } from "./column";
import { ColumnDiff } from "./column-diff";
import { InvalidState } from "./exception/invalid-state";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { Table } from "./table";

export interface TableDiffOptions {
  addedColumns?: Column[];
  changedColumns?: ColumnDiff[];
  droppedColumns?: Column[];
  addedIndexes?: Index[];
  modifiedIndexes?: Index[];
  droppedIndexes?: Index[];
  renamedIndexes?: Record<string, Index>;
  addedForeignKeys?: ForeignKeyConstraint[];
  modifiedForeignKeys?: ForeignKeyConstraint[];
  droppedForeignKeys?: ForeignKeyConstraint[];
}

export class TableDiff {
  public readonly addedColumns: readonly Column[];
  public readonly changedColumns: readonly ColumnDiff[];
  public readonly droppedColumns: readonly Column[];
  public readonly addedIndexes: Index[];
  public readonly modifiedIndexes: readonly Index[];
  public readonly droppedIndexes: Index[];
  public readonly renamedIndexes: Readonly<Record<string, Index>>;
  public readonly addedForeignKeys: readonly ForeignKeyConstraint[];
  public readonly modifiedForeignKeys: readonly ForeignKeyConstraint[];
  public readonly droppedForeignKeys: readonly ForeignKeyConstraint[];

  constructor(
    public readonly oldTable: Table,
    public readonly newTable: Table,
    options: TableDiffOptions = {},
  ) {
    this.addedColumns = options.addedColumns ?? [];
    this.changedColumns = options.changedColumns ?? [];
    this.droppedColumns = options.droppedColumns ?? [];
    this.addedIndexes = options.addedIndexes ?? [];
    this.modifiedIndexes = options.modifiedIndexes ?? [];
    this.droppedIndexes = options.droppedIndexes ?? [];
    this.renamedIndexes = options.renamedIndexes ?? {};
    this.addedForeignKeys = options.addedForeignKeys ?? [];
    this.modifiedForeignKeys = options.modifiedForeignKeys ?? [];
    this.droppedForeignKeys = options.droppedForeignKeys ?? [];
  }

  public hasChanges(): boolean {
    return !this.isEmpty();
  }

  public getOldTable(): Table {
    return this.oldTable;
  }

  public getAddedColumns(): Column[] {
    return [...this.addedColumns];
  }

  public getChangedColumns(): ColumnDiff[] {
    return [...this.changedColumns];
  }

  public getModifiedColumns(): ColumnDiff[] {
    return this.getChangedColumns().filter(
      (diff) => diff.countChangedProperties() > (diff.hasNameChanged() ? 1 : 0),
    );
  }

  public getRenamedColumns(): Record<string, Column> {
    const renamed: Record<string, Column> = {};

    for (const diff of this.changedColumns) {
      if (!diff.hasNameChanged()) {
        continue;
      }

      renamed[diff.getOldColumn().getName()] = diff.getNewColumn();
    }

    return renamed;
  }

  public getDroppedColumns(): Column[] {
    return [...this.droppedColumns];
  }

  public getAddedIndexes(): Index[] {
    return [...this.addedIndexes];
  }

  public unsetAddedIndex(index: Index): void {
    const foundIndex = this.addedIndexes.indexOf(index);
    if (foundIndex !== -1) {
      this.addedIndexes.splice(foundIndex, 1);
    }
  }

  public getModifiedIndexes(): Index[] {
    return [...this.modifiedIndexes];
  }

  public getDroppedIndexes(): Index[] {
    return [...this.droppedIndexes];
  }

  public unsetDroppedIndex(index: Index): void {
    const foundIndex = this.droppedIndexes.indexOf(index);
    if (foundIndex !== -1) {
      this.droppedIndexes.splice(foundIndex, 1);
    }
  }

  public getRenamedIndexes(): Record<string, Index> {
    return { ...this.renamedIndexes };
  }

  public getAddedForeignKeys(): ForeignKeyConstraint[] {
    return [...this.addedForeignKeys];
  }

  public getModifiedForeignKeys(): ForeignKeyConstraint[] {
    return [...this.modifiedForeignKeys];
  }

  public getDroppedForeignKeys(): ForeignKeyConstraint[] {
    return [...this.droppedForeignKeys];
  }

  public getDroppedForeignKeyConstraintNames(): string[] {
    const names = this.droppedForeignKeys.map((constraint) => constraint.getName());

    if (names.some((name) => name.length === 0)) {
      throw InvalidState.tableDiffContainsUnnamedDroppedForeignKeyConstraints();
    }

    return names;
  }

  public isEmpty(): boolean {
    return (
      (this.addedColumns.length > 0 ||
        this.changedColumns.length > 0 ||
        this.droppedColumns.length > 0 ||
        this.addedIndexes.length > 0 ||
        this.modifiedIndexes.length > 0 ||
        this.droppedIndexes.length > 0 ||
        Object.keys(this.renamedIndexes).length > 0 ||
        this.addedForeignKeys.length > 0 ||
        this.modifiedForeignKeys.length > 0 ||
        this.droppedForeignKeys.length > 0) === false
    );
  }
}
