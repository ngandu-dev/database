import { AbstractSchemaManager } from "../abstract-schema-manager";
import { Column } from "../column";
import { ForeignKeyConstraint } from "../foreign-key-constraint";
import { Index } from "../index";
import { OptionallyQualifiedName } from "../name/optionally-qualified-name";
import { UnqualifiedName } from "../name/unqualified-name";
import { PrimaryKeyConstraint } from "../primary-key-constraint";
import { Schema } from "../schema";
import { SchemaProvider } from "../schema-provider";
import { Sequence } from "../sequence";
import { Table } from "../table";
import { View } from "../view";

export class IntrospectingSchemaProvider implements SchemaProvider {
  constructor(private readonly schemaManager: AbstractSchemaManager) {}

  public async createSchema(): Promise<Schema> {
    return this.schemaManager.createSchema();
  }

  public async getAllDatabaseNames(): Promise<UnqualifiedName[]> {
    const names = await this.invokeOptional<string[]>("listDatabases", []);
    return names.map((name) => UnqualifiedName.unquoted(name));
  }

  public async getAllSchemaNames(): Promise<UnqualifiedName[]> {
    const names = await this.invokeOptional<string[]>("listSchemaNames", []);
    return names.map((name) => UnqualifiedName.unquoted(name));
  }

  public async getAllTableNames(): Promise<OptionallyQualifiedName[]> {
    const names = await this.schemaManager.listTableNames();
    return names.map((name) => parseOptionallyQualifiedName(name));
  }

  public async getAllTables(): Promise<Table[]> {
    return this.schemaManager.listTables();
  }

  public async getColumnsForTable(schemaName: string | null, tableName: string): Promise<Column[]> {
    const qualifiedTableName = qualifyTableName(schemaName, tableName);
    const columns = await this.invokeOptional<Column[]>("listTableColumns", [], qualifiedTableName);

    if (columns.length > 0) {
      return columns;
    }

    const table = await this.tryIntrospectTable(qualifiedTableName);
    return table?.getColumns() ?? [];
  }

  public async getIndexesForTable(schemaName: string | null, tableName: string): Promise<Index[]> {
    const qualifiedTableName = qualifyTableName(schemaName, tableName);
    const indexes = await this.invokeOptional<Index[]>("listTableIndexes", [], qualifiedTableName);

    if (indexes.length > 0) {
      return indexes;
    }

    const table = await this.tryIntrospectTable(qualifiedTableName);
    return table?.getIndexes() ?? [];
  }

  public async getPrimaryKeyConstraintForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<PrimaryKeyConstraint | null> {
    const qualifiedTableName = qualifyTableName(schemaName, tableName);
    const primaryKey = await this.invokeOptional<PrimaryKeyConstraint | null>(
      "listTablePrimaryKey",
      null,
      qualifiedTableName,
    );

    if (primaryKey !== null) {
      return primaryKey;
    }

    const table = await this.tryIntrospectTable(qualifiedTableName);
    return table?.getPrimaryKeyConstraint() ?? null;
  }

  public async getForeignKeyConstraintsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<ForeignKeyConstraint[]> {
    const qualifiedTableName = qualifyTableName(schemaName, tableName);
    const foreignKeys = await this.invokeOptional<ForeignKeyConstraint[]>(
      "listTableForeignKeys",
      [],
      qualifiedTableName,
    );

    if (foreignKeys.length > 0) {
      return foreignKeys;
    }

    const table = await this.tryIntrospectTable(qualifiedTableName);
    return table?.getForeignKeys() ?? [];
  }

  public async getOptionsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<Record<string, unknown> | null> {
    const qualifiedTableName = qualifyTableName(schemaName, tableName);
    const options = await this.invokeOptional<Record<string, unknown> | null>(
      "listTableOptions",
      null,
      qualifiedTableName,
    );

    if (options !== null) {
      return options;
    }

    const table = await this.tryIntrospectTable(qualifiedTableName);
    return table?.getOptions() ?? null;
  }

  public async getAllViews(): Promise<View[]> {
    return this.schemaManager.listViews();
  }

  public async getAllSequences(): Promise<Sequence[]> {
    return this.invokeOptional<Sequence[]>("listSequences", []);
  }

  private async tryIntrospectTable(tableName: string): Promise<Table | null> {
    return this.invokeOptional<Table | null>("introspectTable", null, tableName);
  }

  private async invokeOptional<T>(methodName: string, fallback: T, ...args: unknown[]): Promise<T> {
    const method = (this.schemaManager as unknown as Record<string, unknown>)[methodName];

    if (typeof method !== "function") {
      return fallback;
    }

    const value = await (method as (...callArgs: unknown[]) => Promise<unknown>).apply(
      this.schemaManager,
      args,
    );

    return (value as T) ?? fallback;
  }
}

function qualifyTableName(schemaName: string | null, tableName: string): string {
  return schemaName === null ? tableName : `${schemaName}.${tableName}`;
}

function parseOptionallyQualifiedName(name: string): OptionallyQualifiedName {
  const parts = name.split(".");
  const unqualifiedName = parts.pop() ?? name;
  const qualifier = parts.length > 0 ? parts.join(".") : null;
  return OptionallyQualifiedName.unquoted(unqualifiedName, qualifier);
}
