import type { DatabaseMetadataRow } from "./database-metadata-row";
import type { ForeignKeyConstraintColumnMetadataRow } from "./foreign-key-constraint-column-metadata-row";
import type { IndexColumnMetadataRow } from "./index-column-metadata-row";
import type { PrimaryKeyConstraintColumnRow } from "./primary-key-constraint-column-row";
import type { SchemaMetadataRow } from "./schema-metadata-row";
import type { SequenceMetadataRow } from "./sequence-metadata-row";
import type { TableColumnMetadataRow } from "./table-column-metadata-row";
import type { TableMetadataRow } from "./table-metadata-row";
import type { ViewMetadataRow } from "./view-metadata-row";

export interface MetadataProvider {
  getAllDatabaseNames(): Promise<DatabaseMetadataRow[]>;
  getAllSchemaNames(): Promise<SchemaMetadataRow[]>;
  getAllTableNames(): Promise<TableMetadataRow[]>;
  getTableColumnsForAllTables(): Promise<TableColumnMetadataRow[]>;
  getTableColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<TableColumnMetadataRow[]>;
  getIndexColumnsForAllTables(): Promise<IndexColumnMetadataRow[]>;
  getIndexColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<IndexColumnMetadataRow[]>;
  getPrimaryKeyConstraintColumnsForAllTables(): Promise<PrimaryKeyConstraintColumnRow[]>;
  getPrimaryKeyConstraintColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<PrimaryKeyConstraintColumnRow[]>;
  getForeignKeyConstraintColumnsForAllTables(): Promise<ForeignKeyConstraintColumnMetadataRow[]>;
  getForeignKeyConstraintColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<ForeignKeyConstraintColumnMetadataRow[]>;
  getTableOptionsForAllTables(): Promise<TableMetadataRow[]>;
  getTableOptionsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<TableMetadataRow[]>;
  getAllViews(): Promise<ViewMetadataRow[]>;
  getAllSequences(): Promise<SequenceMetadataRow[]>;
}
