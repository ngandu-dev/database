import type { Connection } from "../../connection";
import { ForeignKeyConstraintColumnMetadataRow } from "../../schema/metadata/foreign-key-constraint-column-metadata-row";
import { IndexColumnMetadataRow } from "../../schema/metadata/index-column-metadata-row";
import type { MetadataProvider } from "../../schema/metadata/metadata-provider";
import { PrimaryKeyConstraintColumnRow } from "../../schema/metadata/primary-key-constraint-column-row";
import { SequenceMetadataRow } from "../../schema/metadata/sequence-metadata-row";
import { TableColumnMetadataRow } from "../../schema/metadata/table-column-metadata-row";
import { TableMetadataRow } from "../../schema/metadata/table-metadata-row";
import { ViewMetadataRow } from "../../schema/metadata/view-metadata-row";
import {
  createColumnFromMetadataRow,
  mapIndexType,
  mapMatchType,
  mapReferentialAction,
  pickNumber,
  pickString,
} from "../_internal/metadata-provider-utils";
import type { DB2Platform } from "../db2-platform";
import { NotSupported } from "../exception/not-supported";

type MetadataQueryConnection = Pick<
  Connection,
  "fetchOne" | "fetchAllAssociative" | "fetchAllNumeric" | "fetchFirstColumn"
>;

export class Db2MetadataProvider implements MetadataProvider {
  public constructor(
    private readonly connection: MetadataQueryConnection,
    readonly _platform: DB2Platform,
  ) {}

  public async getAllDatabaseNames(): Promise<never[]> {
    throw NotSupported.new("Db2MetadataProvider.getAllDatabaseNames");
  }

  public async getAllSchemaNames(): Promise<never[]> {
    throw NotSupported.new("Db2MetadataProvider.getAllSchemaNames");
  }

  public async getAllTableNames(): Promise<TableMetadataRow[]> {
    const sql = `SELECT TABNAME
FROM SYSCAT.TABLES
WHERE TABSCHEMA = CURRENT USER
  AND TYPE = 'T'
ORDER BY TABNAME`;

    const rows = await this.connection.fetchAllNumeric<[string]>(sql);
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
    return (await this.getAllTableNames()).map(
      (table) => new TableMetadataRow(null, table.getTableName(), {}),
    );
  }

  public async getTableOptionsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<TableMetadataRow[]> {
    return [new TableMetadataRow(null, tableName, {})];
  }

  public async getAllViews(): Promise<ViewMetadataRow[]> {
    const sql = `SELECT VIEWNAME, TEXT
FROM SYSCAT.VIEWS
WHERE VIEWSCHEMA = CURRENT USER
ORDER BY VIEWNAME`;

    const rows = await this.connection.fetchAllNumeric<[string, string]>(sql);
    return rows.map((row) => new ViewMetadataRow(null, String(row[0]), String(row[1])));
  }

  public async getAllSequences(): Promise<SequenceMetadataRow[]> {
    const sql = `SELECT SEQNAME, INCREMENT, START, CACHE
FROM SYSCAT.SEQUENCES
WHERE SEQSCHEMA = CURRENT USER
ORDER BY SEQNAME`;
    const rows = await this.connection.fetchAllAssociative(sql);

    return rows.map(
      (row) =>
        new SequenceMetadataRow(
          null,
          pickString(row, "SEQNAME", "seqname") ?? "",
          pickNumber(row, "INCREMENT", "increment") ?? 1,
          pickNumber(row, "START", "start") ?? 1,
          pickNumber(row, "CACHE", "cache"),
        ),
    );
  }

  private async fetchTableColumns(tableName: string | null): Promise<TableColumnMetadataRow[]> {
    const sql = `SELECT TABNAME AS table_name,
       COLNAME AS column_name,
       TYPENAME AS data_type,
       LENGTH AS character_maximum_length,
       SCALE AS numeric_scale,
       NULLS AS is_nullable,
       DEFAULT AS column_default,
       REMARKS AS remarks
FROM SYSCAT.COLUMNS
WHERE TABSCHEMA = CURRENT USER${tableName === null ? "" : "\n  AND TABNAME = ?"}
ORDER BY TABNAME, COLNO`;
    const rows = await this.connection.fetchAllAssociative(
      sql,
      tableName === null ? [] : [tableName],
    );

    return rows.map(
      (row) =>
        new TableColumnMetadataRow(
          null,
          pickString(row, "table_name") ?? "",
          createColumnFromMetadataRow(this._platform, {
            ...row,
            is_nullable: pickString(row, "is_nullable") === "Y" ? "YES" : "NO",
          }),
        ),
    );
  }

  private async fetchIndexColumns(tableName: string | null): Promise<IndexColumnMetadataRow[]> {
    const sql = `SELECT i.TABNAME AS table_name,
       i.INDNAME AS index_name,
       i.UNIQUERULE AS unique_rule,
       'BTREE' AS index_type,
       c.COLNAME AS column_name
FROM SYSCAT.INDEXES i
JOIN SYSCAT.INDEXCOLUSE c
  ON c.INDSCHEMA = i.INDSCHEMA
 AND c.INDNAME = i.INDNAME
WHERE i.TABSCHEMA = CURRENT USER
  AND i.UNIQUERULE <> 'P'${tableName === null ? "" : "\n  AND i.TABNAME = ?"}
ORDER BY i.TABNAME, i.INDNAME, c.COLSEQ`;
    const rows = await this.connection.fetchAllAssociative(
      sql,
      tableName === null ? [] : [tableName],
    );

    return rows.map((row) => {
      const uniqueRule = pickString(row, "unique_rule");
      return new IndexColumnMetadataRow(
        null,
        pickString(row, "table_name") ?? "",
        pickString(row, "index_name") ?? "",
        mapIndexType({ ...row, is_unique: uniqueRule === "U" || uniqueRule === "D" }),
        false,
        null,
        pickString(row, "column_name") ?? "",
        null,
      );
    });
  }

  private async fetchPrimaryKeyColumns(
    tableName: string | null,
  ): Promise<PrimaryKeyConstraintColumnRow[]> {
    const sql = `SELECT i.TABNAME AS table_name,
       i.INDNAME AS constraint_name,
       c.COLNAME AS column_name
FROM SYSCAT.INDEXES i
JOIN SYSCAT.INDEXCOLUSE c
  ON c.INDSCHEMA = i.INDSCHEMA
 AND c.INDNAME = i.INDNAME
WHERE i.TABSCHEMA = CURRENT USER
  AND i.UNIQUERULE = 'P'${tableName === null ? "" : "\n  AND i.TABNAME = ?"}
ORDER BY i.TABNAME, c.COLSEQ`;
    const rows = await this.connection.fetchAllAssociative(
      sql,
      tableName === null ? [] : [tableName],
    );

    return rows.map(
      (row) =>
        new PrimaryKeyConstraintColumnRow(
          null,
          pickString(row, "table_name") ?? "",
          pickString(row, "constraint_name"),
          false,
          pickString(row, "column_name") ?? "",
        ),
    );
  }

  private async fetchForeignKeyColumns(
    tableName: string | null,
  ): Promise<ForeignKeyConstraintColumnMetadataRow[]> {
    const sql = `SELECT r.TABNAME AS table_name,
       r.CONSTNAME AS constraint_name,
       k.COLNAME AS column_name,
       r.REFTABNAME AS referenced_table_name,
       rk.COLNAME AS referenced_column_name,
       r.DELETERULE AS delete_rule,
       r.UPDATERULE AS update_rule,
       k.COLSEQ AS ordinal_position
FROM SYSCAT.REFERENCES r
JOIN SYSCAT.KEYCOLUSE k
  ON k.TABSCHEMA = r.TABSCHEMA
 AND k.TABNAME = r.TABNAME
 AND k.CONSTNAME = r.CONSTNAME
LEFT JOIN SYSCAT.KEYCOLUSE rk
  ON rk.TABSCHEMA = r.REFTABSCHEMA
 AND rk.TABNAME = r.REFTABNAME
 AND rk.CONSTNAME = r.REFKEYNAME
 AND rk.COLSEQ = k.COLSEQ
WHERE r.TABSCHEMA = CURRENT USER${tableName === null ? "" : "\n  AND r.TABNAME = ?"}
ORDER BY r.TABNAME, r.CONSTNAME, k.COLSEQ`;
    const rows = await this.connection.fetchAllAssociative(
      sql,
      tableName === null ? [] : [tableName],
    );

    return rows.map((row) => {
      const name = pickString(row, "constraint_name");
      return new ForeignKeyConstraintColumnMetadataRow(
        null,
        pickString(row, "table_name") ?? "",
        pickNumber(row, "ordinal_position"),
        name,
        null,
        pickString(row, "referenced_table_name") ?? "",
        mapMatchType(null),
        mapReferentialAction(pickString(row, "update_rule")),
        mapReferentialAction(pickString(row, "delete_rule")),
        null,
        null,
        pickString(row, "column_name") ?? "",
        pickString(row, "referenced_column_name") ?? "",
      );
    });
  }
}
