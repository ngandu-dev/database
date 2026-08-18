import { Comparator as SQLServerComparator } from "../platforms/sqlserver/comparator";
import { Types } from "../types/types";
import { AbstractSchemaManager } from "./abstract-schema-manager";
import { Column } from "./column";
import { Comparator } from "./comparator";
import { ComparatorConfig } from "./comparator-config";
import { CurrentTimestamp } from "./default-expression/current-timestamp";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { Sequence } from "./sequence";
import { View } from "./view";

export class SQLServerSchemaManager extends AbstractSchemaManager {
  private databaseCollation: string | null = null;
  private currentSchemaName: string | null = null;

  public override async initialize(): Promise<void> {
    await this.loadCurrentSchemaName();
    await this.loadDatabaseCollation();
  }

  public async listSchemaNames(): Promise<string[]> {
    const rows = await this.connection.fetchFirstColumn<unknown>(`
SELECT name
FROM   sys.schemas
WHERE  name NOT IN('guest', 'INFORMATION_SCHEMA', 'sys')
`);

    return rows
      .map((value) =>
        typeof value === "string" || typeof value === "number" ? String(value) : null,
      )
      .filter((value): value is string => value !== null);
  }

  public override createComparator(config: ComparatorConfig = new ComparatorConfig()): Comparator {
    return new SQLServerComparator(this.platform, this.databaseCollation ?? "", config);
  }

  protected getListTableNamesSQL(): string {
    return "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = SCHEMA_NAME() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = SCHEMA_NAME() AND TABLE_TYPE = 'VIEW' ORDER BY TABLE_NAME";
  }

  protected override async determineCurrentSchemaName(): Promise<string | null> {
    const schemaName = await this.connection.fetchOne<unknown>("SELECT SCHEMA_NAME()");
    return typeof schemaName === "string" && schemaName.length > 0 ? schemaName : null;
  }

  protected override async selectTableNames(
    _databaseName: string,
  ): Promise<Record<string, unknown>[]> {
    const sql = `
SELECT SCHEMA_NAME(schema_id) AS schema_name,
       name AS table_name
FROM sys.tables
WHERE name != 'sysdiagrams'
ORDER BY name`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql);
  }

  protected override async selectTableColumns(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];
    const sql = `
SELECT scm.name AS schema_name,
       tbl.name AS table_name,
       col.name,
       type.name AS type,
       col.max_length AS length,
       ~col.is_nullable AS notnull,
       def.definition AS [default],
       def.name AS df_name,
       col.scale,
       col.precision,
       col.is_identity AS autoincrement,
       col.collation_name AS collation,
       CAST(prop.value AS NVARCHAR(MAX)) AS comment
FROM sys.columns AS col
JOIN sys.types AS type
  ON col.user_type_id = type.user_type_id
JOIN sys.tables AS tbl
  ON col.object_id = tbl.object_id
JOIN sys.schemas AS scm
  ON tbl.schema_id = scm.schema_id
LEFT JOIN sys.default_constraints def
  ON col.default_object_id = def.object_id
 AND col.object_id = def.parent_object_id
LEFT JOIN sys.extended_properties AS prop
  ON tbl.object_id = prop.major_id
 AND col.column_id = prop.minor_id
 AND prop.name = 'MS_Description'
WHERE ${this.getWhereClause(tableName, "scm.name", "tbl.name", params)}
ORDER BY scm.name,
         tbl.name,
         col.column_id`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async selectIndexColumns(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];
    const sql = `
SELECT scm.name AS schema_name,
       tbl.name AS table_name,
       idx.name AS key_name,
       col.name AS column_name,
       ~idx.is_unique AS non_unique,
       idx.is_primary_key AS [primary],
       CASE idx.type
         WHEN '1' THEN 'clustered'
         WHEN '2' THEN 'nonclustered'
         ELSE NULL
       END AS flags
FROM sys.tables AS tbl
JOIN sys.schemas AS scm
  ON tbl.schema_id = scm.schema_id
JOIN sys.indexes AS idx
  ON tbl.object_id = idx.object_id
JOIN sys.index_columns AS idxcol
  ON idx.object_id = idxcol.object_id
 AND idx.index_id = idxcol.index_id
JOIN sys.columns AS col
  ON idxcol.object_id = col.object_id
 AND idxcol.column_id = col.column_id
WHERE ${this.getWhereClause(tableName, "scm.name", "tbl.name", params)}
ORDER BY scm.name,
         tbl.name,
         idx.index_id,
         idxcol.key_ordinal`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async selectForeignKeyColumns(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];
    const sql = `
SELECT SCHEMA_NAME(f.schema_id) AS schema_name,
       OBJECT_NAME(f.parent_object_id) AS table_name,
       f.name AS ForeignKey,
       COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
       SCHEMA_NAME(t.schema_id) AS ReferenceSchemaName,
       OBJECT_NAME(f.referenced_object_id) AS ReferenceTableName,
       COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferenceColumnName,
       f.delete_referential_action_desc,
       f.update_referential_action_desc
FROM sys.foreign_keys AS f
INNER JOIN sys.foreign_key_columns AS fc
  ON f.object_id = fc.constraint_object_id
INNER JOIN sys.tables AS t
  ON t.object_id = fc.referenced_object_id
WHERE ${this.getWhereClause(
      tableName,
      "SCHEMA_NAME(f.schema_id)",
      "OBJECT_NAME(f.parent_object_id)",
      params,
    )}
ORDER BY SCHEMA_NAME(f.schema_id),
         OBJECT_NAME(f.parent_object_id),
         f.name,
         fc.constraint_column_id`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async fetchTableOptionsByTable(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, Record<string, unknown>>> {
    const params: unknown[] = [];
    const sql = `
SELECT scm.name AS schema_name,
       tbl.name AS table_name,
       p.value
FROM sys.tables AS tbl
JOIN sys.schemas AS scm
  ON tbl.schema_id = scm.schema_id
INNER JOIN sys.extended_properties AS p
  ON p.major_id = tbl.object_id
 AND p.minor_id = 0
 AND p.class = 1
WHERE p.name = N'MS_Description'
  AND ${this.getWhereClause(tableName, "scm.name", "tbl.name", params)}`;

    const rows = await this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
    const tableOptions: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      const table = this._getPortableTableDefinition(row);
      if (table.length === 0) {
        continue;
      }

      tableOptions[table] = {
        comment: readString(row, "value"),
      };
    }

    return tableOptions;
  }

  protected override _getPortableSequenceDefinition(sequence: Record<string, unknown>): Sequence {
    return new Sequence(
      readString(sequence, "name") ?? "",
      readNumber(sequence, "increment") ?? 1,
      readNumber(sequence, "start_value") ?? 1,
    );
  }

  protected override _getPortableTableColumnDefinition(
    tableColumn: Record<string, unknown>,
  ): Column {
    let dbType = readString(tableColumn, "type") ?? "";
    let length = readNumber(tableColumn, "length") ?? 0;
    const precision = readNumber(tableColumn, "precision");
    const scale = readNumber(tableColumn, "scale") ?? 0;
    let fixed = false;

    switch (dbType) {
      case "nchar":
      case "ntext":
        length /= 2;
        break;
      case "nvarchar":
        if (length !== -1) {
          length /= 2;
        }
        break;
      case "varchar":
        if (length === -1) {
          dbType = "text";
        }
        break;
      case "varbinary":
        if (length === -1) {
          dbType = "blob";
        }
        break;
    }

    if (dbType === "char" || dbType === "nchar" || dbType === "binary") {
      fixed = true;
    }

    const type = this.platform.getDatazenTypeMapping(dbType);
    const options: Record<string, unknown> = {
      autoincrement: readBoolean(tableColumn, "autoincrement") === true,
      fixed,
      notnull: readBoolean(tableColumn, "notnull") === true,
      precision,
      scale,
    };

    const comment = readString(tableColumn, "comment");
    if (comment !== null) {
      options.comment = comment;
    }

    if (length !== 0 && [Types.TEXT, Types.STRING, Types.BINARY].includes(type)) {
      options.length = length;
    }

    const column = new Column(readString(tableColumn, "name") ?? "", type, options);

    const defaultExpression = readString(tableColumn, "default");
    if (defaultExpression !== null) {
      column.setDefault(this.parseDefaultExpression(defaultExpression));

      const defaultConstraintName = readString(tableColumn, "df_name");
      if (defaultConstraintName !== null) {
        column.setPlatformOption("default_constraint_name", defaultConstraintName);
      }
    }

    column.setPlatformOption("collation", readString(tableColumn, "collation"));
    return column;
  }

  protected override _getPortableTableForeignKeysList(
    rows: Record<string, unknown>[],
  ): ForeignKeyConstraint[] {
    const currentSchemaName = this.currentSchemaName;
    const foreignKeys = new Map<
      string,
      {
        local_columns: string[];
        foreign_table: string;
        foreign_columns: string[];
        name: string;
        options: Record<string, unknown>;
      }
    >();

    for (const row of rows) {
      const name = readString(row, "ForeignKey");
      if (name === null) {
        continue;
      }

      let foreignKey = foreignKeys.get(name);
      if (foreignKey === undefined) {
        let referencedTableName = readString(row, "ReferenceTableName") ?? "";
        const referencedSchemaName = readString(row, "ReferenceSchemaName");

        if (referencedSchemaName !== null && referencedSchemaName !== currentSchemaName) {
          referencedTableName = `${referencedSchemaName}.${referencedTableName}`;
        }

        foreignKey = {
          foreign_columns: [],
          foreign_table: referencedTableName,
          local_columns: [],
          name,
          options: {
            onDelete: normalizeReferentialAction(readString(row, "delete_referential_action_desc")),
            onUpdate: normalizeReferentialAction(readString(row, "update_referential_action_desc")),
          },
        };
        foreignKeys.set(name, foreignKey);
      }

      const localColumn = readString(row, "ColumnName");
      if (localColumn !== null) {
        foreignKey.local_columns.push(localColumn);
      }

      const foreignColumn = readString(row, "ReferenceColumnName");
      if (foreignColumn !== null) {
        foreignKey.foreign_columns.push(foreignColumn);
      }
    }

    return super._getPortableTableForeignKeysList([...foreignKeys.values()]);
  }

  protected override _getPortableTableIndexesList(
    rows: Record<string, unknown>[],
    tableName: string,
  ): Index[] {
    return super._getPortableTableIndexesList(
      rows.map((row) => ({
        ...row,
        flags: readString(row, "flags") === null ? [] : [readString(row, "flags")],
        non_unique: readBoolean(row, "non_unique") === true,
        primary: readBoolean(row, "primary") === true,
      })),
      tableName,
    );
  }

  protected override _getPortableTableForeignKeyDefinition(
    tableForeignKey: Record<string, unknown>,
  ): ForeignKeyConstraint {
    return new ForeignKeyConstraint(
      toStringList(tableForeignKey.local_columns),
      readString(tableForeignKey, "foreign_table") ?? "",
      toStringList(tableForeignKey.foreign_columns),
      readString(tableForeignKey, "name"),
      (tableForeignKey.options as Record<string, unknown> | undefined) ?? {},
    );
  }

  protected override _getPortableTableDefinition(table: Record<string, unknown>): string {
    const tableName = readString(table, "table_name");
    if (tableName === null) {
      return "";
    }

    const schemaName = readString(table, "schema_name");
    if (schemaName === null || schemaName === this.currentSchemaName) {
      return tableName;
    }

    return `${schemaName}.${tableName}`;
  }

  protected override _getPortableDatabaseDefinition(database: Record<string, unknown>): string {
    return readString(database, "name") ?? "";
  }

  protected override _getPortableViewDefinition(view: Record<string, unknown>): View {
    return new View(readString(view, "name") ?? "", readString(view, "definition") ?? "");
  }

  private async loadDatabaseCollation(): Promise<void> {
    if (this.databaseCollation !== null) {
      return;
    }

    const databaseCollation = await this.connection.fetchOne<unknown>(
      `SELECT collation_name FROM sys.databases WHERE name = ${this.platform.getCurrentDatabaseExpression()}`,
    );

    if (typeof databaseCollation === "string" && databaseCollation.length > 0) {
      this.databaseCollation = databaseCollation;
    }
  }

  private async loadCurrentSchemaName(): Promise<void> {
    if (this.currentSchemaName !== null) {
      return;
    }

    this.currentSchemaName = await this.determineCurrentSchemaName();
  }

  private parseDefaultExpression(value: string): string | CurrentTimestamp | null {
    let normalized = value;
    let match = /^\((.*)\)$/s.exec(normalized);
    while (match !== null) {
      normalized = match[1]!;
      match = /^\((.*)\)$/s.exec(normalized);
    }

    if (normalized === "NULL") {
      return null;
    }

    const literal = /^'(.*)'$/s.exec(normalized);
    if (literal !== null) {
      normalized = literal[1]!.replaceAll("''", "'");
    }

    if (normalized.toLowerCase() === "getdate()") {
      return new CurrentTimestamp();
    }

    return normalized;
  }

  private getWhereClause(
    tableName: string | null,
    schemaColumn: string,
    tableColumn: string,
    params: unknown[],
  ): string {
    const conditions: string[] = [];

    if (tableName !== null) {
      const parsed = parseSchemaQualifiedTableName(tableName);
      if (parsed.schemaName !== null) {
        conditions.push(`${schemaColumn} = ?`);
        params.push(parsed.schemaName);
      } else {
        conditions.push(`${schemaColumn} = SCHEMA_NAME()`);
      }

      conditions.push(`${tableColumn} = ?`);
      params.push(parsed.tableName);
    }

    conditions.push(`${tableColumn} != 'sysdiagrams'`);
    return conditions.join(" AND ");
  }
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

function readString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

function readNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function readBoolean(row: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "y", "t"].includes(normalized)) {
        return true;
      }

      if (["0", "false", "no", "n", "f"].includes(normalized)) {
        return false;
      }
    }
  }

  return null;
}

function normalizeReferentialAction(action: string | null): string | null {
  if (action === null) {
    return null;
  }

  return action.replaceAll("_", " ");
}

function parseSchemaQualifiedTableName(tableName: string): {
  schemaName: string | null;
  tableName: string;
} {
  const trimmed = tableName.trim();
  const dotIndex = findUnquotedDot(trimmed);
  if (dotIndex === -1) {
    return {
      schemaName: null,
      tableName: stripIdentifierQuotes(trimmed),
    };
  }

  return {
    schemaName: stripIdentifierQuotes(trimmed.slice(0, dotIndex)),
    tableName: stripIdentifierQuotes(trimmed.slice(dotIndex + 1)),
  };
}

function findUnquotedDot(value: string): number {
  let inDoubleQuotes = false;
  let inSquareBrackets = false;
  let inBackticks = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (inDoubleQuotes) {
      if (char === '"' && next === '"') {
        index += 1;
        continue;
      }

      if (char === '"') {
        inDoubleQuotes = false;
      }

      continue;
    }

    if (inSquareBrackets) {
      if (char === "]" && next === "]") {
        index += 1;
        continue;
      }

      if (char === "]") {
        inSquareBrackets = false;
      }

      continue;
    }

    if (inBackticks) {
      if (char === "`" && next === "`") {
        index += 1;
        continue;
      }

      if (char === "`") {
        inBackticks = false;
      }

      continue;
    }

    if (char === '"') {
      inDoubleQuotes = true;
      continue;
    }

    if (char === "[") {
      inSquareBrackets = true;
      continue;
    }

    if (char === "`") {
      inBackticks = true;
      continue;
    }

    if (char === ".") {
      return index;
    }
  }

  return -1;
}

function stripIdentifierQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('""', '"');
  }

  if (trimmed.length >= 2 && trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1).replaceAll("``", "`");
  }

  if (trimmed.length >= 2 && trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).replaceAll("]]", "]");
  }

  if (trimmed.startsWith('"') || trimmed.startsWith("`") || trimmed.startsWith("[")) {
    return trimmed.slice(1);
  }

  if (trimmed.endsWith('"') || trimmed.endsWith("`") || trimmed.endsWith("]")) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}
