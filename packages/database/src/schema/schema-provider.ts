import { Column } from "./column";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { OptionallyQualifiedName } from "./name/optionally-qualified-name";
import { UnqualifiedName } from "./name/unqualified-name";
import { PrimaryKeyConstraint } from "./primary-key-constraint";
import { Schema } from "./schema";
import { Sequence } from "./sequence";
import { Table } from "./table";
import { View } from "./view";

export interface SchemaProvider {
  createSchema(): Promise<Schema>;

  getAllDatabaseNames(): Promise<UnqualifiedName[]>;

  getAllSchemaNames(): Promise<UnqualifiedName[]>;

  getAllTableNames(): Promise<OptionallyQualifiedName[]>;

  getAllTables(): Promise<Table[]>;

  getColumnsForTable(schemaName: string | null, tableName: string): Promise<Column[]>;

  getIndexesForTable(schemaName: string | null, tableName: string): Promise<Index[]>;

  getPrimaryKeyConstraintForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<PrimaryKeyConstraint | null>;

  getForeignKeyConstraintsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<ForeignKeyConstraint[]>;

  getOptionsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<Record<string, unknown> | null>;

  getAllViews(): Promise<View[]>;

  getAllSequences(): Promise<Sequence[]>;
}
