import type { Connection } from "../../connection";
import { DatabaseMetadataRow } from "../../schema/metadata/database-metadata-row";
import { ForeignKeyConstraintColumnMetadataRow } from "../../schema/metadata/foreign-key-constraint-column-metadata-row";
import { IndexColumnMetadataRow } from "../../schema/metadata/index-column-metadata-row";
import type { MetadataProvider } from "../../schema/metadata/metadata-provider";
import { PrimaryKeyConstraintColumnRow } from "../../schema/metadata/primary-key-constraint-column-row";
import { SchemaMetadataRow } from "../../schema/metadata/schema-metadata-row";
import { SequenceMetadataRow } from "../../schema/metadata/sequence-metadata-row";
import { TableColumnMetadataRow } from "../../schema/metadata/table-column-metadata-row";
import { TableMetadataRow } from "../../schema/metadata/table-metadata-row";
import { ViewMetadataRow } from "../../schema/metadata/view-metadata-row";
import {
  createColumnFromMetadataRow,
  mapIndexType,
  mapMatchType,
  mapReferentialAction,
  pickBoolean,
  pickNumber,
  pickString,
} from "../_internal/metadata-provider-utils";
import type { SQLServerPlatform } from "../sqlserver-platform";

type MetadataQueryConnection = Pick<
  Connection,
  "fetchOne" | "fetchAllAssociative" | "fetchAllNumeric" | "fetchFirstColumn"
>;

export class SQLServerMetadataProvider implements MetadataProvider {
  public constructor(
    private readonly connection: MetadataQueryConnection,
    readonly _platform: SQLServerPlatform,
  ) {}

  public async getAllDatabaseNames(): Promise<DatabaseMetadataRow[]> {
    const names = await this.connection.fetchFirstColumn<string>(
      "SELECT name FROM sys.databases ORDER BY name",
    );
    return names.map((name) => new DatabaseMetadataRow(String(name)));
  }

  public async getAllSchemaNames(): Promise<SchemaMetadataRow[]> {
    const sql = `SELECT name
FROM sys.schemas
WHERE name NOT LIKE 'db_%'
  AND name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')`;
    const names = await this.connection.fetchFirstColumn<string>(sql);
    return names.map((name) => new SchemaMetadataRow(String(name)));
  }

  public async getAllTableNames(): Promise<TableMetadataRow[]> {
    const sql = `SELECT s.name, t.name
FROM sys.tables AS t
JOIN sys.schemas AS s ON t.schema_id = s.schema_id
WHERE s.name NOT LIKE 'db_%'
  AND s.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')
  AND t.name != 'sysdiagrams'
ORDER BY s.name, t.name`;
    const rows = await this.connection.fetchAllNumeric<[string, string]>(sql);
    return rows.map((row) => new TableMetadataRow(String(row[0]), String(row[1]), {}));
  }

  public async getTableColumnsForAllTables(): Promise<TableColumnMetadataRow[]> {
    return this.fetchTableColumns(null, null);
  }

  public async getTableColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<TableColumnMetadataRow[]> {
    return this.fetchTableColumns(schemaName, tableName);
  }

  public async getIndexColumnsForAllTables(): Promise<IndexColumnMetadataRow[]> {
    return this.fetchIndexColumns(null, null);
  }

  public async getIndexColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<IndexColumnMetadataRow[]> {
    return this.fetchIndexColumns(schemaName, tableName);
  }

  public async getPrimaryKeyConstraintColumnsForAllTables(): Promise<
    PrimaryKeyConstraintColumnRow[]
  > {
    return this.fetchPrimaryKeyColumns(null, null);
  }

  public async getPrimaryKeyConstraintColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<PrimaryKeyConstraintColumnRow[]> {
    return this.fetchPrimaryKeyColumns(schemaName, tableName);
  }

  public async getForeignKeyConstraintColumnsForAllTables(): Promise<
    ForeignKeyConstraintColumnMetadataRow[]
  > {
    return this.fetchForeignKeyColumns(null, null);
  }

  public async getForeignKeyConstraintColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<ForeignKeyConstraintColumnMetadataRow[]> {
    return this.fetchForeignKeyColumns(schemaName, tableName);
  }

  public async getTableOptionsForAllTables(): Promise<TableMetadataRow[]> {
    return (await this.getAllTableNames()).map(
      (table) => new TableMetadataRow(table.getSchemaName(), table.getTableName(), {}),
    );
  }

  public async getTableOptionsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<TableMetadataRow[]> {
    return [new TableMetadataRow(schemaName, tableName, {})];
  }

  public async getAllViews(): Promise<ViewMetadataRow[]> {
    const sql = `SELECT s.name, v.name, m.definition
FROM sys.views v
JOIN sys.schemas s ON v.schema_id = s.schema_id
JOIN sys.sql_modules m ON v.object_id = m.object_id
WHERE s.name NOT LIKE 'db_%'
  AND s.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')
ORDER BY s.name, v.name`;
    const rows = await this.connection.fetchAllNumeric<[string, string, string]>(sql);
    return rows.map((row) => new ViewMetadataRow(String(row[0]), String(row[1]), String(row[2])));
  }

  public async getAllSequences(): Promise<SequenceMetadataRow[]> {
    const sql = `SELECT scm.name, seq.name, seq.increment, seq.start_value
FROM sys.sequences AS seq
JOIN sys.schemas AS scm ON scm.schema_id = seq.schema_id`;
    const rows = await this.connection.fetchAllNumeric<[string, string, number, number]>(sql);
    return rows.map(
      (row) =>
        new SequenceMetadataRow(
          String(row[0]),
          String(row[1]),
          Number(row[2]),
          Number(row[3]),
          null,
        ),
    );
  }

  private async fetchTableColumns(
    schemaName: string | null,
    tableName: string | null,
  ): Promise<TableColumnMetadataRow[]> {
    const sql = `SELECT c.TABLE_SCHEMA AS table_schema,
       c.TABLE_NAME AS table_name,
       c.COLUMN_NAME AS column_name,
       c.DATA_TYPE AS data_type,
       c.CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
       c.NUMERIC_PRECISION AS numeric_precision,
       c.NUMERIC_SCALE AS numeric_scale,
       c.IS_NULLABLE AS is_nullable,
       c.COLLATION_NAME AS collation_name,
       c.COLUMN_DEFAULT AS column_default,
       d.name AS default_constraint_name
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN sys.tables t
  ON t.name = c.TABLE_NAME
 AND t.schema_id = SCHEMA_ID(c.TABLE_SCHEMA)
LEFT JOIN sys.columns sc
  ON sc.object_id = t.object_id
 AND sc.name = c.COLUMN_NAME
LEFT JOIN sys.default_constraints d
  ON d.parent_object_id = sc.object_id
 AND d.parent_column_id = sc.column_id
WHERE c.TABLE_SCHEMA NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')${
      schemaName === null ? "" : "\n  AND c.TABLE_SCHEMA = ?"
    }${tableName === null ? "" : "\n  AND c.TABLE_NAME = ?"}
ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`;
    const params = [
      ...(schemaName === null ? [] : [schemaName]),
      ...(tableName === null ? [] : [tableName]),
    ];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new TableColumnMetadataRow(
          pickString(row, "table_schema"),
          pickString(row, "table_name") ?? "",
          createColumnFromMetadataRow(this._platform, row),
        ),
    );
  }

  private async fetchIndexColumns(
    schemaName: string | null,
    tableName: string | null,
  ): Promise<IndexColumnMetadataRow[]> {
    const sql = `SELECT s.name AS table_schema,
       t.name AS table_name,
       i.name AS index_name,
       i.type_desc AS index_type,
       i.is_unique AS is_unique,
       CASE WHEN i.type_desc LIKE 'CLUSTERED%' THEN 1 ELSE 0 END AS is_clustered,
       i.filter_definition AS predicate,
       c.name AS column_name
FROM sys.indexes i
JOIN sys.tables t ON t.object_id = i.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = ic.column_id
WHERE i.is_primary_key = 0
  AND i.is_hypothetical = 0
  AND s.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')${schemaName === null ? "" : "\n  AND s.name = ?"}${
    tableName === null ? "" : "\n  AND t.name = ?"
  }
ORDER BY s.name, t.name, i.name, ic.key_ordinal`;
    const params = [
      ...(schemaName === null ? [] : [schemaName]),
      ...(tableName === null ? [] : [tableName]),
    ];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new IndexColumnMetadataRow(
          pickString(row, "table_schema"),
          pickString(row, "table_name") ?? "",
          pickString(row, "index_name") ?? "",
          mapIndexType(row),
          pickBoolean(row, "is_clustered") === true,
          pickString(row, "predicate"),
          pickString(row, "column_name") ?? "",
          pickNumber(row, "column_length"),
        ),
    );
  }

  private async fetchPrimaryKeyColumns(
    schemaName: string | null,
    tableName: string | null,
  ): Promise<PrimaryKeyConstraintColumnRow[]> {
    const sql = `SELECT s.name AS table_schema,
       t.name AS table_name,
       kc.name AS constraint_name,
       CASE WHEN i.type_desc LIKE 'CLUSTERED%' THEN 1 ELSE 0 END AS is_clustered,
       c.name AS column_name
FROM sys.key_constraints kc
JOIN sys.tables t ON t.object_id = kc.parent_object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.indexes i ON i.object_id = kc.parent_object_id AND i.index_id = kc.unique_index_id
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
WHERE kc.type = 'PK'${schemaName === null ? "" : "\n  AND s.name = ?"}${
      tableName === null ? "" : "\n  AND t.name = ?"
    }
ORDER BY s.name, t.name, kc.name, ic.key_ordinal`;
    const params = [
      ...(schemaName === null ? [] : [schemaName]),
      ...(tableName === null ? [] : [tableName]),
    ];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new PrimaryKeyConstraintColumnRow(
          pickString(row, "table_schema"),
          pickString(row, "table_name") ?? "",
          pickString(row, "constraint_name"),
          pickBoolean(row, "is_clustered") === true,
          pickString(row, "column_name") ?? "",
        ),
    );
  }

  private async fetchForeignKeyColumns(
    schemaName: string | null,
    tableName: string | null,
  ): Promise<ForeignKeyConstraintColumnMetadataRow[]> {
    const sql = `SELECT s.name AS table_schema,
       t.name AS table_name,
       fk.object_id AS fk_id,
       fk.name AS constraint_name,
       rs.name AS referenced_table_schema,
       rt.name AS referenced_table_name,
       pc.name AS column_name,
       rc.name AS referenced_column_name,
       fk.update_referential_action_desc AS update_rule,
       fk.delete_referential_action_desc AS delete_rule,
       fkc.constraint_column_id AS ordinal_position
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.tables t ON t.object_id = fk.parent_object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.columns pc ON pc.object_id = t.object_id AND pc.column_id = fkc.parent_column_id
JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
WHERE s.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')${schemaName === null ? "" : "\n  AND s.name = ?"}${
      tableName === null ? "" : "\n  AND t.name = ?"
    }
ORDER BY s.name, t.name, fk.name, fkc.constraint_column_id`;
    const params = [
      ...(schemaName === null ? [] : [schemaName]),
      ...(tableName === null ? [] : [tableName]),
    ];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new ForeignKeyConstraintColumnMetadataRow(
          pickString(row, "table_schema"),
          pickString(row, "table_name") ?? "",
          pickNumber(row, "fk_id"),
          pickString(row, "constraint_name"),
          pickString(row, "referenced_table_schema"),
          pickString(row, "referenced_table_name") ?? "",
          mapMatchType(null),
          mapReferentialAction(pickString(row, "update_rule")),
          mapReferentialAction(pickString(row, "delete_rule")),
          null,
          null,
          pickString(row, "column_name") ?? "",
          pickString(row, "referenced_column_name") ?? "",
        ),
    );
  }
}
