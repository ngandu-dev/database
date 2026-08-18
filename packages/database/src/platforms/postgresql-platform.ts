import type { Connection } from "../connection";
import { PostgreSQLSchemaManager } from "../schema/postgresql-schema-manager";
import type { Sequence } from "../schema/sequence";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Type } from "../types/type";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import type { KeywordList } from "./keywords/keyword-list";
import { PostgreSQLKeywords } from "./keywords/postgresql-keywords";
import { PostgreSQLMetadataProvider } from "./postgresql/postgresql-metadata-provider";

export class PostgreSQLPlatform extends AbstractPlatform {
  protected useBooleanTrueFalseStrings = true;

  private readonly booleanLiterals = {
    false: ["f", "false", "n", "no", "off", "0"],
    true: ["t", "true", "y", "yes", "on", "1"],
  };

  protected override _getCreateTableSQL(
    name: string,
    columns: Array<Record<string, unknown>>,
    options: Record<string, unknown> = {},
  ): string[] {
    this.validateCreateTableOptions(options, "_getCreateTableSQL");

    let columnListSql = this.getColumnDeclarationListSQL(columns);

    const primary = Array.isArray(options.primary) ? options.primary.map(String) : [];
    if (primary.length > 0) {
      columnListSql += `, PRIMARY KEY (${[...new Set(primary)].join(", ")})`;
    }

    const unlogged = options.unlogged === true ? " UNLOGGED" : "";
    const sql = [`CREATE${unlogged} TABLE ${name} (${columnListSql})`];

    const indexes = Array.isArray(options.indexes) ? (options.indexes as unknown[]) : [];
    for (const index of indexes) {
      sql.push(this.getCreateIndexSQL(index, name));
    }

    const uniqueConstraints = Array.isArray(options.uniqueConstraints)
      ? (options.uniqueConstraints as unknown[])
      : [];
    for (const uniqueConstraint of uniqueConstraints) {
      sql.push(this.getCreateUniqueConstraintSQL(uniqueConstraint, name));
    }

    const foreignKeys = Array.isArray(options.foreignKeys)
      ? (options.foreignKeys as unknown[])
      : [];
    for (const definition of foreignKeys) {
      sql.push(this.getCreateForeignKeySQL(definition, name));
    }

    return sql;
  }

  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      _varchar: Types.STRING,
      bigint: Types.BIGINT,
      bigserial: Types.BIGINT,
      bool: Types.BOOLEAN,
      boolean: Types.BOOLEAN,
      bpchar: Types.STRING,
      bytea: Types.BLOB,
      char: Types.STRING,
      date: Types.DATE_MUTABLE,
      decimal: Types.DECIMAL,
      "double precision": Types.FLOAT,
      float: Types.FLOAT,
      float4: Types.SMALLFLOAT,
      float8: Types.FLOAT,
      inet: Types.STRING,
      int: Types.INTEGER,
      int2: Types.SMALLINT,
      int4: Types.INTEGER,
      int8: Types.BIGINT,
      integer: Types.INTEGER,
      interval: Types.STRING,
      json: Types.JSON,
      jsonb: Types.JSON,
      money: Types.DECIMAL,
      numeric: Types.DECIMAL,
      real: Types.SMALLFLOAT,
      serial: Types.INTEGER,
      serial4: Types.INTEGER,
      serial8: Types.BIGINT,
      smallint: Types.SMALLINT,
      text: Types.TEXT,
      time: Types.TIME_MUTABLE,
      timestamp: Types.DATETIME_MUTABLE,
      timestamptz: Types.DATETIMETZ_MUTABLE,
      timetz: Types.TIME_MUTABLE,
      tsvector: Types.TEXT,
      uuid: Types.GUID,
      varchar: Types.STRING,
    };
  }

  public getLocateExpression(
    string: string,
    substring: string,
    start: string | null = null,
  ): string {
    if (start !== null) {
      const sliced = this.getSubstringExpression(string, start);
      return `CASE WHEN (POSITION(${substring} IN ${sliced}) = 0) THEN 0 ELSE (POSITION(${substring} IN ${sliced}) + ${start} - 1) END`;
    }

    return `POSITION(${substring} IN ${string})`;
  }

  protected override getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    if (unit === DateIntervalUnit.QUARTER) {
      interval = this.multiplyInterval(interval, 3);
      unit = DateIntervalUnit.MONTH;
    }

    return `(${date} ${operator} (${interval} || ' ${unit}')::interval)`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `(DATE(${date1})-DATE(${date2}))`;
  }

  public getCurrentDatabaseExpression(): string {
    return "CURRENT_DATABASE()";
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL ${this.getTransactionIsolationLevelSQL(level)}`;
  }

  public override getAdvancedForeignKeyOptionsSQL(foreignKey: unknown): string {
    let query = "";
    const hasOption = (foreignKey as { hasOption?: (name: string) => boolean }).hasOption;
    const getOption = (foreignKey as { getOption?: (name: string) => unknown }).getOption;

    if (typeof hasOption === "function" && hasOption.call(foreignKey, "match")) {
      const matchOption =
        typeof getOption === "function" ? getOption.call(foreignKey, "match") : null;
      if (typeof matchOption === "string" && matchOption.length > 0) {
        query += ` MATCH ${matchOption}`;
      }
    }

    query += super.getAdvancedForeignKeyOptionsSQL(foreignKey);
    return query;
  }

  public supportsSchemas(): boolean {
    return true;
  }

  public supportsSequences(): boolean {
    return true;
  }

  public supportsIdentityColumns(): boolean {
    return true;
  }

  public override supportsPartialIndexes(): boolean {
    return true;
  }

  public override supportsCommentOnStatement(): boolean {
    return true;
  }

  public override getBooleanTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "BOOLEAN";
  }

  public override getGuidTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "UUID";
  }

  public override getDateTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TIMESTAMP(0) WITHOUT TIME ZONE";
  }

  public override getDateTimeTzTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TIMESTAMP(0) WITH TIME ZONE";
  }

  public override getTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TIME(0) WITHOUT TIME ZONE";
  }

  public override getClobTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TEXT";
  }

  public override getBlobTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "BYTEA";
  }

  public override getJsonTypeDeclarationSQL(column: Record<string, unknown>): string {
    return column.jsonb === true ? "JSONB" : "JSON";
  }

  public override getJsonbTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "JSONB";
  }

  protected override getBinaryTypeDeclarationSQLSnippet(_length: number | undefined): string {
    return "BYTEA";
  }

  protected override getVarbinaryTypeDeclarationSQLSnippet(_length: number | undefined): string {
    return "BYTEA";
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
    return column.autoincrement === true ? " GENERATED BY DEFAULT AS IDENTITY" : "";
  }

  public override getDefaultValueDeclarationSQL(column: Record<string, unknown>): string {
    if (column.autoincrement === true) {
      return "";
    }

    return super.getDefaultValueDeclarationSQL(column);
  }

  public override getCreateSequenceSQL(sequence: Sequence): string {
    return (
      `CREATE SEQUENCE ${sequence.getQuotedName(this)}` +
      ` INCREMENT BY ${sequence.getAllocationSize()}` +
      ` MINVALUE ${sequence.getInitialValue()}` +
      ` START ${sequence.getInitialValue()}` +
      this.getSequenceCacheSQL(sequence.getCacheSize())
    );
  }

  public override getAlterSequenceSQL(sequence: Sequence): string {
    return (
      `ALTER SEQUENCE ${sequence.getQuotedName(this)}` +
      ` INCREMENT BY ${sequence.getAllocationSize()}` +
      this.getSequenceCacheSQL(sequence.getCacheSize())
    );
  }

  public override getDropSequenceSQL(name: string): string {
    return `${super.getDropSequenceSQL(name)} CASCADE`;
  }

  public override getDropForeignKeySQL(foreignKey: string, table: string): string {
    return this.getDropConstraintSQL(foreignKey, table);
  }

  public override getDropIndexSQL(name: string, table: string): string {
    const primaryKeyName = table.endsWith('"') ? `${table.slice(0, -1)}_pkey"` : `${table}_pkey`;

    if (name === '"primary"' || name === primaryKeyName) {
      return this.getDropConstraintSQL(primaryKeyName, table);
    }

    let qualifiedIndexName = name;
    if (table.includes(".")) {
      const [schema] = table.split(".", 1);
      qualifiedIndexName = `${schema}.${name}`;
    }

    return super.getDropIndexSQL(qualifiedIndexName, table);
  }

  public override getSequenceNextValSQL(sequence: string): string {
    return `SELECT NEXTVAL('${sequence}')`;
  }

  public override getAlterTableSQL(diff: unknown): string[] {
    const table = this.readTableDiffValue<unknown>(diff, "getOldTable");
    const tableNameSQL = this.readQuotedName(table);
    if (table === undefined || tableNameSQL === null) {
      return super.getAlterTableSQL(diff);
    }

    const sql: string[] = [];
    const commentsSql: string[] = [];

    for (const addedColumn of this.readTableDiffList(diff, "getAddedColumns")) {
      const query = `ADD ${this.getPostgreSqlColumnDeclaration(addedColumn)}`;
      sql.push(`ALTER TABLE ${tableNameSQL} ${query}`);

      const comment = this.readTableDiffValue<string>(addedColumn, "getComment");
      if (typeof comment === "string" && comment.length > 0) {
        const quotedColumnName = this.readQuotedName(addedColumn);
        if (quotedColumnName !== null) {
          commentsSql.push(this.getCommentOnColumnSQL(tableNameSQL, quotedColumnName, comment));
        }
      }
    }

    for (const droppedColumn of this.readTableDiffList(diff, "getDroppedColumns")) {
      const quotedColumnName = this.readQuotedName(droppedColumn);
      if (quotedColumnName !== null) {
        sql.push(`ALTER TABLE ${tableNameSQL} DROP ${quotedColumnName}`);
      }
    }

    for (const columnDiff of this.readTableDiffList(diff, "getChangedColumns")) {
      const oldColumn = this.readTableDiffValue<unknown>(columnDiff, "getOldColumn");
      const newColumn = this.readTableDiffValue<unknown>(columnDiff, "getNewColumn");
      if (oldColumn === undefined || newColumn === undefined) {
        continue;
      }

      const oldColumnName = this.readQuotedName(oldColumn);
      const newColumnName = this.readQuotedName(newColumn);
      if (oldColumnName === null || newColumnName === null) {
        continue;
      }

      if (this.readTableDiffFlag(columnDiff, "hasNameChanged")) {
        sql.push(...this.getRenameColumnSQL(tableNameSQL, oldColumnName, newColumnName));
      }

      const newTypeSQLDeclaration = this.getTypeSQLDeclaration(newColumn);
      const oldTypeSQLDeclaration = this.getTypeSQLDeclaration(oldColumn);
      if (oldTypeSQLDeclaration !== newTypeSQLDeclaration) {
        sql.push(
          `ALTER TABLE ${tableNameSQL} ALTER ${newColumnName} TYPE ${newTypeSQLDeclaration}`,
        );
      }

      if (this.readTableDiffFlag(columnDiff, "hasDefaultChanged")) {
        const newDefault = this.readTableDiffValue<unknown>(newColumn, "getDefault");
        const defaultClause =
          newDefault === null || newDefault === undefined
            ? " DROP DEFAULT"
            : ` SET${this.getDefaultValueDeclarationSQL(this.getColumnArray(newColumn))}`;
        sql.push(`ALTER TABLE ${tableNameSQL} ALTER ${newColumnName}${defaultClause}`);
      }

      if (this.readTableDiffFlag(columnDiff, "hasNotNullChanged")) {
        const notNull = this.readTableDiffValue<boolean>(newColumn, "getNotnull") === true;
        sql.push(
          `ALTER TABLE ${tableNameSQL} ALTER ${newColumnName} ${notNull ? "SET" : "DROP"} NOT NULL`,
        );
      }

      if (this.readTableDiffFlag(columnDiff, "hasAutoIncrementChanged")) {
        const autoincrement =
          this.readTableDiffValue<boolean>(newColumn, "getAutoincrement") === true;
        sql.push(
          `ALTER TABLE ${tableNameSQL} ALTER ${newColumnName} ${
            autoincrement ? "ADD GENERATED BY DEFAULT AS IDENTITY" : "DROP IDENTITY"
          }`,
        );
      }

      if (this.readTableDiffFlag(columnDiff, "hasCommentChanged")) {
        commentsSql.push(
          this.getCommentOnColumnSQL(
            tableNameSQL,
            newColumnName,
            this.readTableDiffValue<string>(newColumn, "getComment") ?? "",
          ),
        );
      }
    }

    if (this.tableDiffHasNonColumnChanges(diff)) {
      sql.push(...this.getAlterTableNonColumnSql(diff));
    }

    return [
      ...this.getPreAlterTableIndexForeignKeySQL(diff),
      ...sql,
      ...commentsSql,
      ...this.getPostAlterTableIndexForeignKeySQL(diff),
    ];
  }

  public setUseBooleanTrueFalseStrings(flag: boolean): void {
    this.useBooleanTrueFalseStrings = flag;
  }

  public override convertBooleans(item: unknown): unknown {
    if (!this.useBooleanTrueFalseStrings) {
      return super.convertBooleans(item);
    }

    return this.doConvertBooleans(item, (value) => {
      if (value === null) {
        return "NULL";
      }

      return value === true ? "true" : "false";
    });
  }

  public override convertBooleansToDatabaseValue(item: unknown): unknown {
    if (!this.useBooleanTrueFalseStrings) {
      return super.convertBooleansToDatabaseValue(item);
    }

    return this.doConvertBooleans(item, (value) => (value === null ? null : Number(value)));
  }

  public override convertFromBoolean(item: unknown): boolean | null {
    if (
      typeof item === "string" &&
      this.booleanLiterals.false.includes(item.toLowerCase().trim())
    ) {
      return false;
    }

    return super.convertFromBoolean(item);
  }

  public getDefaultColumnValueSQLSnippet(): string {
    return [
      "SELECT",
      "    pg_get_expr(adbin, adrelid)",
      " FROM pg_attrdef",
      " WHERE c.oid = pg_attrdef.adrelid",
      "    AND pg_attrdef.adnum=a.attnum",
    ].join("\n");
  }

  protected createReservedKeywordsList(): KeywordList {
    return new PostgreSQLKeywords();
  }

  public createSchemaManager(connection: Connection): PostgreSQLSchemaManager {
    return new PostgreSQLSchemaManager(connection, this);
  }

  public override createMetadataProvider(connection: Connection): PostgreSQLMetadataProvider {
    return new PostgreSQLMetadataProvider(connection, this);
  }

  private convertSingleBooleanValue(
    value: unknown,
    callback: (booleanValue: boolean | null) => unknown,
  ): unknown {
    if (value === null) {
      return callback(null);
    }

    if (typeof value === "boolean") {
      return callback(value);
    }

    if (typeof value === "number") {
      return callback(value !== 0);
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (this.booleanLiterals.false.includes(normalized)) {
        return callback(false);
      }

      if (this.booleanLiterals.true.includes(normalized)) {
        return callback(true);
      }
    }

    return value;
  }

  private doConvertBooleans(
    item: unknown,
    callback: (booleanValue: boolean | null) => unknown,
  ): unknown {
    if (Array.isArray(item)) {
      return item.map((value) => this.doConvertBooleans(value, callback));
    }

    return this.convertSingleBooleanValue(item, callback);
  }

  private getSequenceCacheSQL(cacheSize: number | null): string {
    if (typeof cacheSize === "number" && cacheSize > 1) {
      return ` CACHE ${cacheSize}`;
    }

    return "";
  }

  private getTypeSQLDeclaration(column: unknown): string {
    const columnObject = column as {
      getType?: () => Type;
      toArray?: () => Record<string, unknown>;
    };
    const type = columnObject.getType?.();
    if (!(type instanceof Type)) {
      return this.resolveColumnDeclarationFallback(column);
    }

    const columnDefinition = { ...this.getColumnArray(column), autoincrement: false };
    return type.getSQLDeclaration(columnDefinition, this);
  }

  private resolveColumnDeclarationFallback(column: unknown): string {
    const definition = this.getColumnArray(column);
    const type = definition.type;
    if (typeof type === "string") {
      return type.toUpperCase();
    }

    return this.getColumnDeclarationSQL(String(definition.name ?? "column"), definition);
  }

  private getColumnArray(column: unknown): Record<string, unknown> {
    const definition = this.readTableDiffValue<Record<string, unknown>>(column, "toArray") ?? {};
    const quotedName = this.readQuotedName(column);
    if (quotedName !== null) {
      definition.name = quotedName;
    }

    return definition;
  }

  private getPostgreSqlColumnDeclaration(column: unknown): string {
    const definition = this.getColumnArray(column);
    const comment = this.readTableDiffValue<string>(column, "getComment");
    if (typeof comment === "string") {
      definition.comment = comment;
    }

    return this.getColumnDeclarationSQL(String(definition.name ?? ""), definition);
  }

  private getAlterTableNonColumnSql(diff: unknown): string[] {
    return super.getAlterTableSQL({
      getAddedColumns: () => [],
      getAddedForeignKeys: () => this.readTableDiffList(diff, "getAddedForeignKeys"),
      getAddedIndexes: () => this.readTableDiffList(diff, "getAddedIndexes"),
      getChangedColumns: () => [],
      getDroppedColumns: () => [],
      getDroppedForeignKeys: () => this.readTableDiffList(diff, "getDroppedForeignKeys"),
      getDroppedIndexes: () => this.readTableDiffList(diff, "getDroppedIndexes"),
      getModifiedForeignKeys: () => this.readTableDiffList(diff, "getModifiedForeignKeys"),
      getModifiedIndexes: () => this.readTableDiffList(diff, "getModifiedIndexes"),
      getNewTable: () =>
        this.readTableDiffValue<unknown>(diff, "getNewTable") ??
        this.readTableDiffValue<unknown>(diff, "newTable"),
      getOldTable: () => this.readTableDiffValue<unknown>(diff, "getOldTable"),
      getRenamedIndexes: () =>
        this.readTableDiffValue<Record<string, unknown>>(diff, "getRenamedIndexes") ?? {},
    });
  }

  private tableDiffHasNonColumnChanges(diff: unknown): boolean {
    return (
      this.readTableDiffList(diff, "getAddedIndexes").length > 0 ||
      this.readTableDiffList(diff, "getModifiedIndexes").length > 0 ||
      this.readTableDiffList(diff, "getDroppedIndexes").length > 0 ||
      Object.keys(this.readTableDiffValue<Record<string, unknown>>(diff, "getRenamedIndexes") ?? {})
        .length > 0 ||
      this.readTableDiffList(diff, "getAddedForeignKeys").length > 0 ||
      this.readTableDiffList(diff, "getModifiedForeignKeys").length > 0 ||
      this.readTableDiffList(diff, "getDroppedForeignKeys").length > 0
    );
  }

  private readQuotedName(target: unknown): string | null {
    const quoted = this.readTableDiffValue<string>(target, "getQuotedName", this);
    if (typeof quoted === "string" && quoted.length > 0) {
      return quoted;
    }

    const name = this.readTableDiffValue<string>(target, "getName");
    return typeof name === "string" && name.length > 0 ? this.quoteIdentifier(name) : null;
  }

  private readTableDiffList(target: unknown, methodName: string): unknown[] {
    const value = this.readTableDiffValue<unknown>(target, methodName);
    return Array.isArray(value) ? value : [];
  }

  private readTableDiffFlag(target: unknown, methodName: string): boolean {
    return this.readTableDiffValue<boolean>(target, methodName) === true;
  }

  private readTableDiffValue<T>(
    target: unknown,
    methodName: string,
    ...args: unknown[]
  ): T | undefined {
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
}
