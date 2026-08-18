import type { Connection } from "../connection";
import { ColumnValuesRequired } from "../exception/invalid-column-type/column-values-required";
import { MySQLSchemaManager } from "../schema/mysql-schema-manager";
import type { TableDiff } from "../schema/table-diff";
import { DefaultSelectSQLBuilder } from "../sql/builder/default-select-sql-builder";
import { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import type { KeywordList } from "./keywords/keyword-list";
import { MySQLKeywords } from "./keywords/mysql-keywords";

export abstract class AbstractMySQLPlatform extends AbstractPlatform {
  public static readonly LENGTH_LIMIT_TINYTEXT = 255;
  public static readonly LENGTH_LIMIT_TEXT = 65535;
  public static readonly LENGTH_LIMIT_MEDIUMTEXT = 16777215;

  public static readonly LENGTH_LIMIT_TINYBLOB = 255;
  public static readonly LENGTH_LIMIT_BLOB = 65535;
  public static readonly LENGTH_LIMIT_MEDIUMBLOB = 16777215;

  public override getCreateTableSQL(table: {
    getColumns(): readonly unknown[];
    getName(): string;
  }): string[] {
    return this.appendMySQLTableOptions(super.getCreateTableSQL(table), table);
  }

  protected override getCreateTableWithoutForeignKeysSQL(table: unknown): string[] {
    return this.appendMySQLTableOptions(super.getCreateTableWithoutForeignKeysSQL(table), table);
  }

  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      bigint: Types.BIGINT,
      binary: Types.BINARY,
      blob: Types.BLOB,
      char: Types.STRING,
      date: Types.DATE_MUTABLE,
      datetime: Types.DATETIME_MUTABLE,
      decimal: Types.DECIMAL,
      double: Types.FLOAT,
      enum: Types.ENUM,
      float: Types.SMALLFLOAT,
      int: Types.INTEGER,
      integer: Types.INTEGER,
      json: Types.JSON,
      longblob: Types.BLOB,
      longtext: Types.TEXT,
      mediumblob: Types.BLOB,
      mediumint: Types.INTEGER,
      mediumtext: Types.TEXT,
      numeric: Types.DECIMAL,
      real: Types.FLOAT,
      set: Types.SIMPLE_ARRAY,
      smallint: Types.SMALLINT,
      string: Types.STRING,
      text: Types.TEXT,
      time: Types.TIME_MUTABLE,
      timestamp: Types.DATETIME_MUTABLE,
      tinyblob: Types.BLOB,
      tinyint: Types.BOOLEAN,
      tinytext: Types.TEXT,
      varbinary: Types.BINARY,
      varchar: Types.STRING,
      year: Types.DATE_MUTABLE,
    };
  }

  public override getBooleanTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TINYINT";
  }

  public override getIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `INT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getBigIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `BIGINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getEnumDeclarationSQL(column: Record<string, unknown>): string {
    const values = column.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw ColumnValuesRequired.new(this, "ENUM");
    }

    return `ENUM(${values.map((value) => this.quoteStringLiteral(String(value))).join(", ")})`;
  }

  public override getClobTypeDeclarationSQL(column: Record<string, unknown>): string {
    const length = this.readPositiveNumericColumnLength(column);
    if (length !== null) {
      if (length <= AbstractMySQLPlatform.LENGTH_LIMIT_TINYTEXT) {
        return "TINYTEXT";
      }

      if (length <= AbstractMySQLPlatform.LENGTH_LIMIT_TEXT) {
        return "TEXT";
      }

      if (length <= AbstractMySQLPlatform.LENGTH_LIMIT_MEDIUMTEXT) {
        return "MEDIUMTEXT";
      }
    }

    return "LONGTEXT";
  }

  public override getBlobTypeDeclarationSQL(column: Record<string, unknown>): string {
    const length = this.readPositiveNumericColumnLength(column);
    if (length !== null) {
      if (length <= AbstractMySQLPlatform.LENGTH_LIMIT_TINYBLOB) {
        return "TINYBLOB";
      }

      if (length <= AbstractMySQLPlatform.LENGTH_LIMIT_BLOB) {
        return "BLOB";
      }

      if (length <= AbstractMySQLPlatform.LENGTH_LIMIT_MEDIUMBLOB) {
        return "MEDIUMBLOB";
      }
    }

    return "LONGBLOB";
  }

  public override getSmallIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `SMALLINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  protected override _getCommonIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    let sql = "";

    if (column.unsigned === true) {
      sql += " UNSIGNED";
    }

    if (column.autoincrement === true) {
      sql += " AUTO_INCREMENT";
    }

    return sql;
  }

  protected doModifyLimitQuery(query: string, limit: number | null, offset: number): string {
    if (limit !== null) {
      query += ` LIMIT ${limit}`;

      if (offset > 0) {
        query += ` OFFSET ${offset}`;
      }
    } else if (offset > 0) {
      // 2^64-1 is the maximum of unsigned BIGINT, the biggest limit possible
      query += ` LIMIT 18446744073709551615 OFFSET ${offset}`;
    }

    return query;
  }

  public quoteSingleIdentifier(str: string): string {
    return `\`${str.replace(/`/g, "``")}\``;
  }

  public quoteStringLiteral(str: string): string {
    return super.quoteStringLiteral(str.replace(/\\/g, "\\\\"));
  }

  public getRegexpExpression(): string {
    return "RLIKE";
  }

  public getLocateExpression(
    string: string,
    substring: string,
    start: string | null = null,
  ): string {
    if (start === null) {
      return `LOCATE(${substring}, ${string})`;
    }

    return `LOCATE(${substring}, ${string}, ${start})`;
  }

  public getConcatExpression(...string: string[]): string {
    return `CONCAT(${string.join(", ")})`;
  }

  protected getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    const fn = operator === "+" ? "DATE_ADD" : "DATE_SUB";
    return `${fn}(${date}, INTERVAL ${interval} ${unit})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DATEDIFF(${date1}, ${date2})`;
  }

  public getCurrentDatabaseExpression(): string {
    return "DATABASE()";
  }

  public getLengthExpression(string: string): string {
    return `CHAR_LENGTH(${string})`;
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET SESSION TRANSACTION ISOLATION LEVEL ${this.getTransactionIsolationLevelSQL(level)}`;
  }

  public getDefaultTransactionIsolationLevel(): TransactionIsolationLevel {
    return TransactionIsolationLevel.REPEATABLE_READ;
  }

  public supportsIdentityColumns(): boolean {
    return true;
  }

  public supportsInlineColumnComments(): boolean {
    return true;
  }

  public supportsColumnCollation(): boolean {
    return true;
  }

  public override getColumnCharsetDeclarationSQL(charset: string): string {
    return `CHARACTER SET ${charset}`;
  }

  protected createReservedKeywordsList(): KeywordList {
    return new MySQLKeywords();
  }

  public createSchemaManager(connection: Connection): MySQLSchemaManager {
    return new MySQLSchemaManager(connection, this);
  }

  public createSelectSQLBuilder(): SelectSQLBuilder {
    return new DefaultSelectSQLBuilder(this, "FOR UPDATE", null);
  }

  public override getDropTemporaryTableSQL(table: string): string {
    return `DROP TEMPORARY TABLE ${table}`;
  }

  public override getDropForeignKeySQL(foreignKey: string, table: string): string {
    return `ALTER TABLE ${table} DROP FOREIGN KEY ${foreignKey}`;
  }

  public override getJsonTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "JSON";
  }

  public getColumnTypeSQLSnippet(tableAlias: string, _databaseName: string): string {
    return `${tableAlias}.DATA_TYPE`;
  }

  protected override getCreateIndexSQLFlags(index: unknown): string {
    if (hasIndexFlag(index, "fulltext")) {
      return "FULLTEXT ";
    }

    if (hasIndexFlag(index, "spatial")) {
      return "SPATIAL ";
    }

    return super.getCreateIndexSQLFlags(index);
  }

  public override getAlterTableSQL(diff: unknown): string[] {
    const tableDiff = diff as TableDiff;
    const oldTable = this.readTableDiffTable(tableDiff, "getOldTable");
    if (oldTable === null) {
      return super.getAlterTableSQL(diff);
    }

    const tableName = this.readTableQuotedName(oldTable);
    if (tableName === null) {
      return super.getAlterTableSQL(diff);
    }

    const addedColumns = this.readTableDiffColumns(tableDiff, "getAddedColumns");
    const droppedColumns = this.readTableDiffColumns(tableDiff, "getDroppedColumns");
    const changedColumns = this.readTableDiffColumnDiffs(tableDiff);
    const droppedForeignKeys = this.readTableDiffColumns(tableDiff, "getDroppedForeignKeys");
    const addedForeignKeys = this.readTableDiffColumns(tableDiff, "getAddedForeignKeys");
    const modifiedForeignKeys = this.readTableDiffColumns(tableDiff, "getModifiedForeignKeys");
    const droppedIndexes = [...this.readTableDiffColumns(tableDiff, "getDroppedIndexes")];
    const addedIndexes = [...this.readTableDiffColumns(tableDiff, "getAddedIndexes")];
    const modifiedIndexes = [...this.readTableDiffColumns(tableDiff, "getModifiedIndexes")];
    const renamedIndexes =
      this.readValue<Record<string, unknown>>(tableDiff, "getRenamedIndexes") ?? {};

    const queryParts: string[] = [];

    for (const column of addedColumns) {
      queryParts.push(`ADD ${this.getMySqlColumnDeclaration(column)}`);
    }

    for (const column of droppedColumns) {
      const quotedName = this.readQuotedName(column);
      if (quotedName !== null) {
        queryParts.push(`DROP ${quotedName}`);
      }
    }

    for (const columnDiff of changedColumns) {
      const oldColumn = this.readValue<unknown>(columnDiff, "getOldColumn");
      const newColumn = this.readValue<unknown>(columnDiff, "getNewColumn");
      if (oldColumn === undefined || newColumn === undefined) {
        continue;
      }

      const oldColumnName = this.readQuotedName(oldColumn);
      const newColumnDeclaration = this.getMySqlColumnDeclaration(newColumn);
      if (oldColumnName === null || newColumnDeclaration.length === 0) {
        continue;
      }

      queryParts.push(`CHANGE ${oldColumnName} ${newColumnDeclaration}`);
    }

    const droppedPrimaryIndex = takePrimaryIndex(droppedIndexes, this.isPrimaryIndex.bind(this));
    const addedPrimaryIndex = takePrimaryIndex(addedIndexes, this.isPrimaryIndex.bind(this));
    const modifiedPrimaryIndex = takePrimaryIndex(modifiedIndexes, this.isPrimaryIndex.bind(this));

    if (droppedPrimaryIndex !== null || modifiedPrimaryIndex !== null) {
      queryParts.push("DROP PRIMARY KEY");
    }

    const primaryIndexToAdd = addedPrimaryIndex ?? modifiedPrimaryIndex;
    if (primaryIndexToAdd !== null) {
      const primaryColumns = [...new Set(this.readIndexColumns(primaryIndexToAdd))];
      if (primaryColumns.length > 0) {
        queryParts.push(`ADD PRIMARY KEY (${primaryColumns.join(", ")})`);
      }
    }

    const sql = [...this.getPreAlterTableIndexForeignKeySQL(diff)];

    if (queryParts.length > 0) {
      sql.push(`ALTER TABLE ${tableName} ${queryParts.join(", ")}`);
    }

    const droppedForeignKeyNames = new Set<string>();
    for (const foreignKey of droppedForeignKeys) {
      const name =
        this.readValue<string>(foreignKey, "getQuotedName", this) ??
        this.readValue<string>(foreignKey, "getName");
      if (typeof name === "string" && name.length > 0) {
        sql.push(this.getDropForeignKeySQL(name, tableName));
        droppedForeignKeyNames.add(name.toLowerCase());
      }
    }

    for (const [oldName, renamedIndex] of Object.entries(renamedIndexes)) {
      if (oldName.toLowerCase() === "primary") {
        continue;
      }

      sql.push(this.getDropIndexSQL(oldName, tableName));
      sql.push(this.getCreateIndexSQL(renamedIndex, tableName));
    }

    for (const index of droppedIndexes) {
      const name = this.readIndexName(index);
      if (name === null || name.toLowerCase() === "primary") {
        continue;
      }

      sql.push(this.getDropIndexSQL(name, tableName));
    }

    for (const index of modifiedIndexes) {
      const name = this.readIndexName(index);
      if (name !== null && name.toLowerCase() !== "primary") {
        sql.push(this.getDropIndexSQL(name, tableName));
      }

      sql.push(this.getCreateIndexSQL(index, tableName));
    }

    for (const index of addedIndexes) {
      sql.push(this.getCreateIndexSQL(index, tableName));
    }

    for (const foreignKey of modifiedForeignKeys) {
      const name =
        this.readValue<string>(foreignKey, "getQuotedName", this) ??
        this.readValue<string>(foreignKey, "getName");
      const normalizedName = typeof name === "string" ? name.toLowerCase() : null;

      if (
        typeof name === "string" &&
        name.length > 0 &&
        !droppedForeignKeyNames.has(normalizedName ?? "")
      ) {
        sql.push(this.getDropForeignKeySQL(name, tableName));
        droppedForeignKeyNames.add(normalizedName ?? "");
      }

      sql.push(this.getCreateForeignKeySQL(foreignKey, tableName));
    }

    for (const foreignKey of addedForeignKeys) {
      sql.push(this.getCreateForeignKeySQL(foreignKey, tableName));
    }

    sql.push(...this.getPostAlterTableIndexForeignKeySQL(diff));
    return sql;
  }

  private appendMySQLTableOptions(sql: string[], table: unknown): string[] {
    if (sql.length === 0) {
      return sql;
    }

    const options = this.readTableOptions(table);
    const tableOptions = this.buildMySqlTableOptions(options);
    if (tableOptions.length > 0) {
      sql[0] = `${sql[0]} ${tableOptions.join(" ")}`;
    }

    return sql;
  }

  private buildMySqlTableOptions(options: Record<string, unknown>): string[] {
    if (typeof options.table_options === "string" && options.table_options.length > 0) {
      return [options.table_options];
    }

    const tableOptions: string[] = [];
    if (typeof options.charset === "string" && options.charset.length > 0) {
      tableOptions.push(`DEFAULT CHARACTER SET ${options.charset}`);
    }

    if (typeof options.collation === "string" && options.collation.length > 0) {
      tableOptions.push(this.getColumnCollationDeclarationSQL(options.collation));
    }

    if (typeof options.engine === "string" && options.engine.length > 0) {
      tableOptions.push(`ENGINE = ${options.engine}`);
    }

    const autoIncrement =
      typeof options.auto_increment === "number"
        ? options.auto_increment
        : typeof options.autoincrement === "number"
          ? options.autoincrement
          : null;
    if (autoIncrement !== null && Number.isFinite(autoIncrement)) {
      tableOptions.push(`AUTO_INCREMENT = ${String(autoIncrement)}`);
    }

    if (typeof options.comment === "string") {
      tableOptions.push(`COMMENT = ${this.quoteStringLiteral(options.comment)}`);
    }

    if (typeof options.row_format === "string" && options.row_format.length > 0) {
      tableOptions.push(`ROW_FORMAT = ${options.row_format}`);
    }

    return tableOptions;
  }

  private readTableOptions(table: unknown): Record<string, unknown> {
    if (table === null || typeof table !== "object") {
      return {};
    }

    const getOptions = (table as { getOptions?: () => unknown }).getOptions;
    if (typeof getOptions !== "function") {
      return {};
    }

    const options = getOptions.call(table);
    return options !== null && typeof options === "object"
      ? { ...(options as Record<string, unknown>) }
      : {};
  }

  private getMySqlColumnDeclaration(column: unknown): string {
    const definition = this.readValue<Record<string, unknown>>(column, "toArray") ?? {};
    const quotedName = this.readQuotedName(column);
    if (quotedName !== null) {
      definition.name = quotedName;
    }

    const comment = this.readValue<string>(column, "getComment");
    if (typeof comment === "string") {
      definition.comment = comment;
    }

    return this.getColumnDeclarationSQL(String(definition.name ?? ""), definition);
  }

  private readTableDiffColumns(diff: unknown, methodName: string): unknown[] {
    const value = this.readValue<unknown>(diff, methodName);
    return Array.isArray(value) ? value : [];
  }

  private readTableDiffColumnDiffs(diff: unknown): unknown[] {
    return this.readTableDiffColumns(diff, "getChangedColumns");
  }

  private readTableDiffTable(diff: unknown, methodName: string): unknown | null {
    const value = this.readValue<unknown>(diff, methodName);
    return value ?? null;
  }

  private readTableQuotedName(table: unknown): string | null {
    const quoted = this.readValue<string>(table, "getQuotedName", this);
    if (typeof quoted === "string" && quoted.length > 0) {
      return quoted;
    }

    const name = this.readValue<string>(table, "getName");
    return typeof name === "string" && name.length > 0 ? name : null;
  }

  private readQuotedName(column: unknown): string | null {
    const quoted = this.readValue<string>(column, "getQuotedName", this);
    if (typeof quoted === "string" && quoted.length > 0) {
      return quoted;
    }

    const name = this.readValue<string>(column, "getName");
    return typeof name === "string" && name.length > 0 ? this.quoteIdentifier(name) : null;
  }

  private readIndexName(index: unknown): string | null {
    const quoted = this.readValue<string>(index, "getQuotedName", this);
    if (typeof quoted === "string" && quoted.length > 0) {
      return quoted;
    }

    const name = this.readValue<string>(index, "getName");
    return typeof name === "string" && name.length > 0 ? name : null;
  }

  private readIndexColumns(index: unknown): string[] {
    const quotedColumns = this.readValue<string[]>(index, "getQuotedColumns", this);
    if (Array.isArray(quotedColumns) && quotedColumns.length > 0) {
      return quotedColumns;
    }

    const columns = this.readValue<string[]>(index, "getColumns");
    return Array.isArray(columns) ? columns : [];
  }

  private isPrimaryIndex(index: unknown): boolean {
    return this.readValue<boolean>(index, "isPrimary") === true;
  }

  private readValue<T>(target: unknown, methodName: string, ...args: unknown[]): T | undefined {
    if (target === null || target === undefined || typeof target !== "object") {
      return undefined;
    }

    const candidate = target as Record<string, unknown>;
    const fn = candidate[methodName];
    if (typeof fn === "function") {
      return (fn as (...callArgs: unknown[]) => T).apply(target, args);
    }

    return candidate[methodName] as T | undefined;
  }

  private readPositiveNumericColumnLength(column: Record<string, unknown>): number | null {
    const rawLength = column.length;
    if (typeof rawLength === "number" && Number.isFinite(rawLength) && rawLength > 0) {
      return rawLength;
    }

    if (typeof rawLength === "string" && rawLength.trim().length > 0) {
      const parsed = Number(rawLength);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return null;
  }
}

function hasIndexFlag(index: unknown, flag: string): boolean {
  if (index === null || typeof index !== "object") {
    return false;
  }

  const candidate = index as Record<string, unknown>;
  const hasFlag = candidate.hasFlag;
  if (typeof hasFlag !== "function") {
    return false;
  }

  return hasFlag.call(index, flag) === true;
}

function takePrimaryIndex(
  indexes: unknown[],
  isPrimary: (index: unknown) => boolean,
): unknown | null {
  const index = indexes.findIndex((candidate) => isPrimary(candidate));
  if (index === -1) {
    return null;
  }

  const [primaryIndex] = indexes.splice(index, 1);
  return primaryIndex ?? null;
}
