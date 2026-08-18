import type { Connection } from "../../connection";
import { DatabaseMetadataRow } from "../../schema/metadata/database-metadata-row";
import { ForeignKeyConstraintColumnMetadataRow } from "../../schema/metadata/foreign-key-constraint-column-metadata-row";
import { IndexColumnMetadataRow } from "../../schema/metadata/index-column-metadata-row";
import type { MetadataProvider } from "../../schema/metadata/metadata-provider";
import { PrimaryKeyConstraintColumnRow } from "../../schema/metadata/primary-key-constraint-column-row";
import { TableColumnMetadataRow } from "../../schema/metadata/table-column-metadata-row";
import { TableMetadataRow } from "../../schema/metadata/table-metadata-row";
import { ViewMetadataRow } from "../../schema/metadata/view-metadata-row";
import {
  buildTableOptions,
  createColumnFromMetadataRow,
  mapIndexType,
  mapMatchType,
  mapReferentialAction,
  pickNumber,
  pickString,
} from "../_internal/metadata-provider-utils";
import type { AbstractMySQLPlatform } from "../abstract-mysql-platform";
import { NotSupported } from "../exception/not-supported";

type MetadataQueryConnection = Pick<
  Connection,
  "fetchOne" | "fetchAllAssociative" | "fetchAllNumeric" | "fetchFirstColumn"
>;

export class MySQLMetadataProvider implements MetadataProvider {
  public constructor(
    private readonly connection: MetadataQueryConnection,
    readonly _platform: AbstractMySQLPlatform,
    private readonly databaseName: string,
  ) {}

  public async getAllDatabaseNames(): Promise<DatabaseMetadataRow[]> {
    const sql = `SELECT SCHEMA_NAME
FROM information_schema.SCHEMATA
ORDER BY SCHEMA_NAME`;

    const names = await this.connection.fetchFirstColumn<string>(sql);
    return names.map((name) => new DatabaseMetadataRow(String(name)));
  }

  public async getAllSchemaNames(): Promise<never[]> {
    throw NotSupported.new("MySQLMetadataProvider.getAllSchemaNames");
  }

  public async getAllTableNames(): Promise<TableMetadataRow[]> {
    const sql = `SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = ?
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME`;

    const rows = await this.connection.fetchAllNumeric<[string]>(sql, [this.databaseName]);
    return rows.map((row) => new TableMetadataRow(null, String(row[0]), {}));
  }

  public async getTableColumnsForAllTables(): Promise<TableColumnMetadataRow[]> {
    return this.fetchTableColumns(null);
  }

  public async getTableColumnsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<TableColumnMetadataRow[]> {
    return this.fetchTableColumns(tableName);
  }

  public async getIndexColumnsForAllTables(): Promise<IndexColumnMetadataRow[]> {
    return this.fetchIndexColumns(null);
  }

  public async getIndexColumnsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<IndexColumnMetadataRow[]> {
    return this.fetchIndexColumns(tableName);
  }

  public async getPrimaryKeyConstraintColumnsForAllTables(): Promise<
    PrimaryKeyConstraintColumnRow[]
  > {
    return this.fetchPrimaryKeyColumns(null);
  }

  public async getPrimaryKeyConstraintColumnsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<PrimaryKeyConstraintColumnRow[]> {
    return this.fetchPrimaryKeyColumns(tableName);
  }

  public async getForeignKeyConstraintColumnsForAllTables(): Promise<
    ForeignKeyConstraintColumnMetadataRow[]
  > {
    return this.fetchForeignKeyColumns(null);
  }

  public async getForeignKeyConstraintColumnsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<ForeignKeyConstraintColumnMetadataRow[]> {
    return this.fetchForeignKeyColumns(tableName);
  }

  public async getTableOptionsForAllTables(): Promise<TableMetadataRow[]> {
    return this.fetchTableOptions(null);
  }

  public async getTableOptionsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<TableMetadataRow[]> {
    return this.fetchTableOptions(tableName);
  }

  public async getAllViews(): Promise<ViewMetadataRow[]> {
    const sql = `SELECT TABLE_NAME,
       VIEW_DEFINITION
FROM information_schema.VIEWS
WHERE TABLE_SCHEMA = ?
ORDER BY TABLE_NAME`;

    const rows = await this.connection.fetchAllNumeric<[string, string]>(sql, [this.databaseName]);
    return rows.map((row) => new ViewMetadataRow(null, String(row[0]), String(row[1])));
  }

  public async getAllSequences(): Promise<never[]> {
    throw NotSupported.new("MySQLMetadataProvider.getAllSequences");
  }

  private async fetchTableColumns(tableName: string | null): Promise<TableColumnMetadataRow[]> {
    const dataTypeSql = this._platform.getColumnTypeSQLSnippet("c", this.databaseName);
    const sql = `SELECT c.TABLE_NAME,
       c.COLUMN_NAME,
       ${dataTypeSql} AS DATA_TYPE,
       c.COLUMN_TYPE,
       c.IS_NULLABLE,
       c.COLUMN_DEFAULT,
       c.CHARACTER_MAXIMUM_LENGTH,
       c.NUMERIC_PRECISION,
       c.NUMERIC_SCALE,
       c.EXTRA,
       c.COLUMN_COMMENT,
       c.CHARACTER_SET_NAME,
       c.COLLATION_NAME
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = ?${tableName === null ? "" : "\n  AND c.TABLE_NAME = ?"}
ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`;
    const params = tableName === null ? [this.databaseName] : [this.databaseName, tableName];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new TableColumnMetadataRow(
          null,
          pickString(row, "TABLE_NAME", "table_name") ?? "",
          createColumnFromMetadataRow(this._platform, row),
        ),
    );
  }

  private async fetchIndexColumns(tableName: string | null): Promise<IndexColumnMetadataRow[]> {
    const sql = `SELECT TABLE_NAME,
       INDEX_NAME,
       NON_UNIQUE,
       INDEX_TYPE,
       COLUMN_NAME,
       SUB_PART
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = ?
  AND INDEX_NAME <> 'PRIMARY'${tableName === null ? "" : "\n  AND TABLE_NAME = ?"}
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`;
    const params = tableName === null ? [this.databaseName] : [this.databaseName, tableName];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new IndexColumnMetadataRow(
          null,
          pickString(row, "TABLE_NAME", "table_name") ?? "",
          pickString(row, "INDEX_NAME", "index_name") ?? "",
          mapIndexType(row),
          false,
          null,
          pickString(row, "COLUMN_NAME", "column_name") ?? "",
          pickNumber(row, "SUB_PART", "sub_part"),
        ),
    );
  }

  private async fetchPrimaryKeyColumns(
    tableName: string | null,
  ): Promise<PrimaryKeyConstraintColumnRow[]> {
    const sql = `SELECT TABLE_NAME,
       INDEX_NAME,
       COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = ?
  AND INDEX_NAME = 'PRIMARY'${tableName === null ? "" : "\n  AND TABLE_NAME = ?"}
ORDER BY TABLE_NAME, SEQ_IN_INDEX`;
    const params = tableName === null ? [this.databaseName] : [this.databaseName, tableName];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new PrimaryKeyConstraintColumnRow(
          null,
          pickString(row, "TABLE_NAME", "table_name") ?? "",
          pickString(row, "INDEX_NAME", "index_name"),
          true,
          pickString(row, "COLUMN_NAME", "column_name") ?? "",
        ),
    );
  }

  private async fetchForeignKeyColumns(
    tableName: string | null,
  ): Promise<ForeignKeyConstraintColumnMetadataRow[]> {
    const sql = `SELECT kcu.TABLE_NAME,
       kcu.CONSTRAINT_NAME,
       kcu.ORDINAL_POSITION,
       kcu.COLUMN_NAME,
       kcu.REFERENCED_TABLE_SCHEMA,
       kcu.REFERENCED_TABLE_NAME,
       kcu.REFERENCED_COLUMN_NAME,
       rc.MATCH_OPTION,
       rc.UPDATE_RULE,
       rc.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE AS kcu
LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS AS rc
  ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
 AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE kcu.TABLE_SCHEMA = ?
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL${tableName === null ? "" : "\n  AND kcu.TABLE_NAME = ?"}
ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`;
    const params = tableName === null ? [this.databaseName] : [this.databaseName, tableName];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map((row) => {
      const fkName = pickString(row, "CONSTRAINT_NAME", "constraint_name");
      const rowId =
        fkName ??
        pickNumber(row, "ORDINAL_POSITION", "ordinal_position") ??
        pickString(row, "TABLE_NAME", "table_name") ??
        "";

      return new ForeignKeyConstraintColumnMetadataRow(
        null,
        pickString(row, "TABLE_NAME", "table_name") ?? "",
        rowId,
        fkName,
        null,
        pickString(row, "REFERENCED_TABLE_NAME", "referenced_table_name") ?? "",
        mapMatchType(pickString(row, "MATCH_OPTION", "match_option")),
        mapReferentialAction(pickString(row, "UPDATE_RULE", "update_rule")),
        mapReferentialAction(pickString(row, "DELETE_RULE", "delete_rule")),
        null,
        null,
        pickString(row, "COLUMN_NAME", "column_name") ?? "",
        pickString(row, "REFERENCED_COLUMN_NAME", "referenced_column_name") ?? "",
      );
    });
  }

  private async fetchTableOptions(tableName: string | null): Promise<TableMetadataRow[]> {
    const sql = `SELECT TABLE_NAME,
       ENGINE,
       TABLE_COLLATION,
       TABLE_COMMENT,
       AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = ?
  AND TABLE_TYPE = 'BASE TABLE'${tableName === null ? "" : "\n  AND TABLE_NAME = ?"}
ORDER BY TABLE_NAME`;
    const params = tableName === null ? [this.databaseName] : [this.databaseName, tableName];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map((row) => {
      const tableCollation = pickString(row, "TABLE_COLLATION", "table_collation");
      const tableCharset =
        tableCollation === null ? null : (tableCollation.split("_").at(0) ?? tableCollation);
      const normalizedRow = tableCharset === null ? row : { ...row, table_charset: tableCharset };

      return new TableMetadataRow(
        null,
        pickString(row, "TABLE_NAME", "table_name") ?? "",
        buildTableOptions(normalizedRow),
      );
    });
  }
}
