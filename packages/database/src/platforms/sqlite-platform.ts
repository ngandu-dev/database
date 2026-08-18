import type { Connection } from "../connection";
import { SQLiteSchemaManager } from "../schema/sqlite-schema-manager";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import { NotSupported } from "./exception/not-supported";
import type { KeywordList } from "./keywords/keyword-list";
import { SQLiteKeywords } from "./keywords/sqlite-keywords";
import { SQLiteMetadataProvider } from "./sqlite/sqlite-metadata-provider";
import { TrimMode } from "./trim-mode";

export class SQLitePlatform extends AbstractPlatform {
  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      bigint: Types.BIGINT,
      blob: Types.BLOB,
      boolean: Types.BOOLEAN,
      char: Types.STRING,
      date: Types.DATE_MUTABLE,
      datetime: Types.DATETIME_MUTABLE,
      decimal: Types.DECIMAL,
      double: Types.FLOAT,
      float: Types.FLOAT,
      int: Types.INTEGER,
      integer: Types.INTEGER,
      numeric: Types.DECIMAL,
      real: Types.FLOAT,
      text: Types.TEXT,
      time: Types.TIME_MUTABLE,
      timestamp: Types.DATETIME_MUTABLE,
      varchar: Types.STRING,
    };
  }

  public getLocateExpression(
    string: string,
    substring: string,
    start: string | null = null,
  ): string {
    if (start === null || start === "1") {
      return `INSTR(${string}, ${substring})`;
    }

    return (
      `CASE WHEN INSTR(SUBSTR(${string}, ${start}), ${substring}) > 0 ` +
      `THEN INSTR(SUBSTR(${string}, ${start}), ${substring}) + ${start} - 1 ELSE 0 END`
    );
  }

  public override getTrimExpression(
    str: string,
    mode: TrimMode = TrimMode.UNSPECIFIED,
    char: string | null = null,
  ): string {
    const trimFunction =
      mode === TrimMode.LEADING ? "LTRIM" : mode === TrimMode.TRAILING ? "RTRIM" : "TRIM";

    if (char === null) {
      return `${trimFunction}(${str})`;
    }

    return `${trimFunction}(${str}, ${char})`;
  }

  public getSubstringExpression(
    string: string,
    start: string,
    length: string | null = null,
  ): string {
    if (length === null) {
      return `SUBSTR(${string}, ${start})`;
    }

    return `SUBSTR(${string}, ${start}, ${length})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `(JULIANDAY(${date1}, 'start of day') - JULIANDAY(${date2}, 'start of day'))`;
  }

  public getCurrentDateSQL(): string {
    return "CURRENT_DATE";
  }

  public getCurrentTimeSQL(): string {
    return "CURRENT_TIME";
  }

  protected override getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    let mappedInterval = interval;
    let mappedUnit = unit;

    if (mappedUnit === DateIntervalUnit.WEEK) {
      mappedInterval = this.multiplyInterval(mappedInterval, 7);
      mappedUnit = DateIntervalUnit.DAY;
    } else if (mappedUnit === DateIntervalUnit.QUARTER) {
      mappedInterval = this.multiplyInterval(mappedInterval, 3);
      mappedUnit = DateIntervalUnit.MONTH;
    }

    return `DATETIME(${date}, ${this.getConcatExpression(
      this.quoteStringLiteral(operator),
      mappedInterval,
      this.quoteStringLiteral(` ${mappedUnit}`),
    )})`;
  }

  public override getTruncateTableSQL(tableName: string, _cascade = false): string {
    return `DELETE FROM ${this.quoteIdentifier(tableName)}`;
  }

  public override getCreateForeignKeySQL(): string {
    throw NotSupported.new("getCreateForeignKeySQL");
  }

  public override getDropForeignKeySQL(): string {
    throw NotSupported.new("getDropForeignKeySQL");
  }

  public override getIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `INTEGER${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getBigIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    if (hasAutoIncrementFlag(column)) {
      return this.getIntegerTypeDeclarationSQL(column);
    }

    return `BIGINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getSmallIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    if (hasAutoIncrementFlag(column)) {
      return this.getIntegerTypeDeclarationSQL(column);
    }

    return `SMALLINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  protected override _getCommonIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    if (hasAutoIncrementFlag(column)) {
      return " PRIMARY KEY AUTOINCREMENT";
    }

    return column.unsigned === true ? " UNSIGNED" : "";
  }

  public getSetTransactionIsolationSQL(_level: TransactionIsolationLevel): string {
    throw NotSupported.new("setTransactionIsolation");
  }

  public supportsIdentityColumns(): boolean {
    return true;
  }

  public override supportsColumnCollation(): boolean {
    return true;
  }

  public override getCreateTableSQL(table: {
    getColumns(): readonly unknown[];
    getName(): string;
  }): string[] {
    return this.buildSQLiteCreateTableSQL(table, true);
  }

  protected override getCreateTableWithoutForeignKeysSQL(table: unknown): string[] {
    return this.buildSQLiteCreateTableSQL(table, false);
  }

  public override getUnionSelectPartSQL(subQuery: string): string {
    // Datazen parity: SQLite doesn't support wrapping each UNION sub-query in parentheses.
    return subQuery;
  }

  public override getCreateTablesSQL(tables: Iterable<unknown>): string[] {
    const sql: string[] = [];

    for (const table of tables) {
      sql.push(
        ...this.getCreateTableSQL(table as { getColumns(): readonly unknown[]; getName(): string }),
      );
    }

    return sql;
  }

  public override getDropTablesSQL(tables: Iterable<unknown>): string[] {
    const sql: string[] = [];

    for (const table of tables) {
      const quotedName = this.sqliteInvoke<string>(table, "getQuotedName", this);
      if (quotedName !== undefined) {
        sql.push(this.getDropTableSQL(quotedName));
        continue;
      }

      const rawName = this.sqliteInvoke<string>(table, "getName");
      if (rawName !== undefined) {
        sql.push(this.getDropTableSQL(this.quoteIdentifier(rawName)));
      }
    }

    return sql;
  }

  public override getAlterTableSQL(diff: unknown): string[] {
    const simpleSql = this.getSimpleAlterTableSQL(diff);
    if (simpleSql !== false) {
      return simpleSql;
    }

    const addedColumns = this.sqliteInvoke<unknown[]>(diff, "getAddedColumns") ?? [];
    const changedColumns = this.sqliteInvoke<unknown[]>(diff, "getChangedColumns") ?? [];
    const droppedColumns = this.sqliteInvoke<unknown[]>(diff, "getDroppedColumns") ?? [];

    const oldTable = this.sqliteInvoke<unknown>(diff, "getOldTable");
    const newTable = this.sqliteInvoke<unknown>(diff, "getNewTable");
    if (oldTable === undefined || newTable === undefined) {
      throw NotSupported.new("getAlterTableSQL");
    }

    const oldTableName = this.getSQLiteDynamicTableSQLName(oldTable);
    const oldQuotedName =
      this.sqliteInvoke<string>(oldTable, "getQuotedName", this) ?? oldTableName;
    const newQuotedName =
      this.sqliteInvoke<string>(newTable, "getQuotedName", this) ?? oldQuotedName;
    const tempTableName = this.quoteIdentifier(
      `__temp__${this.extractSQLiteBareTableName(oldTableName)}`,
    );

    const copyColumns = this.buildSQLiteAlterCopyColumnMap(
      oldTable,
      newTable,
      changedColumns,
      droppedColumns,
    );
    const sql: string[] = [];

    if (copyColumns.oldQuotedColumns.length > 0) {
      sql.push(
        `CREATE TEMPORARY TABLE ${tempTableName} AS SELECT ${copyColumns.oldQuotedColumns.join(", ")} FROM ${oldQuotedName}`,
      );
    }

    const rebuildTable = this.buildSQLiteAlterRebuildTable(
      oldTable,
      newTable,
      addedColumns,
      changedColumns,
      droppedColumns,
    );

    sql.push(this.getDropTableSQL(oldQuotedName));
    sql.push(...this.getCreateTableSQL(rebuildTable));

    if (copyColumns.oldQuotedColumns.length > 0) {
      sql.push(
        `INSERT INTO ${newQuotedName} (${copyColumns.newQuotedColumns.join(", ")}) SELECT ${copyColumns.oldQuotedColumns.join(", ")} FROM ${tempTableName}`,
      );
      sql.push(this.getDropTableSQL(tempTableName));
    }

    return sql;
  }

  private getSimpleAlterTableSQL(diff: unknown): string[] | false {
    const changedColumns = this.sqliteInvoke<unknown[]>(diff, "getChangedColumns") ?? [];
    const droppedColumns = this.sqliteInvoke<unknown[]>(diff, "getDroppedColumns") ?? [];
    const addedIndexes = this.sqliteInvoke<unknown[]>(diff, "getAddedIndexes") ?? [];
    const modifiedIndexes = this.sqliteInvoke<unknown[]>(diff, "getModifiedIndexes") ?? [];
    const droppedIndexes = this.sqliteInvoke<unknown[]>(diff, "getDroppedIndexes") ?? [];
    const renamedIndexes =
      this.sqliteInvoke<Record<string, unknown>>(diff, "getRenamedIndexes") ?? {};
    const addedForeignKeys = this.sqliteInvoke<unknown[]>(diff, "getAddedForeignKeys") ?? [];
    const modifiedForeignKeys = this.sqliteInvoke<unknown[]>(diff, "getModifiedForeignKeys") ?? [];
    const droppedForeignKeys = this.sqliteInvoke<unknown[]>(diff, "getDroppedForeignKeys") ?? [];

    if (
      changedColumns.length > 0 ||
      droppedColumns.length > 0 ||
      addedIndexes.length > 0 ||
      modifiedIndexes.length > 0 ||
      droppedIndexes.length > 0 ||
      Object.keys(renamedIndexes).length > 0 ||
      addedForeignKeys.length > 0 ||
      modifiedForeignKeys.length > 0 ||
      droppedForeignKeys.length > 0
    ) {
      return false;
    }

    const table = this.sqliteInvoke<unknown>(diff, "getOldTable");
    if (table === undefined) {
      return false;
    }

    const sql: string[] = [];
    const tableName = this.getSQLiteDynamicTableSQLName(table);
    const addedColumns = this.sqliteInvoke<unknown[]>(diff, "getAddedColumns") ?? [];

    for (const column of addedColumns) {
      const definition =
        this.sqliteInvoke<Record<string, unknown>>(column, "toArray") ??
        (column !== null && typeof column === "object"
          ? { ...(column as Record<string, unknown>) }
          : {});

      const type = definition.type;
      const defaultValue = definition.default;

      const requiresRebuild =
        typeof definition.columnDefinition === "string" ||
        definition.autoincrement === true ||
        (this.sqliteTypeHasConstructorName(type, "DateTimeType") &&
          defaultValue === this.getCurrentTimestampSQL()) ||
        (this.sqliteTypeHasConstructorName(type, "DateType") &&
          defaultValue === this.getCurrentDateSQL()) ||
        (this.sqliteTypeHasConstructorName(type, "TimeType") &&
          defaultValue === this.getCurrentTimeSQL());

      if (requiresRebuild) {
        return false;
      }

      const columnName =
        this.sqliteInvoke<string>(column, "getQuotedName", this) ?? String(definition.name ?? "");
      if (columnName.length === 0) {
        return false;
      }

      sql.push(
        `ALTER TABLE ${tableName} ADD COLUMN ${this.getColumnDeclarationSQL(columnName, {
          ...definition,
          name: columnName,
        })}`,
      );
    }

    return sql;
  }

  public override getCreateIndexSQL(index: unknown, table: string): string {
    if (this.sqliteInvoke<boolean>(index, "isPrimary") === true) {
      return this.getCreatePrimaryKeySQL(index, table);
    }

    const quotedColumns = this.getSQLiteQuotedColumns(index);
    if (quotedColumns.length === 0) {
      throw new Error(`Incomplete or invalid index definition on table ${table}`);
    }

    let indexName =
      this.sqliteInvoke<string>(index, "getQuotedName", this) ??
      this.sqliteInvoke<string>(index, "getName") ??
      "index";
    let tableName = table;

    if (table.includes(".")) {
      const [schemaName, bareTableName] = table.split(".", 2);
      if (schemaName !== undefined && bareTableName !== undefined) {
        indexName = `${schemaName}.${indexName}`;
        tableName = bareTableName;
      }
    }

    const flags = this.getCreateIndexSQLFlags(index);
    return `CREATE ${flags}INDEX ${indexName} ON ${tableName} (${quotedColumns.join(", ")})${this.getPartialIndexSQL(index)}`;
  }

  protected createReservedKeywordsList(): KeywordList {
    return new SQLiteKeywords();
  }

  public createSchemaManager(connection: Connection): SQLiteSchemaManager {
    return new SQLiteSchemaManager(connection, this);
  }

  public override createMetadataProvider(connection: Connection): SQLiteMetadataProvider {
    return new SQLiteMetadataProvider(connection, this);
  }

  private buildSQLiteCreateTableSQL(table: unknown, createForeignKeys: boolean): string[] {
    const createTableLike = this.asSQLiteCreateTableLike(table);
    this.assertCreateTableHasColumns(createTableLike);

    const tableName = this.getSQLiteDynamicTableSQLName(table);
    const columns = createTableLike
      .getColumns()
      .map((column) => this.columnToSQLiteCreateTableArray(column));
    let columnListSql = this.getColumnDeclarationListSQL(columns);

    const indexes = this.sqliteInvoke<unknown[]>(table, "getIndexes") ?? [];
    let primaryColumns: string[] = [];
    const indexSql: string[] = [];

    for (const index of indexes) {
      if (this.sqliteInvoke<boolean>(index, "isPrimary") === true) {
        primaryColumns = this.getSQLiteQuotedColumns(index);
        continue;
      }

      if (this.sqliteInvoke<boolean>(index, "isUnique") === true) {
        columnListSql += `, ${this.getUniqueConstraintDeclarationSQL(index)}`;
        continue;
      }

      indexSql.push(this.getCreateIndexSQL(index, tableName));
    }

    if (primaryColumns.length > 0 && !columns.some((column) => hasAutoIncrementFlag(column))) {
      columnListSql += `, PRIMARY KEY (${[...new Set(primaryColumns)].join(", ")})`;
    }

    if (createForeignKeys) {
      const foreignKeys = this.sqliteInvoke<unknown[]>(table, "getForeignKeys") ?? [];
      for (const foreignKey of foreignKeys) {
        columnListSql += `, ${this.getForeignKeyDeclarationSQL(foreignKey)}`;
      }
    }

    const check = this.getCheckDeclarationSQL(columns);
    let query = `CREATE TABLE ${tableName} (${columnListSql}`;
    if (check.length > 0) {
      query += `, ${check}`;
    }
    query += ")";

    return [query, ...indexSql];
  }

  private asSQLiteCreateTableLike(table: unknown): {
    getColumns(): readonly unknown[];
    getName(): string;
  } {
    const columns = this.sqliteInvoke<unknown[]>(table, "getColumns");
    const name = this.sqliteInvoke<string>(table, "getName");

    if (columns === undefined || name === undefined) {
      throw NotSupported.new("getCreateTableSQL");
    }

    return {
      getColumns: () => columns,
      getName: () => name,
    };
  }

  private columnToSQLiteCreateTableArray(column: unknown): Record<string, unknown> {
    const definition =
      this.sqliteInvoke<Record<string, unknown>>(column, "toArray") ??
      (column !== null && typeof column === "object"
        ? { ...(column as Record<string, unknown>) }
        : {});

    const quotedName = this.sqliteInvoke<string>(column, "getQuotedName", this);
    if (quotedName !== undefined) {
      definition.name = quotedName;
    } else if (definition.name !== undefined) {
      definition.name = String(definition.name);
    }

    const comment = this.sqliteInvoke<string>(column, "getComment");
    if (comment !== undefined) {
      definition.comment = comment;
    }

    return definition;
  }

  private getSQLiteDynamicTableSQLName(table: unknown): string {
    return (
      this.sqliteInvoke<string>(table, "getQuotedName", this) ??
      this.sqliteInvoke<string>(table, "getName") ??
      String(table)
    );
  }

  private getSQLiteQuotedColumns(target: unknown): string[] {
    const quoted = this.sqliteInvoke<string[]>(target, "getQuotedColumns", this);
    if (Array.isArray(quoted)) {
      return quoted;
    }

    const columns = this.sqliteInvoke<string[]>(target, "getColumns");
    return Array.isArray(columns) ? columns.map((column) => String(column)) : [];
  }

  private sqliteInvoke<T>(target: unknown, methodName: string, ...args: unknown[]): T | undefined {
    if (target === null || typeof target !== "object") {
      return undefined;
    }

    const candidate = target as Record<string, unknown>;
    const fn = candidate[methodName];
    if (typeof fn !== "function") {
      if (methodName === "getOldTable") {
        return candidate.oldTable as T | undefined;
      }

      if (methodName === "getNewTable") {
        return candidate.newTable as T | undefined;
      }

      return candidate[methodName] as T | undefined;
    }

    return (fn as (...callArgs: unknown[]) => T).apply(target, args);
  }

  private buildSQLiteAlterCopyColumnMap(
    oldTable: unknown,
    newTable: unknown,
    changedColumns: unknown[],
    droppedColumns: unknown[],
  ): { oldQuotedColumns: string[]; newQuotedColumns: string[] } {
    const dropped = new Set(
      droppedColumns
        .map((column) => this.sqliteInvoke<string>(column, "getName")?.toLowerCase())
        .filter((name): name is string => typeof name === "string"),
    );
    const changedByOldName = new Map<string, { oldColumn: unknown; newColumn: unknown }>();

    for (const columnDiff of changedColumns) {
      const oldColumn = this.sqliteInvoke<unknown>(columnDiff, "getOldColumn");
      const newColumn = this.sqliteInvoke<unknown>(columnDiff, "getNewColumn");
      const oldName = this.sqliteInvoke<string>(oldColumn, "getName");
      if (oldColumn === undefined || newColumn === undefined || oldName === undefined) {
        continue;
      }

      changedByOldName.set(oldName.toLowerCase(), { newColumn, oldColumn });
    }

    const oldQuotedColumns: string[] = [];
    const newQuotedColumns: string[] = [];
    const newColumns = this.sqliteInvoke<unknown[]>(newTable, "getColumns") ?? [];
    const newByName = new Map<string, unknown>();

    for (const column of newColumns) {
      const name = this.sqliteInvoke<string>(column, "getName");
      if (typeof name === "string") {
        newByName.set(name.toLowerCase(), column);
      }
    }

    for (const oldColumn of this.sqliteInvoke<unknown[]>(oldTable, "getColumns") ?? []) {
      const oldName = this.sqliteInvoke<string>(oldColumn, "getName");
      if (typeof oldName !== "string") {
        continue;
      }

      const key = oldName.toLowerCase();
      if (dropped.has(key)) {
        continue;
      }

      const changed = changedByOldName.get(key);
      if (changed !== undefined) {
        const oldQuoted = this.sqliteInvoke<string>(changed.oldColumn, "getQuotedName", this);
        const newQuoted = this.sqliteInvoke<string>(changed.newColumn, "getQuotedName", this);
        if (oldQuoted !== undefined && newQuoted !== undefined) {
          oldQuotedColumns.push(oldQuoted);
          newQuotedColumns.push(newQuoted);
        }
        continue;
      }

      const currentColumn = newByName.get(key);
      const oldQuoted = this.sqliteInvoke<string>(oldColumn, "getQuotedName", this);
      const newQuoted =
        this.sqliteInvoke<string>(currentColumn, "getQuotedName", this) ?? oldQuoted;

      if (oldQuoted !== undefined && newQuoted !== undefined) {
        oldQuotedColumns.push(oldQuoted);
        newQuotedColumns.push(newQuoted);
      }
    }

    return { newQuotedColumns, oldQuotedColumns };
  }

  private extractSQLiteBareTableName(name: string): string {
    const unquoted = name.replaceAll('"', "");
    const dot = unquoted.indexOf(".");
    return dot >= 0 ? unquoted.slice(dot + 1) : unquoted;
  }

  private buildSQLiteAlterRebuildTable(
    oldTable: unknown,
    newTable: unknown,
    addedColumns: unknown[],
    changedColumns: unknown[],
    droppedColumns: unknown[],
  ): { getColumns(): readonly unknown[]; getName(): string } & Record<string, unknown> {
    const dropped = new Set(
      droppedColumns
        .map((column) => this.sqliteInvoke<string>(column, "getName")?.toLowerCase())
        .filter((name): name is string => typeof name === "string"),
    );
    const changedByOldName = new Map<string, unknown>();

    for (const columnDiff of changedColumns) {
      const oldColumn = this.sqliteInvoke<unknown>(columnDiff, "getOldColumn");
      const newColumn = this.sqliteInvoke<unknown>(columnDiff, "getNewColumn");
      const oldName = this.sqliteInvoke<string>(oldColumn, "getName");
      if (newColumn !== undefined && typeof oldName === "string") {
        changedByOldName.set(oldName.toLowerCase(), newColumn);
      }
    }

    const implicitRenameByOldName = new Map<string, unknown>();
    const remainingAdded = [...addedColumns];
    for (const droppedColumn of droppedColumns) {
      const droppedName = this.sqliteInvoke<string>(droppedColumn, "getName");
      if (typeof droppedName !== "string") {
        continue;
      }

      const matchIndex = remainingAdded.findIndex((addedColumn) =>
        this.sqliteColumnsHaveSameDefinition(droppedColumn, addedColumn),
      );
      if (matchIndex < 0) {
        continue;
      }

      const matchedAdded = remainingAdded.splice(matchIndex, 1)[0];
      if (matchedAdded !== undefined) {
        implicitRenameByOldName.set(droppedName.toLowerCase(), matchedAdded);
      }
    }

    const newColumns = this.sqliteInvoke<unknown[]>(newTable, "getColumns") ?? [];
    const newByName = new Map<string, unknown>();
    for (const column of newColumns) {
      const name = this.sqliteInvoke<string>(column, "getName");
      if (typeof name === "string") {
        newByName.set(name.toLowerCase(), column);
      }
    }

    const orderedColumns: unknown[] = [];
    const usedNames = new Set<string>();

    for (const oldColumn of this.sqliteInvoke<unknown[]>(oldTable, "getColumns") ?? []) {
      const oldName = this.sqliteInvoke<string>(oldColumn, "getName");
      if (typeof oldName !== "string") {
        continue;
      }

      const key = oldName.toLowerCase();
      const implicitReplacement = implicitRenameByOldName.get(key);
      if (dropped.has(key) && implicitReplacement === undefined) {
        continue;
      }

      const replacement = changedByOldName.get(key) ?? implicitReplacement ?? newByName.get(key);
      if (replacement !== undefined) {
        orderedColumns.push(replacement);
        const replacementName = this.sqliteInvoke<string>(replacement, "getName");
        if (typeof replacementName === "string") {
          usedNames.add(replacementName.toLowerCase());
        }
      }
    }

    for (const column of newColumns) {
      const name = this.sqliteInvoke<string>(column, "getName");
      if (typeof name !== "string") {
        continue;
      }

      const key = name.toLowerCase();
      if (usedNames.has(key)) {
        continue;
      }

      orderedColumns.push(column);
      usedNames.add(key);
    }

    const getName = () => this.sqliteInvoke<string>(newTable, "getName") ?? "";

    return {
      getColumns: () => orderedColumns,
      getForeignKeys: () => this.sqliteInvoke<unknown[]>(newTable, "getForeignKeys") ?? [],
      getIndexes: () => this.sqliteInvoke<unknown[]>(newTable, "getIndexes") ?? [],
      getName,
      getOptions: () => this.sqliteInvoke<Record<string, unknown>>(newTable, "getOptions") ?? {},
      getQuotedName: () => this.sqliteInvoke<string>(newTable, "getQuotedName", this) ?? getName(),
    };
  }

  private sqliteColumnsHaveSameDefinition(left: unknown, right: unknown): boolean {
    const leftDef = this.sqliteInvoke<Record<string, unknown>>(left, "toArray") ?? {};
    const rightDef = this.sqliteInvoke<Record<string, unknown>>(right, "toArray") ?? {};

    return (
      JSON.stringify(this.normalizeSqliteRenameCandidate(leftDef)) ===
      JSON.stringify(this.normalizeSqliteRenameCandidate(rightDef))
    );
  }

  private normalizeSqliteRenameCandidate(
    definition: Record<string, unknown>,
  ): Record<string, unknown> {
    const rawType = definition.type;
    const typeIdentity =
      typeof rawType === "string"
        ? rawType.toLowerCase()
        : typeof (rawType as { constructor?: { name?: unknown } } | null)?.constructor?.name ===
            "string"
          ? String((rawType as { constructor: { name: string } }).constructor.name)
          : "";

    return {
      autoincrement: definition.autoincrement === true,
      fixed: definition.fixed === true,
      length: typeof definition.length === "number" ? definition.length : null,
      notnull: definition.notnull !== false,
      precision: typeof definition.precision === "number" ? definition.precision : null,
      scale: typeof definition.scale === "number" ? definition.scale : 0,
      type: typeIdentity,
      unsigned: definition.unsigned === true,
    };
  }

  private sqliteTypeHasConstructorName(type: unknown, constructorName: string): boolean {
    if (type === null || typeof type !== "object") {
      return false;
    }

    return (type as { constructor?: { name?: unknown } }).constructor?.name === constructorName;
  }
}

function hasAutoIncrementFlag(column: Record<string, unknown>): boolean {
  return column.autoincrement === true;
}
