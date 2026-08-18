import type { Connection } from "../connection";
import { ColumnLengthRequired } from "../exception/invalid-column-type/column-length-required";
import { LockMode } from "../lock-mode";
import { SQLServerSchemaManager } from "../schema/sqlserver-schema-manager";
import type { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import { NotSupported } from "./exception/not-supported";
import type { KeywordList } from "./keywords/keyword-list";
import { SQLServerKeywords } from "./keywords/sqlserver-keywords";
import { SQLServerSelectSQLBuilder } from "./sqlserver/sql/builder/sqlserver-select-sql-builder";
import { SQLServerMetadataProvider } from "./sqlserver/sqlserver-metadata-provider";
import { TrimMode } from "./trim-mode";

export class SQLServerPlatform extends AbstractPlatform {
  public static readonly OPTION_DEFAULT_CONSTRAINT_NAME = "default_constraint_name";

  public override createSelectSQLBuilder(): SelectSQLBuilder {
    return new SQLServerSelectSQLBuilder(this);
  }

  protected override _getCreateTableSQL(
    name: string,
    columns: Array<Record<string, unknown>>,
    options: Record<string, unknown> = {},
  ): string[] {
    this.validateCreateTableOptions(options, "_getCreateTableSQL");

    const defaultConstraintsSql: string[] = [];
    const commentsSql: string[] = [];
    const primarySet = new Set(
      Array.isArray(options.primary) ? options.primary.map((column) => String(column)) : [],
    );

    for (const column of columns) {
      if (primarySet.has(String(column.name ?? ""))) {
        column.notnull = true;
      }

      if (column.default !== undefined && column.default !== null) {
        defaultConstraintsSql.push(
          `ALTER TABLE ${name} ADD${this.getDefaultConstraintDeclarationSQL(column)}`,
        );
      }

      if (typeof column.comment === "string" && column.comment.length > 0) {
        commentsSql.push(
          this.getCreateColumnCommentSQL(name, String(column.name ?? ""), column.comment),
        );
      }
    }

    let columnListSql = this.getColumnDeclarationListSQL(columns);

    const uniqueConstraints = Array.isArray(options.uniqueConstraints)
      ? (options.uniqueConstraints as unknown[])
      : [];
    for (const definition of uniqueConstraints) {
      columnListSql += `, ${this.getUniqueConstraintDeclarationSQL(definition)}`;
    }

    const primary = Array.isArray(options.primary) ? options.primary.map(String) : [];
    if (primary.length > 0) {
      let flags = "";
      const hasFlag = (options.primary_index as { hasFlag?: (name: string) => boolean } | undefined)
        ?.hasFlag;
      if (
        typeof hasFlag === "function" &&
        hasFlag.call(options.primary_index, "nonclustered") === true
      ) {
        flags = " NONCLUSTERED";
      }

      columnListSql += `, PRIMARY KEY${flags} (${[...new Set(primary)].join(", ")})`;
    }

    let query = `CREATE TABLE ${name} (${columnListSql}`;
    const check = this.getCheckDeclarationSQL(columns);
    if (check.length > 0) {
      query += `, ${check}`;
    }
    query += ")";

    const sql = [query];

    const indexes = Array.isArray(options.indexes) ? (options.indexes as unknown[]) : [];
    for (const index of indexes) {
      sql.push(this.getCreateIndexSQL(index, name));
    }

    const foreignKeys = Array.isArray(options.foreignKeys)
      ? (options.foreignKeys as unknown[])
      : [];
    for (const definition of foreignKeys) {
      sql.push(this.getCreateForeignKeySQL(definition, name));
    }

    return [...sql, ...commentsSql, ...defaultConstraintsSql];
  }

  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      bigint: Types.BIGINT,
      binary: Types.BINARY,
      bit: Types.BOOLEAN,
      blob: Types.BLOB,
      char: Types.STRING,
      date: Types.DATE_MUTABLE,
      datetime: Types.DATETIME_MUTABLE,
      datetime2: Types.DATETIME_MUTABLE,
      datetimeoffset: Types.DATETIMETZ_MUTABLE,
      decimal: Types.DECIMAL,
      double: Types.FLOAT,
      "double precision": Types.FLOAT,
      float: Types.FLOAT,
      image: Types.BLOB,
      int: Types.INTEGER,
      money: Types.INTEGER,
      nchar: Types.STRING,
      ntext: Types.TEXT,
      numeric: Types.DECIMAL,
      nvarchar: Types.STRING,
      real: Types.SMALLFLOAT,
      smalldatetime: Types.DATETIME_MUTABLE,
      smallint: Types.SMALLINT,
      smallmoney: Types.INTEGER,
      sysname: Types.STRING,
      text: Types.TEXT,
      time: Types.TIME_MUTABLE,
      tinyint: Types.SMALLINT,
      uniqueidentifier: Types.GUID,
      varbinary: Types.BINARY,
      varchar: Types.STRING,
      xml: Types.TEXT,
    };
  }

  public getCurrentDateSQL(): string {
    return "CONVERT(date, GETDATE())";
  }

  public getCurrentTimeSQL(): string {
    return "CONVERT(time, GETDATE())";
  }

  protected getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    const factor = operator === "-" ? "-1 * " : "";
    return `DATEADD(${unit}, ${factor}${interval}, ${date})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DATEDIFF(day, ${date2}, ${date1})`;
  }

  public supportsIdentityColumns(): boolean {
    return true;
  }

  public supportsReleaseSavepoints(): boolean {
    return false;
  }

  public supportsSchemas(): boolean {
    return true;
  }

  public supportsColumnCollation(): boolean {
    return true;
  }

  public supportsSequences(): boolean {
    return true;
  }

  public override getDropIndexSQL(name: string, table: string): string {
    return `DROP INDEX ${name} ON ${table}`;
  }

  public override getIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `INT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getBigIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `BIGINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getSmallIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `SMALLINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  protected override _getCommonIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    return column.autoincrement === true ? " IDENTITY" : "";
  }

  public override getBooleanTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "BIT";
  }

  public override getAsciiStringTypeDeclarationSQL(column: Record<string, unknown>): string {
    const length = typeof column.length === "number" ? column.length : undefined;
    if (column.fixed === true) {
      return super.getCharTypeDeclarationSQLSnippet(length);
    }

    return super.getVarcharTypeDeclarationSQLSnippet(length);
  }

  public override getGuidTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "UNIQUEIDENTIFIER";
  }

  public override getClobTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "VARCHAR(MAX)";
  }

  public override getBlobTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "VARBINARY(MAX)";
  }

  public override getAlterTableSQL(diff: unknown): string[] {
    const addedColumns = this.readDiffArray(diff, "getAddedColumns");
    const changedColumns = this.readDiffArray(diff, "getChangedColumns").filter(
      (columnDiff) => !this.isSqlServerMetadataNoiseColumnDiff(columnDiff),
    );
    const droppedColumns = this.readDiffArray(diff, "getDroppedColumns");

    if (addedColumns.length === 0 && changedColumns.length === 0 && droppedColumns.length === 0) {
      return super.getAlterTableSQL(diff);
    }

    const oldTable = this.readDiffTable(diff, "getOldTable");
    const newTable = this.readDiffTable(diff, "getNewTable");
    if (oldTable === undefined || newTable === undefined) {
      throw NotSupported.new("getAlterTableSQL");
    }

    const newTableName = this.getDynamicSqlServerTableName(newTable);
    const sql: string[] = [];
    const commentsSql: string[] = [];

    for (const column of addedColumns) {
      sql.push(`ALTER TABLE ${newTableName} ADD ${this.getSqlServerAddColumnDeclaration(column)}`);
    }

    for (const column of droppedColumns) {
      const defaultValue = this.readDiffValue<unknown>(column, "getDefault");
      if (defaultValue !== undefined && defaultValue !== null) {
        sql.push(
          `ALTER TABLE ${newTableName} ${this.getAlterTableDropDefaultConstraintClause(column)}`,
        );
      }

      const quotedName = this.readDiffString(column, "getQuotedName", this);
      if (quotedName.length > 0) {
        sql.push(`ALTER TABLE ${newTableName} DROP COLUMN ${quotedName}`);
      }
    }

    for (const columnDiff of changedColumns) {
      const newColumn = this.readDiffValue<unknown>(columnDiff, "getNewColumn");
      const oldColumn = this.readDiffValue<unknown>(columnDiff, "getOldColumn");
      if (newColumn === undefined || oldColumn === undefined) {
        continue;
      }

      const nameChanged = this.readDiffValue<boolean>(columnDiff, "hasNameChanged") === true;
      if (nameChanged) {
        const oldColumnNameSQL = this.readDiffString(oldColumn, "getQuotedName", this);
        const newColumnName = this.readDiffString(newColumn, "getName");
        if (oldColumnNameSQL.length > 0 && newColumnName.length > 0) {
          sql.push(...this.getRenameColumnSQL(newTableName, oldColumnNameSQL, newColumnName));
        }
      }

      const newComment = this.readDiffString(newColumn, "getComment");
      const oldComment = this.readDiffString(oldColumn, "getComment");
      const hasCommentChanged =
        this.readDiffValue<boolean>(columnDiff, "hasCommentChanged") === true;
      if (hasCommentChanged) {
        const quotedColumnName = this.readDiffString(newColumn, "getQuotedName", this);
        if (quotedColumnName.length > 0) {
          if (oldComment.length > 0 && newComment.length > 0) {
            commentsSql.push(
              this.getAlterColumnCommentSQL(newTableName, quotedColumnName, newComment),
            );
          } else if (oldComment.length > 0 && newComment.length === 0) {
            commentsSql.push(this.getDropColumnCommentSQL(newTableName, quotedColumnName));
          } else if (oldComment.length === 0 && newComment.length > 0) {
            commentsSql.push(
              this.getCreateColumnCommentSQL(newTableName, quotedColumnName, newComment),
            );
          }
        }
      }

      const columnNameSQL = this.readDiffString(newColumn, "getQuotedName", this);
      if (columnNameSQL.length === 0) {
        continue;
      }

      const newDeclarationSQL = this.getColumnDeclarationSQL(
        columnNameSQL,
        this.toSqlServerColumnDefinition(newColumn),
      );
      const oldDeclarationSQL = this.getColumnDeclarationSQL(
        columnNameSQL,
        this.toSqlServerColumnDefinition(oldColumn),
      );
      const declarationSQLChanged = newDeclarationSQL !== oldDeclarationSQL;
      const defaultChanged = this.readDiffValue<boolean>(columnDiff, "hasDefaultChanged") === true;

      if (!declarationSQLChanged && !defaultChanged && !nameChanged) {
        continue;
      }

      const requireDropDefaultConstraint =
        this.alterColumnRequiresDropDefaultConstraint(columnDiff);
      if (requireDropDefaultConstraint) {
        sql.push(
          `ALTER TABLE ${newTableName} ${this.getAlterTableDropDefaultConstraintClause(oldColumn)}`,
        );
      }

      if (declarationSQLChanged) {
        sql.push(`ALTER TABLE ${newTableName} ALTER COLUMN ${newDeclarationSQL}`);
      }

      const newDefault = this.readDiffValue<unknown>(newColumn, "getDefault");
      if (
        newDefault !== null &&
        newDefault !== undefined &&
        (requireDropDefaultConstraint || defaultChanged)
      ) {
        sql.push(
          `ALTER TABLE ${newTableName} ${this.getAlterTableAddDefaultConstraintClause(newTableName, newColumn)}`,
        );
      }
    }

    const hasAnyOtherDiffs =
      this.readDiffArray(diff, "getAddedIndexes").length > 0 ||
      this.readDiffArray(diff, "getModifiedIndexes").length > 0 ||
      this.readDiffArray(diff, "getDroppedIndexes").length > 0 ||
      Object.keys(this.readDiffRecord(diff, "getRenamedIndexes")).length > 0 ||
      this.readDiffArray(diff, "getAddedForeignKeys").length > 0 ||
      this.readDiffArray(diff, "getModifiedForeignKeys").length > 0 ||
      this.readDiffArray(diff, "getDroppedForeignKeys").length > 0;

    if (hasAnyOtherDiffs) {
      const diffWithoutAddedColumns = Object.create(diff as object) as Record<string, unknown>;
      diffWithoutAddedColumns.addedColumns = [];
      diffWithoutAddedColumns.getAddedColumns = () => [];

      sql.push(...super.getAlterTableSQL(diffWithoutAddedColumns));
    }

    return [...sql, ...commentsSql];
  }

  public override getDateTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "DATETIME2(6)";
  }

  public override getDateTimeTzTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "DATETIMEOFFSET(6)";
  }

  public override getDateTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "DATE";
  }

  public override getTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TIME(0)";
  }

  protected createReservedKeywordsList(): KeywordList {
    return new SQLServerKeywords();
  }

  public createSchemaManager(connection: Connection): SQLServerSchemaManager {
    return new SQLServerSchemaManager(connection, this);
  }

  public override createMetadataProvider(connection: Connection): SQLServerMetadataProvider {
    return new SQLServerMetadataProvider(connection, this);
  }

  public getLocateExpression(
    string: string,
    substring: string,
    start: string | null = null,
  ): string {
    if (start === null) {
      return `CHARINDEX(${substring}, ${string})`;
    }

    return `CHARINDEX(${substring}, ${string}, ${start})`;
  }

  public getModExpression(dividend: string, divisor: string): string {
    return `${dividend} % ${divisor}`;
  }

  protected override getCharTypeDeclarationSQLSnippet(length: number | undefined): string {
    return length === undefined ? "NCHAR" : `NCHAR(${length})`;
  }

  protected override getVarcharTypeDeclarationSQLSnippet(length: number | undefined): string {
    if (length === undefined) {
      throw ColumnLengthRequired.new(this, "NVARCHAR");
    }

    return `NVARCHAR(${length})`;
  }

  public getTrimExpression(
    str: string,
    mode: TrimMode = TrimMode.UNSPECIFIED,
    char: string | null = null,
  ): string {
    if (char === null) {
      if (mode === TrimMode.LEADING) {
        return `LTRIM(${str})`;
      }

      if (mode === TrimMode.TRAILING) {
        return `RTRIM(${str})`;
      }

      return `LTRIM(RTRIM(${str}))`;
    }

    const pattern = `'%[^' + ${char} + ']%'`;

    if (mode === TrimMode.LEADING) {
      return `stuff(${str}, 1, patindex(${pattern}, ${str}) - 1, null)`;
    }

    if (mode === TrimMode.TRAILING) {
      return `reverse(stuff(reverse(${str}), 1, patindex(${pattern}, reverse(${str})) - 1, null))`;
    }

    return `reverse(stuff(reverse(stuff(${str}, 1, patindex(${pattern}, ${str}) - 1, null)), 1, patindex(${pattern}, reverse(stuff(${str}, 1, patindex(${pattern}, ${str}) - 1, null))) - 1, null))`;
  }

  public getConcatExpression(...string: string[]): string {
    return `CONCAT(${string.join(", ")})`;
  }

  public getSubstringExpression(
    string: string,
    start: string,
    length: string | null = null,
  ): string {
    if (length === null) {
      return `SUBSTRING(${string}, ${start}, LEN(${string}) - ${start} + 1)`;
    }

    return `SUBSTRING(${string}, ${start}, ${length})`;
  }

  public getLengthExpression(string: string): string {
    return `LEN(${string})`;
  }

  public getCurrentDatabaseExpression(): string {
    return "DB_NAME()";
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET TRANSACTION ISOLATION LEVEL ${this.getTransactionIsolationLevelSQL(level)}`;
  }

  public getDateTimeFormatString(): string {
    return "Y-m-d H:i:s.u";
  }

  public getDateTimeTzFormatString(): string {
    return "Y-m-d H:i:s.u P";
  }

  public getDateFormatString(): string {
    return "Y-m-d";
  }

  public getTimeFormatString(): string {
    return "H:i:s";
  }

  public override getCreateTemporaryTableSnippetSQL(): string {
    return "CREATE TABLE";
  }

  public override getTemporaryTableName(tableName: string): string {
    return `#${tableName}`;
  }

  public getEmptyIdentityInsertSQL(
    quotedTableName: string,
    _quotedIdentifierColumnName: string,
  ): string {
    return `INSERT INTO ${quotedTableName} DEFAULT VALUES`;
  }

  public createSavePoint(savepoint: string): string {
    return `SAVE TRANSACTION ${savepoint}`;
  }

  public releaseSavePoint(_savepoint: string): string {
    return "";
  }

  public rollbackSavePoint(savepoint: string): string {
    return `ROLLBACK TRANSACTION ${savepoint}`;
  }

  public appendLockHint(fromClause: string, lockMode: LockMode): string {
    switch (lockMode) {
      case LockMode.NONE:
      case LockMode.OPTIMISTIC:
        return fromClause;
      case LockMode.PESSIMISTIC_READ:
        return `${fromClause} WITH (HOLDLOCK, ROWLOCK)`;
      case LockMode.PESSIMISTIC_WRITE:
        return `${fromClause} WITH (UPDLOCK, ROWLOCK)`;
    }
  }

  public convertBooleans(item: unknown): unknown {
    if (Array.isArray(item)) {
      return item.map((value) =>
        typeof value === "boolean" || typeof value === "number" ? Number(Boolean(value)) : value,
      );
    }

    if (typeof item === "boolean" || typeof item === "number") {
      return Number(Boolean(item));
    }

    return item;
  }

  protected doModifyLimitQuery(query: string, limit: number | null, offset: number): string {
    if (limit === null && offset <= 0) {
      return query;
    }

    if (this.shouldAddOrderBy(query)) {
      if (/^SELECT\s+DISTINCT/im.test(query)) {
        // SQL Server won't let us order by a non-selected column in a DISTINCT query,
        // so we have to do this madness. This says, order by the first column in the
        // result. SQL Server's docs say that a nonordered query's result order is non-
        // deterministic anyway, so this won't do anything that a bunch of update and
        // deletes to the table wouldn't do anyway.
        query += " ORDER BY 1";
      } else {
        // In another DBMS, we could do ORDER BY 0, but SQL Server gets angry if you
        // use constant expressions in the order by list.
        query += " ORDER BY (SELECT 0)";
      }
    }

    // This looks somewhat like MYSQL, but limit/offset are in inverse positions
    // Supposedly SQL:2008 core standard.
    // Per TSQL spec, FETCH NEXT n ROWS ONLY is not valid without OFFSET n ROWS.
    query += ` OFFSET ${offset} ROWS`;

    if (limit !== null) {
      query += ` FETCH NEXT ${limit} ROWS ONLY`;
    }

    return query;
  }

  private shouldAddOrderBy(query: string): boolean {
    // Find the position of the last instance of ORDER BY and ensure it is not within a parenthetical statement
    const matches = [...query.matchAll(/\s+order\s+by\s/gi)];
    if (matches.length === 0) {
      return true;
    }

    // ORDER BY instance may be in a subquery after ORDER BY
    //e.g. SELECT col1 FROM test ORDER BY (SELECT col2 from test ORDER BY col2)
    // if in the searched query ORDER BY clause was found where
    // number of open parentheses after the occurrence of the clause is equal to
    // number of closed brackets after the occurrence of the clause,
    // it means that ORDER BY is included in the query being checked
    for (let i = matches.length - 1; i >= 0; i--) {
      const orderByPos = matches[i]!.index!;
      const openBracketsCount = this.countChar(query, "(", orderByPos);
      const closedBracketsCount = this.countChar(query, ")", orderByPos);

      if (openBracketsCount === closedBracketsCount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper function to count occurrences of a character after a given index
   */
  private countChar(input: string, char: string, start: number): number {
    let count = 0;
    for (let i = start; i < input.length; i++) {
      if (input[i] === char) {
        count++;
      }
    }
    return count;
  }

  public quoteSingleIdentifier(str: string): string {
    return `[${str.replace(/]/g, "]]")}]`;
  }

  protected getLikeWildcardCharacters(): string {
    return `${super.getLikeWildcardCharacters()}[`;
  }

  protected getCreateColumnCommentSQL(
    tableName: string,
    columnName: string,
    comment: string,
  ): string {
    return this.getAddExtendedPropertySQL("MS_Description", comment, tableName, columnName);
  }

  protected getDefaultConstraintDeclarationSQL(column: Record<string, unknown>): string {
    if (column.default === undefined || column.default === null) {
      throw new Error('Incomplete column definition. "default" required.');
    }

    return `${this.getDefaultValueDeclarationSQL(column)} FOR ${String(column.name ?? "")}`;
  }

  protected getAlterColumnCommentSQL(
    tableName: string,
    columnName: string,
    comment: string,
  ): string {
    return this.getUpdateExtendedPropertySQL("MS_Description", comment, tableName, columnName);
  }

  protected getDropColumnCommentSQL(tableName: string, columnName: string): string {
    return this.getDropExtendedPropertySQL("MS_Description", tableName, columnName);
  }

  protected getAddExtendedPropertySQL(
    propertyName: string,
    propertyValue: unknown,
    ...arguments_: string[]
  ): string {
    const value =
      propertyValue === null || propertyValue === undefined
        ? "NULL"
        : this.quoteNationalStringLiteral(String(propertyValue));
    return this.getExecSQL(
      "sp_addextendedproperty",
      this.quoteNationalStringLiteral(propertyName),
      value,
      ...arguments_,
    );
  }

  protected getDropExtendedPropertySQL(propertyName: string, ...arguments_: string[]): string {
    return this.getExecSQL(
      "sp_dropextendedproperty",
      this.quoteNationalStringLiteral(propertyName),
      ...arguments_,
    );
  }

  protected getUpdateExtendedPropertySQL(
    propertyName: string,
    propertyValue: unknown,
    ...arguments_: string[]
  ): string {
    const value =
      propertyValue === null || propertyValue === undefined
        ? "NULL"
        : this.quoteNationalStringLiteral(String(propertyValue));
    return this.getExecSQL(
      "sp_updateextendedproperty",
      this.quoteNationalStringLiteral(propertyName),
      value,
      ...arguments_,
    );
  }

  private getExecSQL(procedureName: string, ...arguments_: string[]): string {
    return arguments_.length > 0
      ? `EXEC ${procedureName} ${arguments_.join(", ")}`
      : `EXEC ${procedureName}`;
  }

  private quoteNationalStringLiteral(value: string): string {
    return `N${this.quoteStringLiteral(value)}`;
  }

  public override getColumnDeclarationSQL(name: string, column: Record<string, unknown>): string {
    if (typeof column.columnDefinition === "string") {
      return `${name} ${column.columnDefinition}`;
    }

    let declaration = this.resolveColumnTypeDeclarationForSQLServer(column);

    if (typeof column.collation === "string" && column.collation.length > 0) {
      declaration += ` ${this.getColumnCollationDeclarationSQL(column.collation)}`;
    }

    if (column.notnull === true) {
      declaration += " NOT NULL";
    }

    return `${name} ${declaration}`;
  }

  public override columnsEqual(column1: unknown, column2: unknown): boolean {
    if (!super.columnsEqual(column1, column2)) {
      return false;
    }

    const left = this.toSqlServerColumnDefinition(column1);
    const right = this.toSqlServerColumnDefinition(column2);

    return this.getDefaultValueDeclarationSQL(left) === this.getDefaultValueDeclarationSQL(right);
  }

  public override getColumnCollationDeclarationSQL(collation: string): string {
    return `COLLATE ${collation}`;
  }

  private resolveColumnTypeDeclarationForSQLServer(column: Record<string, unknown>): string {
    const type = column.type;
    if (type !== null && typeof type === "object") {
      const getSQLDeclaration = (type as { getSQLDeclaration?: unknown }).getSQLDeclaration;
      if (typeof getSQLDeclaration === "function") {
        const declaration = (
          getSQLDeclaration as (
            column: Record<string, unknown>,
            platform: SQLServerPlatform,
          ) => unknown
        )(column, this);
        if (typeof declaration === "string" && declaration.length > 0) {
          return declaration;
        }
      }
    }

    if (typeof type === "string") {
      return type.toUpperCase();
    }

    return "TEXT";
  }

  private getSqlServerAddColumnDeclaration(column: unknown): string {
    const definition = this.toSqlServerColumnDefinition(column);
    return super.getColumnDeclarationSQL(String(definition.name ?? ""), definition);
  }

  private toSqlServerColumnDefinition(column: unknown): Record<string, unknown> {
    const definition =
      this.readDiffRecord(column, "toArray") ??
      (column !== null && typeof column === "object"
        ? { ...(column as Record<string, unknown>) }
        : {});

    const quotedName = this.readDiffString(column, "getQuotedName", this);
    if (quotedName.length > 0) {
      definition.name = quotedName;
    }

    const comment = this.readDiffString(column, "getComment");
    if (comment.length > 0) {
      definition.comment = comment;
    }

    return definition;
  }

  protected override getRenameColumnSQL(
    tableName: string,
    oldColumnName: string,
    newColumnName: string,
  ): string[] {
    return [
      this.getExecSQL(
        "sp_rename",
        this.quoteNationalStringLiteral(`${tableName}.${oldColumnName}`),
        this.quoteNationalStringLiteral(newColumnName),
      ),
    ];
  }

  private getAlterTableAddDefaultConstraintClause(_tableName: string, column: unknown): string {
    const columnDef = this.toSqlServerColumnDefinition(column);
    const quotedName = this.readDiffString(column, "getQuotedName", this);
    if (quotedName.length > 0) {
      columnDef.name = quotedName;
    }

    return `ADD${this.getDefaultConstraintDeclarationSQL(columnDef)}`;
  }

  private getAlterTableDropDefaultConstraintClause(column: unknown): string {
    const hasPlatformOption =
      this.readDiffValue<boolean>(
        column,
        "hasPlatformOption",
        SQLServerPlatform.OPTION_DEFAULT_CONSTRAINT_NAME,
      ) === true;
    if (!hasPlatformOption) {
      throw new Error(
        `Column ${this.readDiffString(column, "getName")} was not properly introspected and is missing a default constraint name.`,
      );
    }

    const name = this.readDiffValue<unknown>(
      column,
      "getPlatformOption",
      SQLServerPlatform.OPTION_DEFAULT_CONSTRAINT_NAME,
    );
    return `DROP CONSTRAINT ${this.quoteSingleIdentifier(String(name ?? ""))}`;
  }

  private alterColumnRequiresDropDefaultConstraint(columnDiff: unknown): boolean {
    const oldColumn = this.readDiffValue<unknown>(columnDiff, "getOldColumn");
    if (oldColumn === undefined) {
      return false;
    }

    const oldDefault = this.readDiffValue<unknown>(oldColumn, "getDefault");
    if (oldDefault === null || oldDefault === undefined) {
      return false;
    }

    if (this.readDiffValue<boolean>(columnDiff, "hasDefaultChanged") === true) {
      return true;
    }

    return (
      this.readDiffValue<boolean>(columnDiff, "hasTypeChanged") === true ||
      this.readDiffValue<boolean>(columnDiff, "hasFixedChanged") === true
    );
  }

  private readDiffArray(target: unknown, methodName: string): unknown[] {
    const value = this.readDiffValue<unknown>(target, methodName);
    return Array.isArray(value) ? value : [];
  }

  private readDiffRecord(target: unknown, methodName: string): Record<string, unknown> {
    const value = this.readDiffValue<unknown>(target, methodName);
    return value !== null && typeof value === "object"
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  private readDiffTable(target: unknown, methodName: string): unknown | undefined {
    const value = this.readDiffValue<unknown>(target, methodName);
    if (value !== undefined) {
      return value;
    }

    if (target !== null && typeof target === "object") {
      if (methodName === "getOldTable") {
        return (target as { oldTable?: unknown }).oldTable;
      }

      if (methodName === "getNewTable") {
        return (target as { newTable?: unknown }).newTable;
      }
    }

    return undefined;
  }

  private readDiffString(target: unknown, methodName: string, ...args: unknown[]): string {
    const value = this.readDiffValue<unknown>(target, methodName, ...args);
    return typeof value === "string" ? value : "";
  }

  private readDiffValue<T>(target: unknown, methodName: string, ...args: unknown[]): T | undefined {
    if (target === null || target === undefined) {
      return undefined;
    }

    const candidate = target as Record<string, unknown>;
    const fn = candidate[methodName];
    if (typeof fn === "function") {
      return (fn as (...callArgs: unknown[]) => T).apply(target, args);
    }

    return candidate[methodName] as T | undefined;
  }

  private getDynamicSqlServerTableName(table: unknown): string {
    const quoted = this.readDiffString(table, "getQuotedName", this);
    if (quoted.length > 0) {
      return quoted;
    }

    const name = this.readDiffString(table, "getName");
    if (name.length > 0) {
      return name;
    }

    throw NotSupported.new("getAlterTableSQL");
  }

  private isSqlServerMetadataNoiseColumnDiff(columnDiff: unknown): boolean {
    const changedProperties =
      (this.readDiffValue<unknown>(columnDiff, "changedProperties") as unknown) ??
      this.readDiffValue<unknown[]>(columnDiff, "getChangedProperties");

    if (!Array.isArray(changedProperties) || changedProperties.length === 0) {
      return false;
    }

    return changedProperties.every((name) => String(name) === "platformOptions");
  }
}
