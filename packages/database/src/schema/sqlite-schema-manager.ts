import { NotSupported } from "../platforms/exception/not-supported";
import { Comparator as SQLiteComparator } from "../platforms/sqlite/comparator";
import { Types } from "../types/types";
import { AbstractSchemaManager } from "./abstract-schema-manager";
import { Column } from "./column";
import { Comparator } from "./comparator";
import { ComparatorConfig } from "./comparator-config";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Table } from "./table";
import { TableDiff } from "./table-diff";

interface SQLiteForeignKeyDetail {
  constraint_name: string;
  deferrable: boolean;
  deferred: boolean;
}

export class SQLiteSchemaManager extends AbstractSchemaManager {
  protected override normalizeName(name: string): string {
    return stripPossiblyQuotedSQLiteIdentifier(name.trim());
  }

  protected getListTableNamesSQL(): string {
    return `SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name NOT IN ('geometry_columns', 'spatial_ref_sys', 'sqlite_sequence')
UNION ALL
SELECT name
FROM sqlite_temp_master
WHERE type = 'table'
ORDER BY name`;
  }

  protected getListViewNamesSQL(): string {
    return "SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name";
  }

  public override async listDatabases(): Promise<string[]> {
    throw NotSupported.new("SQLiteSchemaManager.listDatabases");
  }

  public override async createForeignKey(
    foreignKey: ForeignKeyConstraint,
    table: string,
  ): Promise<void> {
    const oldTable = await this.introspectTable(table);
    const newTable = oldTable.edit().addForeignKeyConstraint(foreignKey).create();

    await this.alterTable(
      new TableDiff(oldTable, newTable, {
        addedForeignKeys: [foreignKey],
      }),
    );
  }

  public override async dropForeignKey(name: string, table: string): Promise<void> {
    const oldTable = await this.introspectTable(table);
    const foreignKey = oldTable.getForeignKey(name);
    const newTable = oldTable.edit().dropForeignKeyConstraint(name).create();

    await this.alterTable(
      new TableDiff(oldTable, newTable, {
        droppedForeignKeys: [foreignKey],
      }),
    );
  }

  public override createComparator(config: ComparatorConfig = new ComparatorConfig()): Comparator {
    return new SQLiteComparator(this.platform, config);
  }

  public override async introspectTable(name: string): Promise<Table> {
    const table = await super.introspectTable(name);
    const foreignKeys = await this.listTableForeignKeys(name);

    if (foreignKeys.length === 0) {
      return table;
    }

    return table
      .edit()
      .setForeignKeyConstraints(...foreignKeys)
      .create();
  }

  protected override _getPortableTableDefinition(table: Record<string, unknown>): string {
    return readString(table, "table_name", "name") ?? "";
  }

  protected override _getPortableTableColumnDefinition(
    tableColumn: Record<string, unknown>,
  ): Column {
    const typeDeclaration = readString(tableColumn, "type") ?? "";
    const matches = /^([A-Z\s]+?)(?:\s*\((\d+)(?:,\s*(\d+))?\))?$/i.exec(typeDeclaration);
    if (matches === null) {
      throw new Error(`Unable to parse SQLite column type declaration "${typeDeclaration}".`);
    }

    let dbType = matches[1]!.toLowerCase();
    let length: number | null = null;
    let precision: number | null = null;
    let scale = 0;
    let unsigned = false;
    let fixed = false;

    if (matches[2] !== undefined) {
      if (matches[3] !== undefined) {
        precision = Number.parseInt(matches[2]!, 10);
        scale = Number.parseInt(matches[3]!, 10);
      } else {
        length = Number.parseInt(matches[2]!, 10);
      }
    }

    if (dbType.includes(" unsigned")) {
      dbType = dbType.replace(" unsigned", "");
      unsigned = true;
    }

    const typeName = this.platform.getDatazenTypeMapping(dbType);
    let defaultValue = tableColumn.dflt_value;
    if (defaultValue === "NULL") {
      defaultValue = null;
    }

    if (typeof defaultValue === "string") {
      const literalMatch = /^'(.*)'$/s.exec(defaultValue);
      if (literalMatch !== null) {
        defaultValue = literalMatch[1]!.replaceAll("''", "'");
      }
    }

    defaultValue = normalizeSQLiteDefaultValue(typeName, defaultValue);

    if (dbType === "char") {
      fixed = true;
    }

    const column = new Column(readString(tableColumn, "name") ?? "", typeName, {
      autoincrement: tableColumn.autoincrement === true,
      comment: readString(tableColumn, "comment") ?? "",
      default: defaultValue,
      fixed,
      length,
      notnull: readBoolean(tableColumn, "notnull"),
      precision,
      scale,
      unsigned,
    });

    if (typeName === Types.STRING || typeName === Types.TEXT) {
      column.setPlatformOption("collation", readString(tableColumn, "collation") ?? "BINARY");
    }

    return column;
  }

  protected override _getPortableTableForeignKeysList(
    rows: Record<string, unknown>[],
  ): ForeignKeyConstraint[] {
    const grouped = new Map<
      string,
      {
        name: string;
        local: string[];
        foreign: string[];
        foreignTable: string;
        onDelete: string | null;
        onUpdate: string | null;
        deferrable: boolean;
        deferred: boolean;
      }
    >();

    for (const row of rows) {
      const id = String(readString(row, "id") ?? readNumber(row, "id") ?? "");
      if (id.length === 0) {
        continue;
      }

      const onDelete = normalizeReferentialAction(readString(row, "on_delete"));
      const onUpdate = normalizeReferentialAction(readString(row, "on_update"));

      if (!grouped.has(id)) {
        grouped.set(id, {
          deferrable: readBoolean(row, "deferrable"),
          deferred: readBoolean(row, "deferred"),
          foreign: [],
          foreignTable: readString(row, "table") ?? "",
          local: [],
          name: readString(row, "constraint_name") ?? "",
          onDelete,
          onUpdate,
        });
      }

      const group = grouped.get(id);
      if (group === undefined) {
        continue;
      }

      const localColumn = stripWrappingIdentifierQuotes(readString(row, "from") ?? "");
      if (localColumn.length > 0) {
        group.local.push(localColumn);
      }

      const foreignColumn = readString(row, "to");
      if (foreignColumn !== null) {
        group.foreign.push(stripWrappingIdentifierQuotes(foreignColumn));
      }
    }

    return [...grouped.values()].map((row) => this._getPortableTableForeignKeyDefinition(row));
  }

  protected override _getPortableTableForeignKeyDefinition(
    tableForeignKey: Record<string, unknown>,
  ): ForeignKeyConstraint {
    const localColumns = Array.isArray(tableForeignKey.local)
      ? tableForeignKey.local.map((value) => String(value))
      : [];
    const foreignColumns = Array.isArray(tableForeignKey.foreign)
      ? tableForeignKey.foreign.map((value) => String(value))
      : [];

    return new ForeignKeyConstraint(
      localColumns,
      readString(tableForeignKey, "foreignTable") ?? "",
      foreignColumns,
      readString(tableForeignKey, "name"),
      {
        deferrable: tableForeignKey.deferrable === true,
        deferred: tableForeignKey.deferred === true,
        onDelete: readString(tableForeignKey, "onDelete"),
        onUpdate: readString(tableForeignKey, "onUpdate"),
      },
    );
  }

  protected override async selectTableColumns(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];

    const sql = `SELECT t.name AS table_name,
       c.*
FROM sqlite_master t
JOIN pragma_table_info(t.name) c
WHERE ${this.getWhereClause(tableName, params)}
ORDER BY t.name,
       c.cid`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async selectIndexColumns(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];

    const sql = `SELECT t.name AS table_name,
       i.name,
       i."unique",
       c.name AS column_name
FROM sqlite_master t
JOIN pragma_index_list(t.name) i
JOIN pragma_index_info(i.name) c
WHERE ${this.getWhereClause(tableName, params)}
  AND i.name NOT LIKE 'sqlite_%'
ORDER BY t.name, i.seq, c.seqno`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async selectForeignKeyColumns(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];

    const sql = `SELECT t.name AS table_name,
       p.*
FROM sqlite_master t
JOIN pragma_foreign_key_list(t.name) p
  ON p.seq != '-1'
WHERE ${this.getWhereClause(tableName, params)}
ORDER BY t.name,
       p.id DESC,
       p.seq`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async fetchTableColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const rows = await super.fetchTableColumns(databaseName, tableName);

    const sqlByTable = new Map<string, string>();
    const pkColumnNamesByTable = new Map<string, string[]>();

    for (const row of rows) {
      const rowTableName = readString(row, "table_name") ?? "";
      if (!sqlByTable.has(rowTableName)) {
        sqlByTable.set(rowTableName, await this.getCreateTableSQL(rowTableName));
      }

      if (!isPrimaryIntegerColumn(row)) {
        continue;
      }

      const columnNames = pkColumnNamesByTable.get(rowTableName) ?? [];
      columnNames.push(readString(row, "name") ?? "");
      pkColumnNamesByTable.set(rowTableName, columnNames);
    }

    return rows.map((row) => {
      const rowTableName = readString(row, "table_name") ?? "";
      const columnName = readString(row, "name") ?? "";
      const tableSql = sqlByTable.get(rowTableName) ?? "";

      return {
        ...row,
        autoincrement: hasSinglePrimaryIntegerColumn(
          pkColumnNamesByTable.get(rowTableName) ?? [],
          columnName,
        ),
        collation: this.parseColumnCollationFromSQL(columnName, tableSql),
        comment: this.parseColumnCommentFromSQL(columnName, tableSql),
      };
    });
  }

  protected override async fetchIndexColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const result: Record<string, unknown>[] = [];
    const primaryKeyRows = await this.fetchPrimaryKeyColumns(tableName);

    for (const primaryKeyRow of primaryKeyRows) {
      result.push({
        column_name: readString(primaryKeyRow, "name") ?? "",
        key_name: "primary",
        non_unique: false,
        primary: true,
        table_name: readString(primaryKeyRow, "table_name") ?? "",
      });
    }

    const indexColumnRows = await super.fetchIndexColumns(databaseName, tableName);
    for (const indexColumnRow of indexColumnRows) {
      result.push({
        column_name: readString(indexColumnRow, "column_name") ?? "",
        key_name: readString(indexColumnRow, "name") ?? "",
        non_unique: !readBoolean(indexColumnRow, "unique"),
        primary: false,
        table_name: readString(indexColumnRow, "table_name") ?? "",
      });
    }

    return result;
  }

  protected override async fetchForeignKeyColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const columnsByTable = new Map<string, Record<string, unknown>[]>(); // sqlite foreign keys grouped per table

    for (const column of await super.fetchForeignKeyColumns(databaseName, tableName)) {
      const rowTableName = readString(column, "table_name") ?? "";
      const tableColumns = columnsByTable.get(rowTableName) ?? [];
      tableColumns.push(column);
      columnsByTable.set(rowTableName, tableColumns);
    }

    const columns: Record<string, unknown>[] = [];
    for (const [table, tableColumns] of columnsByTable.entries()) {
      const foreignKeyDetails = await this.getForeignKeyDetails(table);
      const foreignKeyCount = foreignKeyDetails.length;

      for (const column of tableColumns) {
        const rawId = readNumber(column, "id");
        if (rawId === null) {
          columns.push({ ...column });
          continue;
        }

        const detail = foreignKeyDetails[foreignKeyCount - rawId - 1];
        columns.push({
          ...column,
          ...(detail ?? {}),
        });
      }
    }

    return columns;
  }

  protected override async fetchTableOptionsByTable(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, Record<string, unknown>>> {
    const tables = tableName === null ? await this.listTableNames() : [tableName];
    const tableOptions: Record<string, Record<string, unknown>> = {};

    for (const table of tables) {
      const comment = this.parseTableCommentFromSQL(table, await this.getCreateTableSQL(table));
      if (comment === null) {
        continue;
      }

      tableOptions[table] = { comment };
    }

    return tableOptions;
  }

  private getWhereClause(tableName: string | null, params: unknown[]): string {
    const conditions = [
      "t.type = 'table'",
      "t.name NOT IN ('geometry_columns', 'spatial_ref_sys', 'sqlite_sequence')",
    ];

    if (tableName !== null) {
      conditions.push("t.name = ?");
      params.push(tableName);
    }

    return conditions.join(" AND ");
  }

  private async fetchPrimaryKeyColumns(
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];
    const sql = `SELECT t.name AS table_name,
       p.name
FROM sqlite_master t
JOIN pragma_table_info(t.name) p
WHERE ${this.getWhereClause(tableName, params)}
  AND p.pk > 0
ORDER BY t.name,
       p.pk`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  private async getCreateTableSQL(tableName: string): Promise<string> {
    const sql = await this.connection.fetchOne<unknown>(
      `SELECT sql
FROM (
  SELECT *
  FROM sqlite_master
  UNION ALL
  SELECT *
  FROM sqlite_temp_master
)
WHERE type = 'table'
  AND name = ?`,
      [tableName],
    );

    if (sql === false || sql === null) {
      return "";
    }

    return String(sql);
  }

  private async getForeignKeyDetails(tableName: string): Promise<SQLiteForeignKeyDetail[]> {
    const createSql = await this.getCreateTableSQL(tableName);
    const matcher =
      /(?:CONSTRAINT\s+(\S+)\s+)?(?:FOREIGN\s+KEY[^)]+\)\s*)?REFERENCES\s+\S+\s*(?:\([^)]+\))?(?:[^,]*?(NOT\s+DEFERRABLE|DEFERRABLE)(?:\s+INITIALLY\s+(DEFERRED|IMMEDIATE))?)?/gim;

    const details: SQLiteForeignKeyDetail[] = [];
    for (const match of createSql.matchAll(matcher)) {
      const constraintName = (match[1] ?? "").trim();
      const deferrability = (match[2] ?? "").trim().toLowerCase();
      const deferredMode = (match[3] ?? "").trim().toLowerCase();

      details.push({
        constraint_name: stripForeignKeyConstraintName(constraintName),
        deferrable: deferrability === "deferrable",
        deferred: deferredMode === "deferred",
      });
    }

    return details;
  }

  private parseColumnCollationFromSQL(column: string, sql: string): string | null {
    const pattern = new RegExp(
      `${this.buildIdentifierPattern(column)}[^,(]+(?:\\([^()]+\\)[^,]*)?(?:(?:DEFAULT|CHECK)\\s*(?:\\(.*?\\))?[^,]*)*COLLATE\\s+["']?([^\\s,"')]+)`,
      "is",
    );

    const match = pattern.exec(sql);
    if (match === null || match[1] === undefined) {
      return null;
    }

    return match[1];
  }

  private parseTableCommentFromSQL(table: string, sql: string): string | null {
    const pattern = new RegExp(
      `\\s*CREATE\\sTABLE${this.buildIdentifierPattern(table)}((?:\\s*--[^\\n]*\\n?)+)`,
      "im",
    );

    const match = pattern.exec(sql);
    if (match === null || match[1] === undefined) {
      return null;
    }

    const comment = match[1].replace(/^\s*--/gm, "").replace(/\n+$/g, "");
    return comment.length > 0 ? comment : null;
  }

  private parseColumnCommentFromSQL(column: string, sql: string): string {
    const pattern = new RegExp(
      `[\\s(,]${this.buildIdentifierPattern(column)}(?:\\([^)]*?\\)|[^,(])*?,?((?:(?!\\n))(?:\\s*--[^\\n]*\\n?)+)`,
      "i",
    );

    const match = pattern.exec(sql);
    if (match === null || match[1] === undefined) {
      return "";
    }

    return match[1].replace(/^\s*--/gm, "").replace(/\n+$/g, "");
  }

  private buildIdentifierPattern(identifier: string): string {
    const expressions = [identifier, this.platform.quoteSingleIdentifier(identifier)]
      .map((value) => `\\W${escapeRegExp(value)}\\W`)
      .join("|");

    return `(?:${expressions})`;
  }
}

function stripPossiblyQuotedSQLiteIdentifier(identifier: string): string {
  if (identifier.length <= 1) {
    return identifier;
  }

  const wrappers: Array<[string, string]> = [
    ['"', '"'],
    ["`", "`"],
    ["[", "]"],
  ];

  for (const [start, end] of wrappers) {
    if (
      identifier.startsWith(start) &&
      identifier.endsWith(end) &&
      isFullyWrappedIdentifier(identifier, start, end)
    ) {
      return unescapeWrappedSQLiteIdentifier(identifier.slice(1, -1), start, end);
    }
  }

  if (identifier.startsWith('"') || identifier.startsWith("`") || identifier.startsWith("[")) {
    return identifier.slice(1);
  }

  if (identifier.endsWith('"') || identifier.endsWith("`") || identifier.endsWith("]")) {
    return identifier.slice(0, -1);
  }

  return identifier;
}

function isFullyWrappedIdentifier(identifier: string, _start: string, end: string): boolean {
  for (let index = 1; index < identifier.length - 1; index += 1) {
    if (identifier[index] !== end) {
      continue;
    }

    const next = identifier[index + 1];
    if (next === end) {
      index += 1;
      continue;
    }

    return false;
  }

  return true;
}

function unescapeWrappedSQLiteIdentifier(identifier: string, start: string, end: string): string {
  if (start === '"' && end === '"') {
    return identifier.replaceAll('""', '"');
  }

  if (start === "`" && end === "`") {
    return identifier.replaceAll("``", "`");
  }

  if (start === "[" && end === "]") {
    return identifier.replaceAll("]]", "]");
  }

  return identifier;
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

function readNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readBoolean(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }

  return false;
}

function isPrimaryIntegerColumn(row: Record<string, unknown>): boolean {
  const pk = row.pk;
  const type = readString(row, "type");
  return pk !== 0 && pk !== "0" && typeof type === "string" && type.toUpperCase() === "INTEGER";
}

function hasSinglePrimaryIntegerColumn(columnNames: string[], columnName: string): boolean {
  return columnNames.length === 1 && columnNames[0] === columnName;
}

function normalizeReferentialAction(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.toUpperCase();
  return normalized === "RESTRICT" ? null : normalized;
}

function normalizeSQLiteDefaultValue(typeName: string, value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if ([Types.INTEGER, Types.SMALLINT, Types.BIGINT].includes(typeName) && /^-?\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (typeName === Types.BOOLEAN) {
    const normalized = value.trim().toLowerCase();
    if (["1", "true"].includes(normalized)) {
      return true;
    }

    if (["0", "false"].includes(normalized)) {
      return false;
    }
  }

  return value;
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripWrappingIdentifierQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('""', '"');
  }

  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1).replaceAll("``", "`");
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).replaceAll("]]", "]");
  }

  return trimmed;
}

function stripForeignKeyConstraintName(constraintName: string): string {
  const trimmed = constraintName.trim();
  if (trimmed.length === 0) {
    return "";
  }

  return stripWrappingIdentifierQuotes(trimmed);
}
