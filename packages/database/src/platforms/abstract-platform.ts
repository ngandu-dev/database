import type { Connection } from "../connection";
import { InvalidArgumentException } from "../exception/invalid-argument-exception";
import { ColumnValuesRequired } from "../exception/invalid-column-type/column-values-required";
import { LockMode } from "../lock-mode";
import type { AbstractSchemaManager } from "../schema/abstract-schema-manager";
import type { MetadataProvider } from "../schema/metadata/metadata-provider";
import { UnquotedIdentifierFolding } from "../schema/name/unquoted-identifier-folding";
import { DefaultSelectSQLBuilder } from "../sql/builder/default-select-sql-builder";
import { DefaultUnionSQLBuilder } from "../sql/builder/default-union-sql-builder";
import { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import { UnionSQLBuilder } from "../sql/builder/union-sql-builder";
import { WithSQLBuilder } from "../sql/builder/with-sql-builder";
import { Parser } from "../sql/parser";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { DateIntervalUnit } from "./date-interval-unit";
import { NoColumnsSpecifiedForTable } from "./exception/no-columns-specified-for-table";
import { NotSupported } from "./exception/not-supported";
import { EmptyKeywords } from "./keywords/empty-keywords";
import { KeywordList } from "./keywords/keyword-list";
import { TrimMode } from "./trim-mode";

export abstract class AbstractPlatform {
  private datazenTypeMapping: Record<string, string> | null = null;
  private reservedKeywords: KeywordList | null = null;

  /**
   * Quotes an identifier preserving dotted qualification.
   */
  public quoteIdentifier(identifier: string): string {
    return identifier
      .split(".")
      .map((part) => this.quoteSingleIdentifier(part))
      .join(".");
  }

  /**
   * Quotes a single identifier (no dot chain separation).
   */
  public quoteSingleIdentifier(str: string): string {
    return `"${str.replace(/"/g, `""`)}"`;
  }

  public getUnquotedIdentifierFolding(): UnquotedIdentifierFolding {
    return UnquotedIdentifierFolding.NONE;
  }

  /**
   * Adds a driver-specific LIMIT clause to the query.
   */
  public modifyLimitQuery(query: string, limit: number | null, offset: number = 0): string {
    if (offset < 0) {
      throw new Error(`Offset must be a positive integer or zero, ${offset} given.`);
    }

    return this.doModifyLimitQuery(query, limit, offset);
  }

  /**
   * Adds a platform-specific LIMIT clause to the query.
   */
  protected doModifyLimitQuery(query: string, limit: number | null, offset: number): string {
    if (limit !== null) {
      query += ` LIMIT ${limit}`;
    }

    if (offset > 0) {
      query += ` OFFSET ${offset}`;
    }

    return query;
  }

  /**
   * Quotes a literal string.
   * This method is NOT meant to fix SQL injections!
   * It is only meant to escape this platform's string literal
   * quote character inside the given literal string.
   */
  public quoteStringLiteral(str: string): string {
    return `'${str.replace(/'/g, `''`)}'`;
  }

  public getBooleanTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "BOOLEAN";
  }

  public getIntegerTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "INT";
  }

  protected _getCommonIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getIntegerTypeDeclarationSQL(column);
  }

  public getBigIntTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "BIGINT";
  }

  public getSmallIntTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "SMALLINT";
  }

  public getAsciiStringTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getStringTypeDeclarationSQL(column);
  }

  public getStringTypeDeclarationSQL(column: Record<string, unknown>): string {
    const length = this.readLength(column);
    if (this.readBoolean(column, "fixed")) {
      return this.getCharTypeDeclarationSQLSnippet(length);
    }

    return this.getVarcharTypeDeclarationSQLSnippet(length);
  }

  public getBinaryTypeDeclarationSQL(column: Record<string, unknown>): string {
    const fixed = this.readBoolean(column, "fixed");
    const length = this.readLength(column);

    if (fixed) {
      return this.getBinaryTypeDeclarationSQLSnippet(length);
    }

    return this.getVarbinaryTypeDeclarationSQLSnippet(length);
  }

  public getGuidTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getStringTypeDeclarationSQL({
      ...column,
      fixed: true,
      length: this.readLength(column) ?? 36,
    });
  }

  public getJsonTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getClobTypeDeclarationSQL(column);
  }

  public getJsonbTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getJsonTypeDeclarationSQL(column);
  }

  public getClobTypeDeclarationSQL(column: Record<string, unknown>): string {
    const length = this.readLength(column);
    if (length !== undefined && length <= 65535) {
      return `VARCHAR(${length})`;
    }

    return "TEXT";
  }

  public getBlobTypeDeclarationSQL(column: Record<string, unknown>): string {
    const length = this.readLength(column);
    if (length !== undefined && length <= 65535) {
      return `VARBINARY(${length})`;
    }

    return "BLOB";
  }

  public getDecimalTypeDeclarationSQL(column: Record<string, unknown>): string {
    const precision = this.readNumber(column, "precision") ?? 10;
    const scale = this.readNumber(column, "scale") ?? 0;

    return `NUMERIC(${precision}, ${scale})`;
  }

  public getFloatDeclarationSQL(_column: Record<string, unknown>): string {
    return "DOUBLE PRECISION";
  }

  public getSmallFloatDeclarationSQL(_column: Record<string, unknown>): string {
    return "REAL";
  }

  public getDateTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "DATETIME";
  }

  public getDateTimeTzTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getDateTimeTypeDeclarationSQL(column);
  }

  public getDateTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "DATE";
  }

  public getTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TIME";
  }

  public getEnumDeclarationSQL(column: Record<string, unknown>): string {
    const values = column.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw ColumnValuesRequired.new(this, "ENUM");
    }

    const maxValueLength = values.reduce((max, value) => Math.max(max, String(value).length), 0);
    let length = maxValueLength;

    if (typeof column.length === "number" && Number.isFinite(column.length)) {
      if (maxValueLength > column.length) {
        throw new InvalidArgumentException(
          `Specified column length (${column.length}) is less than the maximum length of provided values (${maxValueLength}).`,
        );
      }

      length = column.length;
    }

    return this.getStringTypeDeclarationSQL({ length });
  }

  protected getCharTypeDeclarationSQLSnippet(length: number | undefined): string {
    return `CHAR(${length ?? 1})`;
  }

  protected getVarcharTypeDeclarationSQLSnippet(length: number | undefined): string {
    return `VARCHAR(${length ?? 255})`;
  }

  protected getBinaryTypeDeclarationSQLSnippet(length: number | undefined): string {
    return length === undefined ? "BINARY" : `BINARY(${length})`;
  }

  protected getVarbinaryTypeDeclarationSQLSnippet(length: number | undefined): string {
    return `VARBINARY(${length ?? 255})`;
  }

  /**
   * Initializes platform-native DB type -> Datazen Type mapping.
   * Subclasses should override this to provide vendor-specific defaults.
   */
  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {};
  }

  public registerDatazenTypeMapping(dbType: string, datazenType: string): void {
    this.ensureDatazenTypeMappingsInitialized();
    this.datazenTypeMapping![dbType.toLowerCase()] = datazenType;
  }

  public registerDoctrineTypeMapping(dbType: string, datazenType: string): void {
    this.registerDatazenTypeMapping(dbType, datazenType);
  }

  public hasDatazenTypeMappingFor(dbType: string): boolean {
    this.ensureDatazenTypeMappingsInitialized();
    return Object.hasOwn(this.datazenTypeMapping!, dbType.toLowerCase());
  }

  public hasDoctrineTypeMappingFor(dbType: string): boolean {
    return this.hasDatazenTypeMappingFor(dbType);
  }

  public getDatazenTypeMapping(dbType: string): string {
    this.ensureDatazenTypeMappingsInitialized();
    const key = dbType.toLowerCase();
    const mapped = this.datazenTypeMapping![key];

    if (mapped === undefined) {
      throw new Error(
        `Unknown database type "${dbType}" requested, ${this.constructor.name} may not support it.`,
      );
    }

    return mapped;
  }

  public getDoctrineTypeMapping(dbType: string): string {
    return this.getDatazenTypeMapping(dbType);
  }

  public escapeStringForLike(inputString: string, escapeChar: string): string {
    const escapedEscape = escapeChar.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    const escapedLikeChars = `${this.getLikeWildcardCharacters()}${escapeChar}`.replace(
      /[\\^$.*+?()[\]{}|]/g,
      "\\$&",
    );
    const pattern = new RegExp(`([${escapedLikeChars}])`, "g");

    return inputString.replace(pattern, `${escapedEscape}$1`);
  }

  public getRegexpExpression(): string {
    throw NotSupported.new("regexp");
  }

  public getLengthExpression(string: string): string {
    return `LENGTH(${string})`;
  }

  public getModExpression(dividend: string, divisor: string): string {
    return `MOD(${dividend}, ${divisor})`;
  }

  public getTrimExpression(
    str: string,
    mode: TrimMode = TrimMode.UNSPECIFIED,
    char: string | null = null,
  ): string {
    const tokens: string[] = [];

    if (mode === TrimMode.LEADING) {
      tokens.push("LEADING");
    } else if (mode === TrimMode.TRAILING) {
      tokens.push("TRAILING");
    } else if (mode === TrimMode.BOTH) {
      tokens.push("BOTH");
    }

    if (char !== null) {
      tokens.push(char);
    }

    if (tokens.length > 0) {
      tokens.push("FROM");
    }

    tokens.push(str);

    return `TRIM(${tokens.join(" ")})`;
  }

  public abstract getLocateExpression(
    string: string,
    substring: string,
    start?: string | null,
  ): string;

  public getSubstringExpression(
    string: string,
    start: string,
    length: string | null = null,
  ): string {
    if (length === null) {
      return `SUBSTRING(${string} FROM ${start})`;
    }

    return `SUBSTRING(${string} FROM ${start} FOR ${length})`;
  }

  public getConcatExpression(...string: string[]): string {
    return string.join(" || ");
  }

  public abstract getDateDiffExpression(date1: string, date2: string): string;

  public getDateAddSecondsExpression(date: string, seconds: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", seconds, DateIntervalUnit.SECOND);
  }

  public getDateSubSecondsExpression(date: string, seconds: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", seconds, DateIntervalUnit.SECOND);
  }

  public getDateAddMinutesExpression(date: string, minutes: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", minutes, DateIntervalUnit.MINUTE);
  }

  public getDateSubMinutesExpression(date: string, minutes: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", minutes, DateIntervalUnit.MINUTE);
  }

  public getDateAddHourExpression(date: string, hours: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", hours, DateIntervalUnit.HOUR);
  }

  public getDateSubHourExpression(date: string, hours: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", hours, DateIntervalUnit.HOUR);
  }

  public getDateAddDaysExpression(date: string, days: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", days, DateIntervalUnit.DAY);
  }

  public getDateSubDaysExpression(date: string, days: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", days, DateIntervalUnit.DAY);
  }

  public getDateAddWeeksExpression(date: string, weeks: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", weeks, DateIntervalUnit.WEEK);
  }

  public getDateSubWeeksExpression(date: string, weeks: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", weeks, DateIntervalUnit.WEEK);
  }

  public getDateAddMonthExpression(date: string, months: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", months, DateIntervalUnit.MONTH);
  }

  public getDateSubMonthExpression(date: string, months: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", months, DateIntervalUnit.MONTH);
  }

  public getDateAddQuarterExpression(date: string, quarters: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", quarters, DateIntervalUnit.QUARTER);
  }

  public getDateAddQuartersExpression(date: string, quarters: string): string {
    return this.getDateAddQuarterExpression(date, quarters);
  }

  public getDateSubQuarterExpression(date: string, quarters: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", quarters, DateIntervalUnit.QUARTER);
  }

  public getDateSubQuartersExpression(date: string, quarters: string): string {
    return this.getDateSubQuarterExpression(date, quarters);
  }

  public getDateAddYearExpression(date: string, years: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", years, DateIntervalUnit.YEAR);
  }

  public getDateAddYearsExpression(date: string, years: string): string {
    return this.getDateAddYearExpression(date, years);
  }

  public getDateSubYearExpression(date: string, years: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", years, DateIntervalUnit.YEAR);
  }

  public getDateSubYearsExpression(date: string, years: string): string {
    return this.getDateSubYearExpression(date, years);
  }

  protected getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    return `${date} ${operator} INTERVAL '${interval}' ${unit}`;
  }

  public getCurrentDateSQL(): string {
    return "CURRENT_DATE";
  }

  public getCurrentTimeSQL(): string {
    return "CURRENT_TIME";
  }

  public getCurrentTimestampSQL(): string {
    return "CURRENT_TIMESTAMP";
  }

  public getCurrentDatabaseExpression(): string {
    throw NotSupported.new("currentDatabase");
  }

  public getBitAndComparisonExpression(value1: string, value2: string): string {
    return `(${value1} & ${value2})`;
  }

  public getBitOrComparisonExpression(value1: string, value2: string): string {
    return `(${value1} | ${value2})`;
  }

  protected getTransactionIsolationLevelSQL(level: TransactionIsolationLevel): string {
    switch (level) {
      case TransactionIsolationLevel.READ_UNCOMMITTED:
        return "READ UNCOMMITTED";
      case TransactionIsolationLevel.READ_COMMITTED:
        return "READ COMMITTED";
      case TransactionIsolationLevel.REPEATABLE_READ:
        return "REPEATABLE READ";
      case TransactionIsolationLevel.SERIALIZABLE:
        return "SERIALIZABLE";
    }
  }

  protected _getTransactionIsolationLevelSQL(level: TransactionIsolationLevel): string {
    return this.getTransactionIsolationLevelSQL(level);
  }

  public abstract getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string;

  public getDefaultTransactionIsolationLevel(): TransactionIsolationLevel {
    return TransactionIsolationLevel.READ_COMMITTED;
  }

  public supportsSequences(): boolean {
    return false;
  }

  public supportsIdentityColumns(): boolean {
    return false;
  }

  public supportsSavepoints(): boolean {
    return true;
  }

  public supportsReleaseSavepoints(): boolean {
    return this.supportsSavepoints();
  }

  public supportsSchemas(): boolean {
    return false;
  }

  public supportsInlineColumnComments(): boolean {
    return false;
  }

  public supportsCommentOnStatement(): boolean {
    return false;
  }

  public supportsColumnCollation(): boolean {
    return false;
  }

  public createSavePoint(savepoint: string): string {
    return `SAVEPOINT ${savepoint}`;
  }

  public releaseSavePoint(savepoint: string): string {
    return `RELEASE SAVEPOINT ${savepoint}`;
  }

  public rollbackSavePoint(savepoint: string): string {
    return `ROLLBACK TO SAVEPOINT ${savepoint}`;
  }

  public getReservedKeywordsList(): KeywordList {
    this.reservedKeywords ??= this.createReservedKeywordsList();
    return this.reservedKeywords;
  }

  protected createReservedKeywordsList(): KeywordList {
    return new EmptyKeywords();
  }

  public getDummySelectSQL(expression = "1"): string {
    return `SELECT ${expression}`;
  }

  public getTruncateTableSQL(tableName: string, _cascade = false): string {
    return `TRUNCATE TABLE ${tableName}`;
  }

  public getDropTableSQL(table: string): string {
    return `DROP TABLE ${table}`;
  }

  public getDropTemporaryTableSQL(table: string): string {
    return this.getDropTableSQL(table);
  }

  public getDropIndexSQL(name: string, _table: string): string {
    return `DROP INDEX ${name}`;
  }

  protected getDropConstraintSQL(name: string, table: string): string {
    return `ALTER TABLE ${table} DROP CONSTRAINT ${name}`;
  }

  public getDropForeignKeySQL(foreignKey: string, table: string): string {
    return this.getDropConstraintSQL(foreignKey, table);
  }

  public getDropUniqueConstraintSQL(name: string, tableName: string): string {
    return this.getDropConstraintSQL(name, tableName);
  }

  public getCreateTableSQL(table: {
    getColumns(): readonly unknown[];
    getName(): string;
  }): string[] {
    return this.buildCreateTableSQL(table, true);
  }

  protected getCreateTableWithoutForeignKeysSQL(table: unknown): string[] {
    return this.buildCreateTableSQL(table, false);
  }

  protected _getCreateTableSQL(
    name: string,
    columns: Array<Record<string, unknown>>,
    options: Record<string, unknown> = {},
  ): string[] {
    this.validateCreateTableOptions(options, "_getCreateTableSQL");

    let columnListSql = this.getColumnDeclarationListSQL(columns);

    const uniqueConstraints = Array.isArray(options.uniqueConstraints)
      ? (options.uniqueConstraints as unknown[])
      : [];
    for (const definition of uniqueConstraints) {
      columnListSql += `, ${this.getUniqueConstraintDeclarationSQL(definition)}`;
    }

    const primary = Array.isArray(options.primary) ? options.primary.map(String) : [];
    if (primary.length > 0) {
      columnListSql += `, PRIMARY KEY (${[...new Set(primary)].join(", ")})`;
    }

    const indexes = Array.isArray(options.indexes) ? (options.indexes as unknown[]) : [];
    for (const definition of indexes) {
      columnListSql += `, ${this.getIndexDeclarationSQL(definition)}`;
    }

    const check = this.getCheckDeclarationSQL(columns);
    let query = `CREATE TABLE ${name} (${columnListSql}`;
    if (check.length > 0) {
      query += `, ${check}`;
    }
    query += ")";

    const sql = [query];
    const foreignKeys = Array.isArray(options.foreignKeys)
      ? (options.foreignKeys as unknown[])
      : [];
    for (const definition of foreignKeys) {
      sql.push(this.getCreateForeignKeySQL(definition, name));
    }

    return sql;
  }

  public getCreateTablesSQL(tables: Iterable<unknown>): string[] {
    const materializedTables = [...tables];
    const sql: string[] = [];

    for (const table of materializedTables) {
      sql.push(...this.buildCreateTableSQL(table, false));
    }

    for (const table of materializedTables) {
      const tableName = this.getDynamicTableSQLName(table);
      const foreignKeys = this.invokeMethod<unknown[]>(table, "getForeignKeys") ?? [];

      for (const foreignKey of foreignKeys) {
        sql.push(this.getCreateForeignKeySQL(foreignKey, tableName));
      }
    }

    return sql;
  }

  public getDropTablesSQL(tables: Iterable<unknown>): string[] {
    const materializedTables = [...tables];
    const sql: string[] = [];

    for (const table of materializedTables) {
      const tableName = this.getDynamicTableSQLName(table);
      const foreignKeys = this.invokeMethod<unknown[]>(table, "getForeignKeys") ?? [];

      for (const foreignKey of foreignKeys) {
        const foreignKeyName =
          this.invokeMethod<string>(foreignKey, "getQuotedName", this) ??
          this.invokeMethod<string>(foreignKey, "getName") ??
          String(foreignKey);
        sql.push(this.getDropForeignKeySQL(foreignKeyName, tableName));
      }
    }

    for (const table of materializedTables) {
      sql.push(this.getDropTableSQL(this.getDynamicTableSQLName(table)));
    }

    return sql;
  }

  public getCommentOnColumnSQL(tableName: string, columnName: string, comment: string): string {
    return `COMMENT ON COLUMN ${tableName}.${columnName} IS ${this.quoteStringLiteral(comment)}`;
  }

  protected getCommentOnTableSQL(tableName: string, comment: string): string {
    return `COMMENT ON TABLE ${this.quoteIdentifier(tableName)} IS ${this.quoteStringLiteral(comment)}`;
  }

  public getInlineColumnCommentSQL(comment: string): string {
    if (!this.supportsInlineColumnComments()) {
      throw NotSupported.new("getInlineColumnCommentSQL");
    }

    return `COMMENT ${this.quoteStringLiteral(comment)}`;
  }

  public getCreateTemporaryTableSnippetSQL(): string {
    return "CREATE TEMPORARY TABLE";
  }

  public getAlterSchemaSQL(_diff: unknown): string[] {
    throw NotSupported.new("getAlterSchemaSQL");
  }

  public getCreateSequenceSQL(_sequence: unknown): string {
    throw NotSupported.new("getCreateSequenceSQL");
  }

  public getAlterSequenceSQL(_sequence: unknown): string {
    throw NotSupported.new("getAlterSequenceSQL");
  }

  public getDropSequenceSQL(name: string): string {
    if (!this.supportsSequences()) {
      throw NotSupported.new("getDropSequenceSQL");
    }

    return `DROP SEQUENCE ${name}`;
  }

  public getCreateIndexSQL(index: unknown, table: string): string {
    if (this.invokeMethod<boolean>(index, "isPrimary") === true) {
      return this.getCreatePrimaryKeySQL(index, table);
    }

    const quotedColumns = this.getQuotedColumns(index);
    if (quotedColumns.length === 0) {
      throw new Error(`Incomplete or invalid index definition on table ${table}`);
    }

    const indexName =
      this.invokeMethod<string>(index, "getQuotedName", this) ??
      this.invokeMethod<string>(index, "getName") ??
      "index";

    const flags = this.getCreateIndexSQLFlags(index);
    return `CREATE ${flags}INDEX ${indexName} ON ${table} (${quotedColumns.join(", ")})${this.getPartialIndexSQL(index)}`;
  }

  public getCreatePrimaryKeySQL(index: unknown, table: string): string {
    const quotedColumns = this.getQuotedColumns(index);
    return `ALTER TABLE ${table} ADD PRIMARY KEY (${quotedColumns.join(", ")})`;
  }

  public getCreateSchemaSQL(schemaName: string): string {
    if (!this.supportsSchemas()) {
      throw NotSupported.new("getCreateSchemaSQL");
    }

    return `CREATE SCHEMA ${schemaName}`;
  }

  public getCreateUniqueConstraintSQL(constraint: unknown, tableName: string): string {
    return `ALTER TABLE ${tableName} ADD ${this.getUniqueConstraintDeclarationSQL(constraint)}`;
  }

  public getDropSchemaSQL(schemaName: string): string {
    if (!this.supportsSchemas()) {
      throw NotSupported.new("getDropSchemaSQL");
    }

    return `DROP SCHEMA ${schemaName}`;
  }

  public getCreateForeignKeySQL(foreignKey: unknown, table: string): string {
    return `ALTER TABLE ${table} ADD ${this.getForeignKeyDeclarationSQL(foreignKey)}`;
  }

  public getAlterTableSQL(diff: unknown): string[] {
    const oldTable =
      this.invokeMethod<unknown>(diff, "getOldTable") ?? (diff as { oldTable?: unknown })?.oldTable;
    const newTable =
      this.invokeMethod<unknown>(diff, "getNewTable") ?? (diff as { newTable?: unknown })?.newTable;

    if (oldTable === undefined || newTable === undefined) {
      throw NotSupported.new("getAlterTableSQL");
    }

    const addedColumns = this.invokeMethod<unknown[]>(diff, "getAddedColumns") ?? [];
    const changedColumns = this.invokeMethod<unknown[]>(diff, "getChangedColumns") ?? [];
    const droppedColumns = this.invokeMethod<unknown[]>(diff, "getDroppedColumns") ?? [];

    // Column alter SQL differs substantially per platform; keep the implementation
    //explicit until platform-specific column alteration support is ported.
    if (changedColumns.length > 0 || droppedColumns.length > 0) {
      throw NotSupported.new("getAlterTableSQL");
    }

    const tableName = this.getDynamicTableSQLName(newTable);
    const sql = [...this.getPreAlterTableIndexForeignKeySQL(diff)];

    for (const column of addedColumns) {
      sql.push(`ALTER TABLE ${tableName} ADD ${this.getDynamicColumnDeclarationSQL(column)}`);
    }

    const droppedForeignKeys = this.invokeMethod<unknown[]>(diff, "getDroppedForeignKeys") ?? [];
    for (const foreignKey of droppedForeignKeys) {
      const name =
        this.invokeMethod<string>(foreignKey, "getQuotedName", this) ??
        this.invokeMethod<string>(foreignKey, "getName");

      if (typeof name === "string" && name.length > 0) {
        sql.push(this.getDropForeignKeySQL(name, tableName));
      }
    }

    const renamedIndexes =
      this.invokeMethod<Record<string, unknown>>(diff, "getRenamedIndexes") ?? {};
    for (const [oldName, renamedIndex] of Object.entries(renamedIndexes)) {
      sql.push(this.getDropIndexSQL(oldName, tableName));
      sql.push(this.getCreateIndexSQL(renamedIndex, tableName));
    }

    const droppedIndexes = this.invokeMethod<unknown[]>(diff, "getDroppedIndexes") ?? [];
    for (const index of droppedIndexes) {
      const name =
        this.invokeMethod<string>(index, "getQuotedName", this) ??
        this.invokeMethod<string>(index, "getName");

      if (typeof name === "string" && name.length > 0) {
        sql.push(this.getDropIndexSQL(name, tableName));
      }
    }

    const modifiedIndexes = this.invokeMethod<unknown[]>(diff, "getModifiedIndexes") ?? [];
    for (const index of modifiedIndexes) {
      const name =
        this.invokeMethod<string>(index, "getQuotedName", this) ??
        this.invokeMethod<string>(index, "getName");

      if (typeof name === "string" && name.length > 0) {
        sql.push(this.getDropIndexSQL(name, tableName));
      }

      sql.push(this.getCreateIndexSQL(index, tableName));
    }

    const addedIndexes = this.invokeMethod<unknown[]>(diff, "getAddedIndexes") ?? [];
    for (const index of addedIndexes) {
      sql.push(this.getCreateIndexSQL(index, tableName));
    }

    const modifiedForeignKeys = this.invokeMethod<unknown[]>(diff, "getModifiedForeignKeys") ?? [];
    for (const foreignKey of modifiedForeignKeys) {
      const name =
        this.invokeMethod<string>(foreignKey, "getQuotedName", this) ??
        this.invokeMethod<string>(foreignKey, "getName");

      if (typeof name === "string" && name.length > 0) {
        sql.push(this.getDropForeignKeySQL(name, tableName));
      }

      sql.push(this.getCreateForeignKeySQL(foreignKey, tableName));
    }

    const addedForeignKeys = this.invokeMethod<unknown[]>(diff, "getAddedForeignKeys") ?? [];
    for (const foreignKey of addedForeignKeys) {
      sql.push(this.getCreateForeignKeySQL(foreignKey, tableName));
    }

    sql.push(...this.getPostAlterTableIndexForeignKeySQL(diff));

    return sql;
  }

  protected getPreAlterTableIndexForeignKeySQL(_diff: unknown): string[] {
    return [];
  }

  protected getPostAlterTableIndexForeignKeySQL(_diff: unknown): string[] {
    return [];
  }

  public getRenameTableSQL(oldName: string, newName: string): string {
    return `ALTER TABLE ${oldName} RENAME TO ${newName}`;
  }

  public getColumnDeclarationListSQL(columns: Array<Record<string, unknown>>): string {
    return columns
      .map((column) => this.getColumnDeclarationSQL(String(column.name ?? ""), column))
      .join(", ");
  }

  public getColumnDeclarationSQL(name: string, column: Record<string, unknown>): string {
    if (typeof column.columnDefinition === "string") {
      return `${name} ${column.columnDefinition}`;
    }

    const declarationParts: string[] = [];
    const typeDeclaration = this.resolveColumnTypeDeclaration(column);
    declarationParts.push(typeDeclaration);

    if (typeof column.charset === "string" && column.charset.length > 0) {
      const charset = this.getColumnCharsetDeclarationSQL(column.charset);
      if (charset.length > 0) {
        declarationParts.push(charset);
      }
    }

    const defaultSql = this.getDefaultValueDeclarationSQL(column);
    if (defaultSql.length > 0) {
      declarationParts.push(defaultSql.trim());
    }

    if (column.notnull === true) {
      declarationParts.push("NOT NULL");
    }

    if (typeof column.collation === "string" && column.collation.length > 0) {
      const collation = this.getColumnCollationDeclarationSQL(column.collation);
      if (collation.length > 0) {
        declarationParts.push(collation);
      }
    }

    if (
      this.supportsInlineColumnComments() &&
      typeof column.comment === "string" &&
      column.comment.length > 0
    ) {
      declarationParts.push(this.getInlineColumnCommentSQL(column.comment));
    }

    return `${name} ${declarationParts.join(" ")}`;
  }

  public getDefaultValueDeclarationSQL(column: Record<string, unknown>): string {
    const defaultValue = column.default;
    if (defaultValue === undefined || defaultValue === null) {
      return column.notnull === true ? "" : " DEFAULT NULL";
    }

    if (
      typeof defaultValue === "object" &&
      defaultValue !== null &&
      "toSQL" in defaultValue &&
      typeof defaultValue.toSQL === "function"
    ) {
      return ` DEFAULT ${defaultValue.toSQL(this)}`;
    }

    if (column.type === undefined) {
      return ` DEFAULT ${this.quoteStringLiteral(String(defaultValue))}`;
    }

    const typeName = getColumnTypeName(column.type);

    if (isIntegerMappingTypeName(typeName)) {
      return ` DEFAULT ${String(defaultValue)}`;
    }

    if (isDateTimeMappingTypeName(typeName) && defaultValue === this.getCurrentTimestampSQL()) {
      return ` DEFAULT ${this.getCurrentTimestampSQL()}`;
    }

    if (isTimeMappingTypeName(typeName) && defaultValue === this.getCurrentTimeSQL()) {
      return ` DEFAULT ${this.getCurrentTimeSQL()}`;
    }

    if (isDateMappingTypeName(typeName) && defaultValue === this.getCurrentDateSQL()) {
      return ` DEFAULT ${this.getCurrentDateSQL()}`;
    }

    if (isBooleanTypeName(typeName)) {
      return ` DEFAULT ${String(this.convertBooleans(defaultValue))}`;
    }

    if (typeof defaultValue === "number" || typeof defaultValue === "bigint") {
      return ` DEFAULT ${String(defaultValue)}`;
    }

    return ` DEFAULT ${this.quoteStringLiteral(String(defaultValue))}`;
  }

  public getCheckDeclarationSQL(definition: Array<string | Record<string, unknown>>): string {
    const constraints: string[] = [];

    for (const item of definition) {
      if (typeof item === "string") {
        constraints.push(`CHECK (${item})`);
        continue;
      }

      const name = String(item.name ?? "");
      if (item.min !== undefined) {
        constraints.push(`CHECK (${name} >= ${String(item.min)})`);
      }
      if (item.max !== undefined) {
        constraints.push(`CHECK (${name} <= ${String(item.max)})`);
      }
    }

    return constraints.join(", ");
  }

  public getUniqueConstraintDeclarationSQL(constraint: unknown): string {
    const quotedColumns = this.getQuotedColumns(constraint);
    if (quotedColumns.length === 0) {
      throw new Error('Incomplete definition. "columns" required.');
    }

    const chunks: string[] = [];
    const name = this.invokeMethod<string>(constraint, "getName") ?? "";
    if (name !== "") {
      chunks.push("CONSTRAINT");
      chunks.push(
        this.invokeMethod<string>(constraint, "getQuotedName", this) ?? this.quoteIdentifier(name),
      );
    }

    chunks.push("UNIQUE");
    if (this.invokeMethod<boolean>(constraint, "hasFlag", "clustered") === true) {
      chunks.push("CLUSTERED");
    }
    chunks.push(`(${quotedColumns.join(", ")})`);

    return chunks.join(" ");
  }

  public getIndexDeclarationSQL(index: unknown): string {
    const quotedColumns = this.getQuotedColumns(index);
    if (quotedColumns.length === 0) {
      throw new Error('Incomplete definition. "columns" required.');
    }

    const indexName =
      this.invokeMethod<string>(index, "getQuotedName", this) ??
      this.invokeMethod<string>(index, "getName") ??
      "index";

    return `${this.getCreateIndexSQLFlags(index)}INDEX ${indexName} (${quotedColumns.join(", ")})${this.getPartialIndexSQL(index)}`;
  }

  public getTemporaryTableName(tableName: string): string {
    return tableName;
  }

  public getForeignKeyDeclarationSQL(foreignKey: unknown): string {
    return `${this.getForeignKeyBaseDeclarationSQL(foreignKey)}${this.getAdvancedForeignKeyOptionsSQL(foreignKey)}`;
  }

  public getAdvancedForeignKeyOptionsSQL(foreignKey: unknown): string {
    let sql = "";
    if (this.constraintHasOption(foreignKey, "onUpdate")) {
      sql += ` ON UPDATE ${this.getForeignKeyReferentialActionSQL(String(this.getConstraintOption(foreignKey, "onUpdate")))}`;
    }
    if (this.constraintHasOption(foreignKey, "onDelete")) {
      sql += ` ON DELETE ${this.getForeignKeyReferentialActionSQL(String(this.getConstraintOption(foreignKey, "onDelete")))}`;
    }

    const deferrabilitySQL = this.getConstraintDeferrabilitySQL(foreignKey);
    if (deferrabilitySQL.length > 0) {
      sql += deferrabilitySQL;
    }

    return sql;
  }

  public getForeignKeyReferentialActionSQL(action: string): string {
    const upper = action.toUpperCase();
    switch (upper) {
      case "CASCADE":
      case "SET NULL":
      case "NO ACTION":
      case "RESTRICT":
      case "SET DEFAULT":
        return upper;
      default:
        throw new Error(`Invalid foreign key action "${upper}".`);
    }
  }

  protected getConstraintDeferrabilitySQL(foreignKey: unknown): string {
    let sql = "";

    if (this.constraintHasOption(foreignKey, "deferrable")) {
      sql +=
        this.getConstraintOption(foreignKey, "deferrable") !== false
          ? " DEFERRABLE"
          : " NOT DEFERRABLE";
    }

    if (this.constraintHasOption(foreignKey, "deferred")) {
      sql +=
        this.getConstraintOption(foreignKey, "deferred") !== false
          ? " INITIALLY DEFERRED"
          : " INITIALLY IMMEDIATE";
    }

    return sql;
  }

  public getForeignKeyBaseDeclarationSQL(foreignKey: unknown): string {
    const localColumns = this.getQuotedLocalColumns(foreignKey);
    const foreignColumns = this.getQuotedForeignColumns(foreignKey);
    const foreignTableName =
      this.invokeMethod<string>(foreignKey, "getQuotedForeignTableName", this) ??
      this.invokeMethod<string>(foreignKey, "getForeignTableName") ??
      "";

    if (localColumns.length === 0) {
      throw new Error('Incomplete definition. "local" required.');
    }
    if (foreignColumns.length === 0) {
      throw new Error('Incomplete definition. "foreign" required.');
    }
    if (foreignTableName.length === 0) {
      throw new Error('Incomplete definition. "foreignTable" required.');
    }

    let sql = "";
    const name = this.invokeMethod<string>(foreignKey, "getName") ?? "";
    if (name !== "") {
      sql += `CONSTRAINT ${this.invokeMethod<string>(foreignKey, "getQuotedName", this) ?? this.quoteIdentifier(name)} `;
    }

    return `${sql}FOREIGN KEY (${localColumns.join(", ")}) REFERENCES ${foreignTableName} (${foreignColumns.join(", ")})`;
  }

  public getColumnCharsetDeclarationSQL(_charset: string): string {
    return "";
  }

  public getColumnCollationDeclarationSQL(collation: string): string {
    return this.supportsColumnCollation() ? `COLLATE ${this.quoteSingleIdentifier(collation)}` : "";
  }

  public getListDatabasesSQL(): string {
    throw NotSupported.new("getListDatabasesSQL");
  }

  public getListSequencesSQL(_database: string): string {
    throw NotSupported.new("getListSequencesSQL");
  }

  public getListViewsSQL(_database: string): string {
    throw NotSupported.new("getListViewsSQL");
  }

  public getCreateViewSQL(name: string, sql: string): string {
    return `CREATE VIEW ${name} AS ${sql}`;
  }

  public getDropViewSQL(name: string): string {
    return `DROP VIEW ${name}`;
  }

  public getSequenceNextValSQL(_sequence: string): string {
    throw NotSupported.new("getSequenceNextValSQL");
  }

  public getCreateDatabaseSQL(name: string): string {
    return `CREATE DATABASE ${name}`;
  }

  public getDropDatabaseSQL(name: string): string {
    return `DROP DATABASE ${name}`;
  }

  public supportsPartialIndexes(): boolean {
    return false;
  }

  public supportsColumnLengthIndexes(): boolean {
    return false;
  }

  public createSQLParser(): Parser {
    return new Parser(false);
  }

  public columnsEqual(column1: unknown, column2: unknown): boolean {
    const left = this.normalizeColumnForComparison(column1);
    const right = this.normalizeColumnForComparison(column2);
    const placeholderColumnName = "datazen_compare_column";

    try {
      if (
        this.getColumnDeclarationSQL(placeholderColumnName, {
          ...left,
          name: placeholderColumnName,
        }) !==
        this.getColumnDeclarationSQL(placeholderColumnName, {
          ...right,
          name: placeholderColumnName,
        })
      ) {
        return false;
      }
    } catch {
      return JSON.stringify(left) === JSON.stringify(right);
    }

    if (this.supportsInlineColumnComments()) {
      return true;
    }

    return (left.comment ?? null) === (right.comment ?? null);
  }

  public createMetadataProvider(_connection: Connection): MetadataProvider {
    throw NotSupported.new("createMetadataProvider");
  }

  public getDateTimeFormatString(): string {
    return "Y-m-d H:i:s";
  }

  public getDateTimeTzFormatString(): string {
    return "Y-m-d H:i:s";
  }

  public getDateFormatString(): string {
    return "Y-m-d";
  }

  public getTimeFormatString(): string {
    return "H:i:s";
  }

  public getMaxIdentifierLength(): number {
    return 63;
  }

  public getEmptyIdentityInsertSQL(
    quotedTableName: string,
    quotedIdentifierColumnName: string,
  ): string {
    return `INSERT INTO ${quotedTableName} (${quotedIdentifierColumnName}) VALUES (null)`;
  }

  public convertBooleans(item: unknown): unknown {
    if (Array.isArray(item)) {
      return item.map((value) => (typeof value === "boolean" ? Number(value) : value));
    }

    if (typeof item === "boolean") {
      return Number(item);
    }

    return item;
  }

  public convertFromBoolean(item: unknown): boolean | null {
    if (item === null) {
      return null;
    }

    return Boolean(item);
  }

  public convertBooleansToDatabaseValue(item: unknown): unknown {
    return this.convertBooleans(item);
  }

  public appendLockHint(fromClause: string, _lockMode: LockMode): string {
    return fromClause;
  }

  protected multiplyInterval(interval: string, factor: number): string {
    return `(${interval} * ${factor})`;
  }

  protected getLikeWildcardCharacters(): string {
    return "%_";
  }

  public getUnionSelectPartSQL(subQuery: string): string {
    return `(${subQuery})`;
  }

  /**
   * Returns the `UNION ALL` keyword.
   */
  public getUnionAllSQL(): string {
    return "UNION ALL";
  }

  /**
   * Returns the compatible `UNION DISTINCT` keyword.
   */
  public getUnionDistinctSQL(): string {
    return "UNION";
  }

  public createSelectSQLBuilder(): SelectSQLBuilder {
    return new DefaultSelectSQLBuilder(this, "FOR UPDATE", "SKIP LOCKED");
  }

  public createUnionSQLBuilder(): UnionSQLBuilder {
    return new DefaultUnionSQLBuilder(this);
  }

  public createWithSQLBuilder(): WithSQLBuilder {
    return new WithSQLBuilder();
  }

  public createSchemaManager(_connection: Connection): AbstractSchemaManager {
    throw NotSupported.new("createSchemaManager");
  }

  /**
   * Doctrine parity helper used by create-table SQL generation paths.
   * Throws when a table-like object has no columns configured.
   */
  protected assertCreateTableHasColumns(table: {
    getColumns(): readonly unknown[];
    getName(): string;
  }): void {
    if (table.getColumns().length === 0) {
      throw NoColumnsSpecifiedForTable.new(table.getName());
    }
  }

  protected getPartialIndexSQL(index: unknown): string {
    if (this.supportsPartialIndexes() && this.constraintHasOption(index, "where")) {
      return ` WHERE ${String(this.getConstraintOption(index, "where"))}`;
    }

    return "";
  }

  protected getCreateIndexSQLFlags(index: unknown): string {
    return this.invokeMethod<boolean>(index, "isUnique") === true ? "UNIQUE " : "";
  }

  protected getRenameIndexSQL(
    _oldIndexName: string,
    _index: unknown,
    _tableName: string,
  ): string[] {
    throw NotSupported.new("getRenameIndexSQL");
  }

  protected getRenameColumnSQL(
    tableName: string,
    oldColumnName: string,
    newColumnName: string,
  ): string[] {
    return [`ALTER TABLE ${tableName} RENAME COLUMN ${oldColumnName} TO ${newColumnName}`];
  }

  private readLength(column: Record<string, unknown>): number | undefined {
    return this.readNumber(column, "length");
  }

  private buildCreateTableSQL(
    table: { getColumns(): readonly unknown[]; getName(): string } | unknown,
    createForeignKeys: boolean,
  ): string[] {
    const createTableLike = this.asCreateTableLike(table);
    this.assertCreateTableHasColumns(createTableLike);

    const tableName = this.getDynamicTableSQLName(table);
    const columns = createTableLike
      .getColumns()
      .map((column) => this.columnToCreateTableArray(column));

    const indexes = this.invokeMethod<unknown[]>(table, "getIndexes") ?? [];
    const indexDefinitions: unknown[] = [];
    let primaryIndex: unknown | null = null;
    let primaryColumns: string[] = [];
    for (const index of indexes) {
      if (this.invokeMethod<boolean>(index, "isPrimary") === true) {
        primaryIndex = index;
        primaryColumns = this.getQuotedColumns(index);
        continue;
      }
      indexDefinitions.push(index);
    }

    const options = this.readCreateTableOptions(table);
    if (indexDefinitions.length > 0) {
      options.indexes = indexDefinitions;
    }

    if (primaryColumns.length > 0) {
      options.primary = [...new Set(primaryColumns)];
      if (primaryIndex !== null) {
        options.primary_index = primaryIndex;
      }
    }

    if (createForeignKeys) {
      const foreignKeys = this.invokeMethod<unknown[]>(table, "getForeignKeys") ?? [];
      if (foreignKeys.length > 0) {
        options.foreignKeys = foreignKeys;
      }
    }

    const sql = this._getCreateTableSQL(tableName, columns, options);

    if (this.supportsCommentOnStatement()) {
      const tableHasComment = this.invokeMethod<boolean>(table, "hasOption", "comment") === true;
      if (tableHasComment) {
        const tableComment = this.invokeMethod<unknown>(table, "getOption", "comment");
        if (typeof tableComment === "string") {
          sql.push(this.getCommentOnTableSQL(tableName, tableComment));
        }
      }

      for (const column of createTableLike.getColumns()) {
        const comment = this.invokeMethod<unknown>(column, "getComment");
        if (typeof comment !== "string" || comment.length === 0) {
          continue;
        }

        const quotedColumnName = this.invokeMethod<string>(column, "getQuotedName", this);
        if (typeof quotedColumnName !== "string" || quotedColumnName.length === 0) {
          continue;
        }

        sql.push(this.getCommentOnColumnSQL(tableName, quotedColumnName, comment));
      }
    }

    return sql;
  }

  private asCreateTableLike(table: unknown): {
    getColumns(): readonly unknown[];
    getName(): string;
  } {
    const columns = this.invokeMethod<unknown[]>(table, "getColumns");
    const name = this.invokeMethod<string>(table, "getName");
    if (columns === undefined || name === undefined) {
      throw NotSupported.new("getCreateTableSQL");
    }

    return {
      getColumns: () => columns,
      getName: () => name,
    };
  }

  private columnToCreateTableArray(column: unknown): Record<string, unknown> {
    const definition =
      this.invokeMethod<Record<string, unknown>>(column, "toArray") ??
      (column !== null && typeof column === "object"
        ? { ...(column as Record<string, unknown>) }
        : {});

    const quotedName = this.invokeMethod<string>(column, "getQuotedName", this);
    if (quotedName !== undefined) {
      definition.name = quotedName;
    } else if (definition.name !== undefined) {
      definition.name = String(definition.name);
    }

    const comment = this.invokeMethod<string>(column, "getComment");
    if (comment !== undefined) {
      definition.comment = comment;
    }

    return definition;
  }

  private readCreateTableOptions(table: unknown): Record<string, unknown> {
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

  private getDynamicTableSQLName(table: unknown): string {
    return (
      this.invokeMethod<string>(table, "getQuotedName", this) ??
      this.invokeMethod<string>(table, "getName") ??
      String(table)
    );
  }

  private invokeMethod<T>(target: unknown, methodName: string, ...args: unknown[]): T | undefined {
    if (target === null || typeof target !== "object") {
      return undefined;
    }

    const fn = (target as Record<string, unknown>)[methodName];
    if (typeof fn !== "function") {
      return undefined;
    }

    return (fn as (...methodArgs: unknown[]) => T).apply(target, args);
  }

  private constraintHasOption(target: unknown, name: string): boolean {
    return this.invokeMethod<boolean>(target, "hasOption", name) === true;
  }

  private getConstraintOption(target: unknown, name: string): unknown {
    return this.invokeMethod<unknown>(target, "getOption", name);
  }

  private getQuotedColumns(target: unknown): string[] {
    const quoted = this.invokeMethod<string[]>(target, "getQuotedColumns", this);
    if (Array.isArray(quoted)) {
      return quoted;
    }

    const columns = this.invokeMethod<string[]>(target, "getColumns");
    return Array.isArray(columns) ? columns.map((column) => String(column)) : [];
  }

  private getQuotedLocalColumns(target: unknown): string[] {
    const quoted = this.invokeMethod<string[]>(target, "getQuotedLocalColumns", this);
    if (Array.isArray(quoted)) {
      return quoted;
    }

    const columns = this.invokeMethod<string[]>(target, "getLocalColumns");
    return Array.isArray(columns) ? columns.map((column) => String(column)) : [];
  }

  private getQuotedForeignColumns(target: unknown): string[] {
    const quoted = this.invokeMethod<string[]>(target, "getQuotedForeignColumns", this);
    if (Array.isArray(quoted)) {
      return quoted;
    }

    const columns = this.invokeMethod<string[]>(target, "getForeignColumns");
    return Array.isArray(columns) ? columns.map((column) => String(column)) : [];
  }

  private resolveColumnTypeDeclaration(column: Record<string, unknown>): string {
    const type = column.type;
    if (type !== null && typeof type === "object") {
      const declaration = this.invokeMethod<string>(type, "getSQLDeclaration", column, this);
      if (typeof declaration === "string" && declaration.length > 0) {
        return declaration;
      }
    }

    if (typeof type === "string") {
      return type.toUpperCase();
    }

    return "TEXT";
  }

  private getDynamicColumnDeclarationSQL(column: unknown): string {
    const definition =
      this.invokeMethod<Record<string, unknown>>(column, "toArray") ??
      (column !== null && typeof column === "object"
        ? { ...(column as Record<string, unknown>) }
        : {});

    const quotedName = this.invokeMethod<string>(column, "getQuotedName", this);
    if (typeof quotedName === "string" && quotedName.length > 0) {
      definition.name = quotedName;
    }

    const comment = this.invokeMethod<string>(column, "getComment");
    if (typeof comment === "string") {
      definition.comment = comment;
    }

    return this.getColumnDeclarationSQL(String(definition.name ?? ""), definition);
  }

  private normalizeColumnForComparison(column: unknown): Record<string, unknown> {
    let normalized: Record<string, unknown>;

    if (column !== null && typeof column === "object") {
      const toArray = this.invokeMethod<Record<string, unknown>>(column, "toArray");
      normalized =
        toArray === undefined ? { ...(column as Record<string, unknown>) } : { ...toArray };
      const comment = this.invokeMethod<unknown>(column, "getComment");
      if (comment !== undefined) {
        normalized.comment = comment;
      }
    } else {
      normalized = { value: column };
    }

    normalized.columnDefinition = null;
    return normalized;
  }

  private readNumber(column: Record<string, unknown>, key: string): number | undefined {
    const value = column[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private readBoolean(column: Record<string, unknown>, key: string): boolean {
    return column[key] === true;
  }

  private ensureDatazenTypeMappingsInitialized(): void {
    if (this.datazenTypeMapping !== null) {
      return;
    }

    this.datazenTypeMapping = {};
    for (const [dbType, datazenType] of Object.entries(this.initializeDatazenTypeMappings())) {
      this.datazenTypeMapping[dbType.toLowerCase()] = datazenType;
    }
  }

  protected validateCreateTableOptions(
    _options: Record<string, unknown>,
    _methodName: string,
  ): void {}
}

function getColumnTypeName(type: unknown): string {
  if (type === null || type === undefined || typeof type !== "object") {
    return "";
  }

  return type.constructor.name;
}

function isIntegerMappingTypeName(typeName: string): boolean {
  return ["IntegerType", "SmallIntType", "BigIntType"].includes(typeName);
}

function isBooleanTypeName(typeName: string): boolean {
  return typeName === "BooleanType";
}

function isDateTimeMappingTypeName(typeName: string): boolean {
  return [
    "DateTimeType",
    "DateTimeImmutableType",
    "DateTimeTzType",
    "DateTimeTzImmutableType",
    "VarDateTimeType",
    "VarDateTimeImmutableType",
  ].includes(typeName);
}

function isTimeMappingTypeName(typeName: string): boolean {
  return ["TimeType", "TimeImmutableType"].includes(typeName);
}

function isDateMappingTypeName(typeName: string): boolean {
  return ["DateType", "DateImmutableType"].includes(typeName);
}
