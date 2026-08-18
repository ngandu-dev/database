import { BigIntType } from "../types/big-int-type";
import { IntegerType } from "../types/integer-type";
import { SmallIntType } from "../types/small-int-type";
import { Column } from "./column";
import { ColumnDiff } from "./column-diff";
import { ComparatorConfig } from "./comparator-config";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { Schema } from "./schema";
import { SchemaDiff } from "./schema-diff";
import { Sequence } from "./sequence";
import { Table } from "./table";
import { TableDiff } from "./table-diff";

export class Comparator {
  private readonly platform: { columnsEqual(column1: Column, column2: Column): boolean } | null;
  private readonly config: ComparatorConfig;

  public constructor(config?: ComparatorConfig);
  public constructor(
    platform?: { columnsEqual(column1: Column, column2: Column): boolean } | null,
    config?: ComparatorConfig,
  );
  public constructor(
    platformOrConfig?:
      | ComparatorConfig
      | { columnsEqual(column1: Column, column2: Column): boolean }
      | null,
    maybeConfig?: ComparatorConfig,
  ) {
    if (platformOrConfig instanceof ComparatorConfig || platformOrConfig === undefined) {
      this.platform = null;
      this.config = platformOrConfig ?? new ComparatorConfig();
      return;
    }

    this.platform = platformOrConfig;
    this.config = maybeConfig ?? new ComparatorConfig();
  }

  public compareSchemas(oldSchema: Schema, newSchema: Schema): SchemaDiff {
    const oldDefaultSchemaName = nonEmptyOrNull(oldSchema.getName());
    const newDefaultSchemaName = nonEmptyOrNull(newSchema.getName());

    const createdSchemas = newSchema
      .getNamespaces()
      .filter((namespace) => !oldSchema.hasNamespace(namespace))
      .filter(
        (namespace) =>
          !isDefaultNamespaceAlias(namespace, oldDefaultSchemaName, newDefaultSchemaName),
      );
    const droppedSchemas = oldSchema
      .getNamespaces()
      .filter((namespace) => !newSchema.hasNamespace(namespace))
      .filter(
        (namespace) =>
          !isDefaultNamespaceAlias(namespace, oldDefaultSchemaName, newDefaultSchemaName),
      );

    const createdTables: Table[] = [];
    const alteredTables: TableDiff[] = [];
    const droppedTables: Table[] = [];

    const oldTablesByShortestName = new Map(
      oldSchema
        .getTables()
        .map((table) => [normalizeAssetKey(table.getShortestName(oldDefaultSchemaName)), table]),
    );
    const newTablesByShortestName = new Map(
      newSchema
        .getTables()
        .map((table) => [normalizeAssetKey(table.getShortestName(newDefaultSchemaName)), table]),
    );

    for (const [tableKey, newTable] of newTablesByShortestName) {
      const oldTable = oldTablesByShortestName.get(tableKey);
      if (oldTable === undefined) {
        createdTables.push(newTable);
        continue;
      }

      const diff = this.compareTables(oldTable, newTable);
      if (diff?.hasChanges()) {
        alteredTables.push(diff);
      }
    }

    for (const [tableKey, oldTable] of oldTablesByShortestName) {
      if (!newTablesByShortestName.has(tableKey)) {
        droppedTables.push(oldTable);
      }
    }

    const createdSequences: Sequence[] = [];
    const alteredSequences: Sequence[] = [];
    const droppedSequences: Sequence[] = [];

    const oldSequencesByShortestName = new Map(
      oldSchema
        .getSequences()
        .map((sequence) => [
          normalizeAssetKey(sequence.getShortestName(oldDefaultSchemaName)),
          sequence,
        ]),
    );
    const newSequencesByShortestName = new Map(
      newSchema
        .getSequences()
        .map((sequence) => [
          normalizeAssetKey(sequence.getShortestName(newDefaultSchemaName)),
          sequence,
        ]),
    );

    for (const [sequenceKey, newSequence] of newSequencesByShortestName) {
      const oldSequence = oldSequencesByShortestName.get(sequenceKey);
      if (oldSequence === undefined) {
        if (!this.isAutoIncrementSequenceInSchema(oldSchema, newSequence)) {
          createdSequences.push(newSequence);
        }

        continue;
      }

      if (this.diffSequence(newSequence, oldSequence)) {
        alteredSequences.push(newSequence);
      }
    }

    for (const [sequenceKey, oldSequence] of oldSequencesByShortestName) {
      if (this.isAutoIncrementSequenceInSchema(newSchema, oldSequence)) {
        continue;
      }

      if (!newSequencesByShortestName.has(sequenceKey)) {
        droppedSequences.push(oldSequence);
      }
    }

    return new SchemaDiff({
      alteredSequences,
      alteredTables,
      createdSchemas,
      createdSequences,
      createdTables,
      droppedSchemas,
      droppedSequences,
      droppedTables,
    });
  }

  public compareTables(oldTable: Table, newTable: Table): TableDiff | null {
    const oldColumnsByName = new Map(
      oldTable.getColumns().map((column) => [normalizeAssetKey(column.getName()), column]),
    );
    const newColumnsByName = new Map(
      newTable.getColumns().map((column) => [normalizeAssetKey(column.getName()), column]),
    );

    const addedColumnsByName = new Map<string, Column>();
    const changedColumnsByName = new Map<string, ColumnDiff>();
    const droppedColumnsByName = new Map<string, Column>();

    for (const [name, newColumn] of newColumnsByName) {
      const oldColumn = oldColumnsByName.get(name);
      if (oldColumn === undefined) {
        addedColumnsByName.set(name, newColumn);
        continue;
      }

      if (this.columnsEqual(oldColumn, newColumn)) {
        continue;
      }

      changedColumnsByName.set(
        name,
        this.compareColumns(oldColumn, newColumn) ?? new ColumnDiff(oldColumn, newColumn, []),
      );
    }

    for (const [name, oldColumn] of oldColumnsByName) {
      if (!newColumnsByName.has(name)) {
        droppedColumnsByName.set(name, oldColumn);
      }
    }

    const explicitlyRenamedColumns = newTable.getRenamedColumns();
    for (const [newColumnName, oldColumnName] of Object.entries(explicitlyRenamedColumns)) {
      const addedColumn = addedColumnsByName.get(newColumnName);
      const droppedColumn = droppedColumnsByName.get(oldColumnName);

      if (addedColumn === undefined || droppedColumn === undefined) {
        continue;
      }

      const columnDiff =
        this.compareColumns(droppedColumn, addedColumn) ??
        new ColumnDiff(droppedColumn, addedColumn, []);
      changedColumnsByName.set(oldColumnName, columnDiff);
      addedColumnsByName.delete(newColumnName);
      droppedColumnsByName.delete(oldColumnName);
    }

    if (this.config.getDetectRenamedColumns()) {
      this.detectRenamedColumns(changedColumnsByName, addedColumnsByName, droppedColumnsByName);
    }

    const oldIndexesByName = new Map(
      oldTable.getIndexes().map((index) => [normalizeAssetKey(index.getName()), index]),
    );
    const newIndexesByName = new Map(
      newTable.getIndexes().map((index) => [normalizeAssetKey(index.getName()), index]),
    );

    const addedIndexesByName = new Map<string, Index>();
    const droppedIndexesByName = new Map<string, Index>();
    const modifiedIndexes: Index[] = [];

    for (const [newIndexName, newIndex] of newIndexesByName) {
      if ((newIndex.isPrimary() && oldTable.hasPrimaryKey()) || oldTable.hasIndex(newIndexName)) {
        continue;
      }

      addedIndexesByName.set(newIndexName, newIndex);
    }

    for (const [oldIndexName, oldIndex] of oldIndexesByName) {
      if (oldIndex.isPrimary()) {
        if (!newTable.hasPrimaryKey()) {
          droppedIndexesByName.set(oldIndexName, oldIndex);
          continue;
        }

        const newPrimary = newTable.getPrimaryKey();
        if (!this.diffIndex(oldIndex, newPrimary)) {
          continue;
        }

        if (this.config.getReportModifiedIndexes()) {
          modifiedIndexes.push(newPrimary);
        } else {
          droppedIndexesByName.set(oldIndexName, oldIndex);
          addedIndexesByName.set(normalizeAssetKey(newPrimary.getName()), newPrimary);
        }

        continue;
      }

      if (!newTable.hasIndex(oldIndexName)) {
        droppedIndexesByName.set(oldIndexName, oldIndex);
        continue;
      }

      const newIndex = newIndexesByName.get(oldIndexName);
      if (newIndex === undefined) {
        droppedIndexesByName.set(oldIndexName, oldIndex);
        continue;
      }

      if (!this.diffIndex(oldIndex, newIndex)) {
        continue;
      }

      if (this.config.getReportModifiedIndexes()) {
        modifiedIndexes.push(newIndex);
      } else {
        droppedIndexesByName.set(oldIndexName, oldIndex);
        addedIndexesByName.set(oldIndexName, newIndex);
      }
    }

    const renamedIndexes = this.config.getDetectRenamedIndexes()
      ? this.detectRenamedIndexes(addedIndexesByName, droppedIndexesByName)
      : {};

    const addedIndexes = [...addedIndexesByName.values()];
    const droppedIndexes = [...droppedIndexesByName.values()];

    const oldForeignKeys = [...oldTable.getForeignKeys()];
    const newForeignKeys = [...newTable.getForeignKeys()];
    const addedForeignKeys: ForeignKeyConstraint[] = [];
    const droppedForeignKeys: ForeignKeyConstraint[] = [];

    for (let oldIndex = 0; oldIndex < oldForeignKeys.length; oldIndex += 1) {
      const oldForeignKey = oldForeignKeys[oldIndex];
      if (oldForeignKey === undefined) {
        continue;
      }

      for (let newIndex = 0; newIndex < newForeignKeys.length; newIndex += 1) {
        const newForeignKey = newForeignKeys[newIndex];
        if (newForeignKey === undefined) {
          continue;
        }

        if (!this.diffForeignKey(oldForeignKey, newForeignKey)) {
          oldForeignKeys.splice(oldIndex, 1);
          newForeignKeys.splice(newIndex, 1);
          oldIndex -= 1;
          break;
        }

        if (
          normalizeAssetKey(oldForeignKey.getName()) === normalizeAssetKey(newForeignKey.getName())
        ) {
          droppedForeignKeys.push(oldForeignKey);
          addedForeignKeys.push(newForeignKey);
          oldForeignKeys.splice(oldIndex, 1);
          newForeignKeys.splice(newIndex, 1);
          oldIndex -= 1;
          break;
        }
      }
    }

    droppedForeignKeys.push(...oldForeignKeys);
    addedForeignKeys.push(...newForeignKeys);

    const addedColumns = [...addedColumnsByName.values()];
    const changedColumns = [...changedColumnsByName.values()];
    const droppedColumns = [...droppedColumnsByName.values()];

    const diff = new TableDiff(oldTable, newTable, {
      addedColumns,
      addedForeignKeys,
      addedIndexes,
      changedColumns,
      droppedColumns,
      droppedForeignKeys,
      droppedIndexes,
      modifiedIndexes,
      renamedIndexes,
    });

    if (!diff.hasChanges() && !this.config.isDetectColumnRenamesEnabled()) {
      return null;
    }

    return diff;
  }

  public compareColumns(oldColumn: Column, newColumn: Column): ColumnDiff | null {
    const changedProperties: string[] = [];

    if (oldColumn.getType().constructor !== newColumn.getType().constructor) {
      changedProperties.push("type");
    }

    if (oldColumn.getLength() !== newColumn.getLength()) {
      changedProperties.push("length");
    }

    if (
      !this.isIntegerLikeColumnPair(oldColumn, newColumn) &&
      oldColumn.getPrecision() !== newColumn.getPrecision()
    ) {
      changedProperties.push("precision");
    }

    if (
      !this.isIntegerLikeColumnPair(oldColumn, newColumn) &&
      oldColumn.getScale() !== newColumn.getScale()
    ) {
      changedProperties.push("scale");
    }

    if (oldColumn.getUnsigned() !== newColumn.getUnsigned()) {
      changedProperties.push("unsigned");
    }

    if (oldColumn.getFixed() !== newColumn.getFixed()) {
      changedProperties.push("fixed");
    }

    if (oldColumn.getNotnull() !== newColumn.getNotnull()) {
      changedProperties.push("notnull");
    }

    if (oldColumn.getAutoincrement() !== newColumn.getAutoincrement()) {
      changedProperties.push("autoincrement");
    }

    if (oldColumn.getDefault() !== newColumn.getDefault()) {
      changedProperties.push("default");
    }

    if (oldColumn.getComment() !== newColumn.getComment()) {
      changedProperties.push("comment");
    }

    if (
      JSON.stringify(normalizePlatformOptionsForComparison(oldColumn.getPlatformOptions())) !==
      JSON.stringify(normalizePlatformOptionsForComparison(newColumn.getPlatformOptions()))
    ) {
      changedProperties.push("platformOptions");
    }

    if (changedProperties.length === 0) {
      return null;
    }

    return new ColumnDiff(oldColumn, newColumn, changedProperties);
  }

  public diffSequence(sequence1: Sequence, sequence2: Sequence): boolean {
    if (sequence1.getAllocationSize() !== sequence2.getAllocationSize()) {
      return true;
    }

    return sequence1.getInitialValue() !== sequence2.getInitialValue();
  }

  protected columnsEqual(column1: Column, column2: Column): boolean {
    if (this.platform !== null) {
      return this.platform.columnsEqual(column1, column2);
    }

    return this.compareColumns(column1, column2) === null;
  }

  protected diffForeignKey(key1: ForeignKeyConstraint, key2: ForeignKeyConstraint): boolean {
    return (
      JSON.stringify(key1.getUnquotedLocalColumns().map(normalizeAssetKey)) !==
        JSON.stringify(key2.getUnquotedLocalColumns().map(normalizeAssetKey)) ||
      JSON.stringify(key1.getUnquotedForeignColumns().map(normalizeAssetKey)) !==
        JSON.stringify(key2.getUnquotedForeignColumns().map(normalizeAssetKey)) ||
      key1.getUnqualifiedForeignTableName() !== key2.getUnqualifiedForeignTableName() ||
      key1.onUpdate() !== key2.onUpdate() ||
      key1.onDelete() !== key2.onDelete()
    );
  }

  protected diffIndex(index1: Index, index2: Index): boolean {
    return !(index1.isFulfilledBy(index2) && index2.isFulfilledBy(index1));
  }

  private detectRenamedIndexes(
    addedIndexes: Map<string, Index>,
    removedIndexes: Map<string, Index>,
  ): Record<string, Index> {
    const candidatesByAddedName = new Map<string, [Index, Index][]>();

    for (const [addedKey, addedIndex] of addedIndexes) {
      for (const [, removedIndex] of removedIndexes) {
        if (this.diffIndex(addedIndex, removedIndex)) {
          continue;
        }

        const candidates = candidatesByAddedName.get(addedKey) ?? [];
        candidates.push([removedIndex, addedIndex]);
        candidatesByAddedName.set(addedKey, candidates);
      }
    }

    const renamedIndexes: Record<string, Index> = {};

    for (const candidates of candidatesByAddedName.values()) {
      if (candidates.length !== 1) {
        continue;
      }

      const [removedIndex, addedIndex] = candidates[0]!;
      const removedKey = normalizeAssetKey(removedIndex.getName());
      const addedKey = normalizeAssetKey(addedIndex.getName());

      if (Object.hasOwn(renamedIndexes, removedKey)) {
        continue;
      }

      renamedIndexes[removedKey] = addedIndex;
      addedIndexes.delete(addedKey);
      removedIndexes.delete(removedKey);
    }

    return renamedIndexes;
  }

  private detectRenamedColumns(
    modifiedColumns: Map<string, ColumnDiff>,
    addedColumns: Map<string, Column>,
    removedColumns: Map<string, Column>,
  ): void {
    const candidatesByAddedName = new Map<string, [Column, Column][]>();

    for (const [addedColumnName, addedColumn] of addedColumns) {
      for (const removedColumn of removedColumns.values()) {
        if (!this.columnsEqual(addedColumn, removedColumn)) {
          continue;
        }

        const candidates = candidatesByAddedName.get(addedColumnName) ?? [];
        candidates.push([removedColumn, addedColumn]);
        candidatesByAddedName.set(addedColumnName, candidates);
      }
    }

    for (const [addedColumnName, candidates] of candidatesByAddedName) {
      if (candidates.length !== 1) {
        continue;
      }

      const [oldColumn, newColumn] = candidates[0]!;
      const oldColumnName = normalizeAssetKey(oldColumn.getName());

      if (modifiedColumns.has(oldColumnName)) {
        continue;
      }

      modifiedColumns.set(oldColumnName, new ColumnDiff(oldColumn, newColumn, []));
      addedColumns.delete(addedColumnName);
      removedColumns.delete(oldColumnName);
    }
  }

  private isAutoIncrementSequenceInSchema(schema: Schema, sequence: Sequence): boolean {
    return schema.getTables().some((table) => sequence.isAutoIncrementsFor(table));
  }

  private isIntegerLikeColumnPair(oldColumn: Column, newColumn: Column): boolean {
    if (oldColumn.getType().constructor !== newColumn.getType().constructor) {
      return false;
    }

    return (
      oldColumn.getType() instanceof IntegerType ||
      oldColumn.getType() instanceof BigIntType ||
      oldColumn.getType() instanceof SmallIntType
    );
  }
}

function normalizeAssetKey(name: string): string {
  return name.replaceAll(/[`"[\]]/g, "").toLowerCase();
}

function normalizePlatformOptionsForComparison(
  options: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...options };
  delete normalized.default_constraint_name;
  delete normalized.DEFAULT_CONSTRAINT_NAME;

  for (const [key, value] of Object.entries(normalized)) {
    if (value === null || value === undefined) {
      delete normalized[key];
    }
  }

  return normalized;
}

function nonEmptyOrNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

function isDefaultNamespaceAlias(
  namespace: string,
  oldDefaultSchemaName: string | null,
  newDefaultSchemaName: string | null,
): boolean {
  const normalizedNamespace = normalizeAssetKey(namespace);

  return (
    (oldDefaultSchemaName !== null &&
      normalizedNamespace === normalizeAssetKey(oldDefaultSchemaName)) ||
    (newDefaultSchemaName !== null &&
      normalizedNamespace === normalizeAssetKey(newDefaultSchemaName))
  );
}
