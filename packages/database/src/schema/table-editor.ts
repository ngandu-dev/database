import { Column } from "./column";
import { InvalidTableDefinition } from "./exception/invalid-table-definition";
import { InvalidTableModification } from "./exception/invalid-table-modification";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { PrimaryKeyConstraint } from "./primary-key-constraint";
import { Table } from "./table";
import { UniqueConstraint } from "./unique-constraint";

export class TableEditor {
  private name: string | null = null;
  private columns: Column[] = [];
  private indexes: Index[] = [];
  private primaryKeyConstraint: PrimaryKeyConstraint | null = null;
  private uniqueConstraints: UniqueConstraint[] = [];
  private foreignKeyConstraints: ForeignKeyConstraint[] = [];
  private options: Record<string, unknown> = {};

  public setName(name: string): this {
    this.name = name;
    return this;
  }

  public setQuotedName(name: string, schemaName: string | null = null): this {
    this.name = schemaName === null ? `"${name}"` : `"${schemaName}"."${name}"`;
    return this;
  }

  public setUnquotedName(name: string, schemaName: string | null = null): this {
    this.name = schemaName === null ? name : `${schemaName}.${name}`;
    return this;
  }

  public setColumns(...columns: Column[]): this {
    this.columns = [...columns];
    return this;
  }

  public addColumn(column: Column): this {
    if (this.columns.some((existing) => this.namesEqual(existing.getName(), column.getName()))) {
      throw InvalidTableModification.columnAlreadyExists(this.name, column.getName());
    }

    this.columns.push(column);
    return this;
  }

  public modifyColumn(
    columnName: string,
    modification: (editor: ReturnType<Column["edit"]>) => void,
  ): this {
    const index = this.columns.findIndex((column) => this.namesEqual(column.getName(), columnName));

    if (index < 0) {
      throw InvalidTableModification.columnDoesNotExist(this.name, columnName);
    }

    const column = this.columns[index];
    if (column === undefined) {
      throw InvalidTableModification.columnDoesNotExist(this.name, columnName);
    }

    const editor = column.edit();
    modification(editor);
    const modifiedColumn = editor.create();

    if (
      !this.namesEqual(column.getName(), modifiedColumn.getName()) &&
      this.columns.some(
        (existing, existingIndex) =>
          existingIndex !== index && this.namesEqual(existing.getName(), modifiedColumn.getName()),
      )
    ) {
      throw InvalidTableModification.columnAlreadyExists(this.name, modifiedColumn.getName());
    }

    this.columns[index] = modifiedColumn;

    if (!this.namesEqual(column.getName(), modifiedColumn.getName())) {
      this.renameColumnInIndexes(column.getName(), modifiedColumn.getName());
      this.renameColumnInPrimaryKeyConstraint(column.getName(), modifiedColumn.getName());
      this.renameColumnInForeignKeyConstraints(column.getName(), modifiedColumn.getName());
      this.renameColumnInUniqueConstraints(column.getName(), modifiedColumn.getName());
    }

    return this;
  }

  public modifyColumnByUnquotedName(
    columnName: string,
    modification: (editor: ReturnType<Column["edit"]>) => void,
  ): this {
    return this.modifyColumn(columnName, modification);
  }

  public renameColumn(oldColumnName: string, newColumnName: string): this {
    return this.modifyColumn(oldColumnName, (editor) => {
      editor.setName(newColumnName);
    });
  }

  public renameColumnByUnquotedName(oldColumnName: string, newColumnName: string): this {
    return this.renameColumn(oldColumnName, newColumnName);
  }

  public dropColumn(columnName: string): this {
    const index = this.columns.findIndex((column) => this.namesEqual(column.getName(), columnName));
    if (index < 0) {
      throw InvalidTableModification.columnDoesNotExist(this.name, columnName);
    }

    this.columns.splice(index, 1);
    return this;
  }

  public dropColumnByUnquotedName(columnName: string): this {
    return this.dropColumn(columnName);
  }

  public setIndexes(...indexes: Index[]): this {
    this.indexes = [...indexes];
    return this;
  }

  public addIndex(index: Index): this {
    if (this.indexes.some((existing) => this.namesEqual(existing.getName(), index.getName()))) {
      throw InvalidTableModification.indexAlreadyExists(this.name, index.getName());
    }

    this.indexes.push(index);
    return this;
  }

  public renameIndex(oldIndexName: string, newIndexName: string): this {
    const index = this.indexes.find((candidate) =>
      this.namesEqual(candidate.getName(), oldIndexName),
    );
    if (index === undefined) {
      throw InvalidTableModification.indexDoesNotExist(this.name, oldIndexName);
    }

    if (
      this.indexes.some(
        (candidate) => candidate !== index && this.namesEqual(candidate.getName(), newIndexName),
      )
    ) {
      throw InvalidTableModification.indexAlreadyExists(this.name, newIndexName);
    }

    const replacement = index.edit().setName(newIndexName).create();
    const position = this.indexes.indexOf(index);
    this.indexes[position] = replacement;
    return this;
  }

  public renameIndexByUnquotedName(oldIndexName: string, newIndexName: string): this {
    return this.renameIndex(oldIndexName, newIndexName);
  }

  public dropIndex(indexName: string): this {
    const index = this.indexes.findIndex((candidate) =>
      this.namesEqual(candidate.getName(), indexName),
    );
    if (index < 0) {
      throw InvalidTableModification.indexDoesNotExist(this.name, indexName);
    }

    this.indexes.splice(index, 1);
    return this;
  }

  public dropIndexByUnquotedName(indexName: string): this {
    return this.dropIndex(indexName);
  }

  public setPrimaryKeyConstraint(primaryKeyConstraint: PrimaryKeyConstraint | null): this {
    this.indexes = this.indexes.filter((index) => !index.isPrimary());
    this.primaryKeyConstraint = primaryKeyConstraint;
    return this;
  }

  public addPrimaryKeyConstraint(primaryKeyConstraint: PrimaryKeyConstraint): this {
    if (this.primaryKeyConstraint !== null) {
      throw InvalidTableModification.primaryKeyConstraintAlreadyExists(this.name);
    }

    return this.setPrimaryKeyConstraint(primaryKeyConstraint);
  }

  public dropPrimaryKeyConstraint(): this {
    if (this.primaryKeyConstraint === null) {
      throw InvalidTableModification.primaryKeyConstraintDoesNotExist(this.name);
    }

    return this.setPrimaryKeyConstraint(null);
  }

  public setUniqueConstraints(...uniqueConstraints: UniqueConstraint[]): this {
    this.uniqueConstraints = [...uniqueConstraints];
    return this;
  }

  public addUniqueConstraint(uniqueConstraint: UniqueConstraint): this {
    const objectName = uniqueConstraint.getObjectName();
    if (
      objectName !== null &&
      objectName.length > 0 &&
      this.uniqueConstraints.some(
        (existing) =>
          existing.getObjectName() !== null &&
          this.namesEqual(existing.getObjectName(), objectName),
      )
    ) {
      throw InvalidTableModification.uniqueConstraintAlreadyExists(this.name, objectName);
    }

    this.uniqueConstraints.push(uniqueConstraint);
    return this;
  }

  public dropUniqueConstraint(constraintName: string): this {
    const index = this.uniqueConstraints.findIndex((constraint) =>
      this.namesEqual(constraint.getObjectName(), constraintName),
    );

    if (index < 0) {
      throw InvalidTableModification.uniqueConstraintDoesNotExist(this.name, constraintName);
    }

    this.uniqueConstraints.splice(index, 1);
    return this;
  }

  public dropUniqueConstraintByUnquotedName(constraintName: string): this {
    return this.dropUniqueConstraint(constraintName);
  }

  public setForeignKeyConstraints(...foreignKeyConstraints: ForeignKeyConstraint[]): this {
    this.foreignKeyConstraints = [...foreignKeyConstraints];
    return this;
  }

  public addForeignKeyConstraint(foreignKeyConstraint: ForeignKeyConstraint): this {
    const constraintName = foreignKeyConstraint.getName();
    if (
      constraintName.length > 0 &&
      this.foreignKeyConstraints.some(
        (existing) =>
          existing.getName().length > 0 && this.namesEqual(existing.getName(), constraintName),
      )
    ) {
      throw InvalidTableModification.foreignKeyConstraintAlreadyExists(this.name, constraintName);
    }

    this.foreignKeyConstraints.push(foreignKeyConstraint);
    return this;
  }

  public dropForeignKeyConstraint(constraintName: string): this {
    const index = this.foreignKeyConstraints.findIndex((constraint) =>
      this.namesEqual(constraint.getName(), constraintName),
    );

    if (index < 0) {
      throw InvalidTableModification.foreignKeyConstraintDoesNotExist(this.name, constraintName);
    }

    this.foreignKeyConstraints.splice(index, 1);
    return this;
  }

  public dropForeignKeyConstraintByUnquotedName(constraintName: string): this {
    return this.dropForeignKeyConstraint(constraintName);
  }

  public setOptions(options: Record<string, unknown>): this {
    this.options = { ...options };
    return this;
  }

  public setComment(comment: string): this {
    this.options = { ...this.options, comment };
    return this;
  }

  public setConfiguration(_configuration: unknown): this {
    return this;
  }

  public create(): Table {
    if (this.name === null) {
      throw InvalidTableDefinition.nameNotSet();
    }

    if (this.columns.length === 0) {
      throw InvalidTableDefinition.columnsNotSet(this.name);
    }

    const table = new Table(this.name, this.columns, this.indexes, this.foreignKeyConstraints, {
      ...this.options,
    });

    if (this.primaryKeyConstraint !== null) {
      table.addPrimaryKeyConstraint(this.primaryKeyConstraint);
    }

    for (const uniqueConstraint of this.uniqueConstraints) {
      table.addUniqueConstraint(uniqueConstraint);
    }

    return table;
  }

  private namesEqual(left: string | null, right: string | null): boolean {
    return (left ?? "").toLowerCase() === (right ?? "").toLowerCase();
  }

  private renameColumnInIndexes(oldColumnName: string, newColumnName: string): void {
    this.indexes = this.indexes.map((index) => {
      const columns = index
        .getColumns()
        .map((columnName) =>
          this.namesEqual(columnName, oldColumnName) ? newColumnName : columnName,
        );

      if (
        columns.every((columnName, position) =>
          this.namesEqual(columnName, index.getColumns()[position] ?? ""),
        )
      ) {
        return index;
      }

      return index
        .edit()
        .setColumns(...columns)
        .create();
    });
  }

  private renameColumnInPrimaryKeyConstraint(oldColumnName: string, newColumnName: string): void {
    if (this.primaryKeyConstraint === null) {
      return;
    }

    const columns = this.primaryKeyConstraint
      .getColumnNames()
      .map((columnName) =>
        this.namesEqual(columnName, oldColumnName) ? newColumnName : columnName,
      );

    this.primaryKeyConstraint = this.primaryKeyConstraint
      .edit()
      .setColumnNames(...columns)
      .create();
  }

  private renameColumnInUniqueConstraints(oldColumnName: string, newColumnName: string): void {
    this.renameColumnInConstraints(
      this.uniqueConstraints,
      oldColumnName,
      newColumnName,
      (constraint) => constraint.getColumnNames(),
      (constraint, columnNames) =>
        constraint
          .edit()
          .setColumnNames(...columnNames)
          .create(),
    );
  }

  private renameColumnInForeignKeyConstraints(oldColumnName: string, newColumnName: string): void {
    this.renameColumnInConstraints(
      this.foreignKeyConstraints,
      oldColumnName,
      newColumnName,
      (constraint) => constraint.getReferencingColumnNames(),
      (constraint, columnNames) =>
        constraint
          .edit()
          .setReferencingColumnNames(...columnNames)
          .create(),
    );
  }

  private renameColumnInConstraints<TConstraint>(
    constraints: TConstraint[],
    oldColumnName: string,
    newColumnName: string,
    getColumnNames: (constraint: TConstraint) => string[],
    createModified: (constraint: TConstraint, columnNames: string[]) => TConstraint,
  ): void {
    for (let index = 0; index < constraints.length; index += 1) {
      const constraint = constraints[index];
      if (constraint === undefined) {
        continue;
      }

      const originalColumnNames = getColumnNames(constraint);
      const renamedColumnNames = originalColumnNames.map((columnName) =>
        this.namesEqual(columnName, oldColumnName) ? newColumnName : columnName,
      );

      const changed = originalColumnNames.some(
        (columnName, position) =>
          !this.namesEqual(columnName, renamedColumnNames[position] ?? columnName),
      );

      if (!changed) {
        continue;
      }

      constraints[index] = createModified(constraint, renamedColumnNames);
    }
  }
}
