import { Type } from "../types/type";
import { AbstractAsset } from "./abstract-asset";
import type { ColumnOptions } from "./column";
import { Column } from "./column";
import { ColumnAlreadyExists } from "./exception/column-already-exists";
import { ColumnDoesNotExist } from "./exception/column-does-not-exist";
import { ForeignKeyDoesNotExist } from "./exception/foreign-key-does-not-exist";
import { IndexAlreadyExists } from "./exception/index-already-exists";
import { IndexDoesNotExist } from "./exception/index-does-not-exist";
import { InvalidState } from "./exception/invalid-state";
import { InvalidTableName } from "./exception/invalid-table-name";
import { PrimaryKeyAlreadyExists } from "./exception/primary-key-already-exists";
import { UniqueConstraintDoesNotExist } from "./exception/unique-constraint-does-not-exist";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { OptionallyQualifiedName } from "./name/optionally-qualified-name";
import type { OptionallyQualifiedNameParser } from "./name/parser/optionally-qualified-name-parser";
import { Parsers } from "./name/parsers";
import { PrimaryKeyConstraint } from "./primary-key-constraint";
import { SchemaConfig } from "./schema-config";
import { TableEditor } from "./table-editor";
import { UniqueConstraint } from "./unique-constraint";

export class Table extends AbstractAsset {
  private readonly columns: Record<string, Column> = {};
  private readonly indexes: Record<string, Index> = {};
  private readonly foreignKeys: Record<string, ForeignKeyConstraint> = {};
  private readonly uniqueConstraints: Record<string, UniqueConstraint> = {};
  private readonly renamedColumns: Record<string, string> = {};
  private options: Record<string, unknown>;
  private primaryKeyName: string | null = null;
  private schemaConfig: SchemaConfig | null = null;

  constructor(
    name: string,
    columns: Column[] = [],
    indexes: Index[] = [],
    foreignKeys: ForeignKeyConstraint[] = [],
    options: Record<string, unknown> = {},
  ) {
    super(name);
    if (this.getName().trim().length === 0) {
      throw InvalidTableName.new(name);
    }
    this.options = { ...options };

    for (const column of columns) {
      this.columns[getAssetKey(column.getName())] = column;
    }

    for (const index of indexes) {
      this.addIndexObject(index);
    }

    for (const foreignKey of foreignKeys) {
      this.addForeignKeyObject(foreignKey);
    }
  }

  public addColumn(name: string, type: string | Type, options: ColumnOptions = {}): Column {
    if (this.hasColumn(name)) {
      throw ColumnAlreadyExists.new(this.getName(), name);
    }

    const column = new Column(name, type, options);
    this.columns[getAssetKey(name)] = column;
    return column;
  }

  public changeColumn(name: string, options: ColumnOptions): Column {
    const column = this.getColumn(name);
    column.setOptions(options);
    return column;
  }

  public modifyColumn(name: string, options: ColumnOptions): this {
    this.changeColumn(name, options);
    return this;
  }

  public hasColumn(name: string): boolean {
    return Object.hasOwn(this.columns, getAssetKey(name));
  }

  public getColumn(name: string): Column {
    const key = getAssetKey(name);
    const column = this.columns[key];

    if (column === undefined) {
      throw ColumnDoesNotExist.new(name, this.getName());
    }

    return column;
  }

  public getColumns(): Column[] {
    return Object.values(this.columns);
  }

  public getObjectName(): OptionallyQualifiedName {
    const parsableName = this.isQuoted()
      ? this.getName()
          .split(".")
          .map((part) => `"${part.replaceAll('"', '""')}"`)
          .join(".")
      : this.getName();

    return this.getNameParser().parse(parsableName);
  }

  public dropColumn(name: string): this {
    delete this.columns[getAssetKey(name)];
    return this;
  }

  public addIndex(
    columnNames: string[],
    indexName?: string,
    flags: string[] = [],
    options: Record<string, unknown> = {},
  ): Index {
    const name =
      indexName ??
      this._generateIdentifierName(
        [this.getName(), ...columnNames],
        "idx",
        this._getMaxIdentifierLength(),
      );
    const index = new Index(name, columnNames, false, false, flags, options);
    this.addIndexObject(index);
    return index;
  }

  public addUniqueIndex(
    columnNames: string[],
    indexName?: string,
    options: Record<string, unknown> = {},
  ): Index {
    const name =
      indexName ??
      this._generateIdentifierName(
        [this.getName(), ...columnNames],
        "uniq",
        this._getMaxIdentifierLength(),
      );
    const index = new Index(name, columnNames, true, false, [], options);
    this.addIndexObject(index);
    return index;
  }

  public setPrimaryKey(columnNames: string[], indexName?: string): Index {
    if (this.hasPrimaryKey()) {
      throw PrimaryKeyAlreadyExists.new(this.getName());
    }

    const name = indexName ?? "primary";
    const index = new Index(name, columnNames, true, true);
    this.primaryKeyName = name;
    this.addIndexObject(index);
    return index;
  }

  public addPrimaryKeyConstraint(primaryKeyConstraint: PrimaryKeyConstraint): this {
    const indexName = primaryKeyConstraint.getObjectName() ?? undefined;
    this.setPrimaryKey(primaryKeyConstraint.getColumnNames(), indexName);

    if (!primaryKeyConstraint.isClustered() && this.hasPrimaryKey()) {
      this.getPrimaryKey().addFlag("nonclustered");
    }

    return this;
  }

  public dropPrimaryKey(): void {
    if (this.primaryKeyName === null) {
      return;
    }

    this.dropIndex(this.primaryKeyName);
    this.primaryKeyName = null;
  }

  public hasPrimaryKey(): boolean {
    return this.primaryKeyName !== null && this.hasIndex(this.primaryKeyName);
  }

  public getPrimaryKey(): Index {
    if (this.primaryKeyName === null) {
      throw InvalidState.tableHasInvalidPrimaryKeyConstraint(this.getName());
    }

    return this.getIndex(this.primaryKeyName);
  }

  public getPrimaryKeyColumns(): string[] {
    if (!this.hasPrimaryKey()) {
      return [];
    }

    return this.getPrimaryKey().getColumns();
  }

  public getPrimaryKeyConstraint(): PrimaryKeyConstraint | null {
    if (!this.hasPrimaryKey()) {
      return null;
    }

    const primaryKey = this.getPrimaryKey();

    return new PrimaryKeyConstraint(
      primaryKey.getName(),
      primaryKey.getColumns(),
      !primaryKey.hasFlag("nonclustered"),
    );
  }

  public addIndexObject(index: Index): void {
    const key = getAssetKey(index.getName());
    if (Object.hasOwn(this.indexes, key)) {
      throw IndexAlreadyExists.new(index.getName(), this.getName());
    }

    this.indexes[key] = index;

    if (index.isPrimary()) {
      this.primaryKeyName = index.getName();
    }
  }

  public hasIndex(name: string): boolean {
    return Object.hasOwn(this.indexes, getAssetKey(name));
  }

  public getIndex(name: string): Index {
    const key = getAssetKey(name);
    const index = this.indexes[key];

    if (index === undefined) {
      throw IndexDoesNotExist.new(name, this.getName());
    }

    return index;
  }

  public getIndexes(): Index[] {
    return Object.values(this.indexes);
  }

  public dropIndex(name: string): void {
    if (!this.hasIndex(name)) {
      throw IndexDoesNotExist.new(name, this.getName());
    }

    if (this.primaryKeyName !== null && getAssetKey(this.primaryKeyName) === getAssetKey(name)) {
      this.primaryKeyName = null;
    }

    delete this.indexes[getAssetKey(name)];
  }

  public renameIndex(oldName: string, newName?: string | null): this {
    const oldIndex = this.getIndex(oldName);
    const normalizedOldName = getAssetKey(oldIndex.getName());
    const targetName = newName ?? null;

    if (targetName !== null && getAssetKey(oldIndex.getName()) === getAssetKey(targetName)) {
      return this;
    }

    if (targetName !== null && this.hasIndex(targetName)) {
      throw IndexAlreadyExists.new(targetName, this.getName());
    }

    delete this.indexes[normalizedOldName];

    if (oldIndex.isPrimary()) {
      if (this.primaryKeyName !== null && getAssetKey(this.primaryKeyName) === normalizedOldName) {
        this.primaryKeyName = null;
      }

      this.setPrimaryKey(oldIndex.getColumns(), targetName ?? undefined);
      return this;
    }

    if (oldIndex.isUnique()) {
      this.addUniqueIndex(oldIndex.getColumns(), targetName ?? undefined, oldIndex.getOptions());
      return this;
    }

    this.addIndex(
      oldIndex.getColumns(),
      targetName ?? undefined,
      oldIndex.getFlags(),
      oldIndex.getOptions(),
    );

    return this;
  }

  public columnsAreIndexed(columnNames: string[]): boolean {
    return this.getIndexes().some((index) => index.spansColumns(columnNames));
  }

  public addForeignKeyConstraint(
    foreignTableName: string,
    localColumnNames: string[],
    foreignColumnNames: string[],
    options: Record<string, unknown> = {},
    name?: string,
  ): ForeignKeyConstraint {
    const constraintName =
      name ??
      this._generateIdentifierName(
        [this.getName(), ...localColumnNames],
        "fk",
        this._getMaxIdentifierLength(),
      );
    const foreignKey = new ForeignKeyConstraint(
      localColumnNames,
      foreignTableName,
      foreignColumnNames,
      constraintName,
      options,
      this.getName(),
    );

    this.addForeignKeyObject(foreignKey);
    return foreignKey;
  }

  public addForeignKeyObject(foreignKey: ForeignKeyConstraint): void {
    const key = this.getForeignKeyStorageKey(foreignKey);
    this.foreignKeys[key] = foreignKey;
    this.addImplicitForeignKeyIndex(foreignKey);
  }

  public hasForeignKey(name: string): boolean {
    return Object.hasOwn(this.foreignKeys, getAssetKey(name));
  }

  public getForeignKey(name: string): ForeignKeyConstraint {
    const key = getAssetKey(name);
    const foreignKey = this.foreignKeys[key];

    if (foreignKey === undefined) {
      throw ForeignKeyDoesNotExist.new(name, this.getName());
    }

    return foreignKey;
  }

  public getForeignKeys(): ForeignKeyConstraint[] {
    return Object.values(this.foreignKeys);
  }

  public removeForeignKey(name: string): void {
    if (!this.hasForeignKey(name)) {
      throw ForeignKeyDoesNotExist.new(name, this.getName());
    }

    delete this.foreignKeys[getAssetKey(name)];
  }

  public dropForeignKey(name: string): void {
    this.removeForeignKey(name);
  }

  public addUniqueConstraint(uniqueConstraint: UniqueConstraint): this {
    const explicitName = uniqueConstraint.getObjectName();
    const resolvedName =
      explicitName !== null && explicitName.length > 0
        ? explicitName
        : this._generateIdentifierName(
            uniqueConstraint.getColumnNames(),
            "uniq",
            this._getMaxIdentifierLength(),
          );

    const key = getAssetKey(resolvedName);
    if (Object.hasOwn(this.uniqueConstraints, key)) {
      throw IndexAlreadyExists.new(resolvedName, this.getName());
    }

    if (explicitName === null) {
      uniqueConstraint = uniqueConstraint
        .edit()
        .setName(resolvedName)
        .setColumnNames(...uniqueConstraint.getColumnNames())
        .create();
    }

    this.uniqueConstraints[key] = uniqueConstraint;

    const hasBackingIndex = this.getIndexes().some(
      (index) => index.isUnique() && index.spansColumns(uniqueConstraint.getColumnNames()),
    );

    if (!hasBackingIndex) {
      this.addUniqueIndex(
        uniqueConstraint.getColumnNames(),
        uniqueConstraint.getObjectName() ?? undefined,
        uniqueConstraint.getOptions(),
      );
    }

    return this;
  }

  public hasUniqueConstraint(name: string): boolean {
    return Object.hasOwn(this.uniqueConstraints, getAssetKey(name));
  }

  public getUniqueConstraint(name: string): UniqueConstraint {
    const uniqueConstraint = this.uniqueConstraints[getAssetKey(name)];
    if (uniqueConstraint === undefined) {
      throw UniqueConstraintDoesNotExist.new(name, this.getName());
    }

    return uniqueConstraint;
  }

  public removeUniqueConstraint(name: string): void {
    this.dropUniqueConstraint(name);
  }

  public dropUniqueConstraint(name: string): void {
    const key = getAssetKey(name);
    if (!Object.hasOwn(this.uniqueConstraints, key)) {
      throw UniqueConstraintDoesNotExist.new(name, this.getName());
    }

    delete this.uniqueConstraints[key];
  }

  public getUniqueConstraints(): UniqueConstraint[] {
    return Object.values(this.uniqueConstraints);
  }

  public addOption(name: string, value: unknown): this {
    this.options[name] = value;
    return this;
  }

  public hasOption(name: string): boolean {
    return Object.hasOwn(this.options, name);
  }

  public getOption(name: string): unknown {
    return this.options[name];
  }

  public getOptions(): Record<string, unknown> {
    return { ...this.options };
  }

  public setComment(comment: string): this {
    return this.addOption("comment", comment);
  }

  public getComment(): string | null {
    const comment = this.options.comment;
    return typeof comment === "string" ? comment : null;
  }

  public setSchemaConfig(schemaConfig: SchemaConfig): void {
    this.schemaConfig = schemaConfig;
  }

  public getRenamedColumns(): Record<string, string> {
    return { ...this.renamedColumns };
  }

  public renameColumn(oldName: string, newName: string): Column {
    const oldKey = getAssetKey(oldName);
    const newKey = getAssetKey(newName);

    if (oldKey === newKey) {
      throw new Error(`Attempt to rename column "${this.getName()}.${oldName}" to the same name.`);
    }

    const column = this.getColumn(oldName);
    const renamedColumn = column.edit().setName(newName).create();
    delete this.columns[oldKey];

    if (Object.hasOwn(this.columns, newKey)) {
      throw ColumnAlreadyExists.new(this.getName(), newName);
    }

    this.columns[newKey] = renamedColumn;

    this.renameColumnInIndexes(oldName, newName);
    this.renameColumnInForeignKeyConstraints(oldName, newName);
    this.renameColumnInUniqueConstraints(oldName, newName);

    if (Object.hasOwn(this.renamedColumns, oldKey)) {
      const original = this.renamedColumns[oldKey];
      if (original !== undefined) {
        delete this.renamedColumns[oldKey];
        if (original !== newKey) {
          this.renamedColumns[newKey] = original;
        }
      }
    } else {
      this.renamedColumns[newKey] = oldKey;
    }

    return renamedColumn;
  }

  public static editor(): TableEditor {
    return new TableEditor();
  }

  public edit(): TableEditor {
    const editor = Table.editor()
      .setName(this.getName())
      .setColumns(...this.getColumns())
      .setIndexes(...this.getIndexes())
      .setForeignKeyConstraints(...this.getForeignKeys())
      .setUniqueConstraints(...this.getUniqueConstraints())
      .setOptions(this.getOptions());

    if (this.getComment() !== null) {
      editor.setComment(this.getComment() ?? "");
    }

    if (this.schemaConfig !== null) {
      editor.setConfiguration(this.schemaConfig);
    }

    const primaryKeyConstraint = this.getPrimaryKeyConstraint();
    if (primaryKeyConstraint !== null) {
      editor.setPrimaryKeyConstraint(primaryKeyConstraint);
    }

    return editor;
  }

  protected getNameParser(): OptionallyQualifiedNameParser {
    return Parsers.getOptionallyQualifiedNameParser();
  }

  protected _getMaxIdentifierLength(): number {
    return this.schemaConfig?.getMaxIdentifierLength() ?? 63;
  }

  protected _addColumn(column: Column): void {
    this.columns[getAssetKey(column.getName())] = column;
  }

  protected _addIndex(index: Index): this {
    this.addIndexObject(index);
    return this;
  }

  protected _addUniqueConstraint(constraint: UniqueConstraint): this {
    this.addUniqueConstraint(constraint);
    return this;
  }

  protected _addForeignKeyConstraint(constraint: ForeignKeyConstraint): this {
    this.addForeignKeyObject(constraint);
    return this;
  }

  private getForeignKeyStorageKey(foreignKey: ForeignKeyConstraint): string {
    const normalizedName = getAssetKey(foreignKey.getName());
    if (normalizedName.length > 0) {
      return normalizedName;
    }

    let index = Object.keys(this.foreignKeys).length;
    let candidate = `__unnamed_fk_${index}`;
    while (Object.hasOwn(this.foreignKeys, candidate)) {
      index += 1;
      candidate = `__unnamed_fk_${index}`;
    }

    return candidate;
  }

  private renameColumnInIndexes(oldName: string, newName: string): void {
    for (const [key, index] of Object.entries(this.indexes)) {
      const originalColumns = index.getColumns();
      const columns = originalColumns.map((columnName) =>
        getAssetKey(columnName) === getAssetKey(oldName) ? newName : columnName,
      );

      const changed = originalColumns.some(
        (columnName, indexPosition) =>
          getAssetKey(columnName) !== getAssetKey(columns[indexPosition] ?? columnName),
      );

      if (!changed) {
        continue;
      }

      this.indexes[key] = index
        .edit()
        .setColumns(...columns)
        .create();
    }
  }

  private renameColumnInForeignKeyConstraints(oldName: string, newName: string): void {
    for (const [key, constraint] of Object.entries(this.foreignKeys)) {
      const originalColumns = constraint.getColumns();
      const localColumns = originalColumns.map((columnName) =>
        getAssetKey(columnName) === getAssetKey(oldName) ? newName : columnName,
      );

      const changed = originalColumns.some(
        (columnName, indexPosition) =>
          getAssetKey(columnName) !== getAssetKey(localColumns[indexPosition] ?? columnName),
      );

      if (!changed) {
        continue;
      }

      this.foreignKeys[key] = constraint
        .edit()
        .setReferencingColumnNames(...localColumns)
        .create();
    }
  }

  private renameColumnInUniqueConstraints(oldName: string, newName: string): void {
    for (const [key, constraint] of Object.entries(this.uniqueConstraints)) {
      const originalColumns = constraint.getColumnNames();
      const columns = originalColumns.map((columnName) =>
        getAssetKey(columnName) === getAssetKey(oldName) ? newName : columnName,
      );

      const changed = originalColumns.some(
        (columnName, indexPosition) =>
          getAssetKey(columnName) !== getAssetKey(columns[indexPosition] ?? columnName),
      );

      if (!changed) {
        continue;
      }

      this.uniqueConstraints[key] = constraint
        .edit()
        .setColumnNames(...columns)
        .create();
    }
  }

  private addImplicitForeignKeyIndex(foreignKey: ForeignKeyConstraint): void {
    const localColumns = foreignKey.getLocalColumns();
    const indexName = this._generateIdentifierName(
      [this.getName(), ...localColumns],
      "idx",
      this._getMaxIdentifierLength(),
    );
    const indexCandidate = new Index(indexName, localColumns, false, false);

    for (const existingIndex of this.getIndexes()) {
      if (indexCandidate.isFulfilledBy(existingIndex)) {
        return;
      }
    }

    this.addIndexObject(indexCandidate);
  }
}

function getAssetKey(name: string): string {
  return name.replaceAll(/[`"[\]]/g, "").toLowerCase();
}
