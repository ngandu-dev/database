import type { Connection } from "../connection";
import type { AbstractPlatform } from "../platforms/abstract-platform";
import type { Column } from "./column";
import { Comparator } from "./comparator";
import { ComparatorConfig } from "./comparator-config";
import { TableDoesNotExist } from "./exception/table-does-not-exist";
import type { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { OptionallyQualifiedName } from "./name/optionally-qualified-name";
import { UnqualifiedName } from "./name/unqualified-name";
import type { PrimaryKeyConstraint } from "./primary-key-constraint";
import { Schema } from "./schema";
import { SchemaConfig } from "./schema-config";
import { SchemaDiff } from "./schema-diff";
import { Sequence } from "./sequence";
import { Table } from "./table";
import type { TableDiff } from "./table-diff";
import type { UniqueConstraint } from "./unique-constraint";
import { View } from "./view";

export abstract class AbstractSchemaManager {
  constructor(
    protected readonly connection: Connection,
    protected readonly platform: AbstractPlatform,
  ) {}

  public async initialize(): Promise<void> {}

  public async listDatabases(): Promise<string[]> {
    return this.fetchListedNames(this.getListDatabasesSQL());
  }

  public async listSchemaNames(): Promise<string[]> {
    return this.fetchListedNames(this.getListSchemaNamesSQL());
  }

  public async listSequences(): Promise<Sequence[]> {
    const names = await this.fetchListedNames(this.getListSequencesSQL());
    return names.map((name) => new Sequence(name));
  }

  public async listTableColumns(table: string): Promise<Column[]> {
    const database = this.getDatabase("listTableColumns");
    return this._getPortableTableColumnList(
      table,
      database,
      await this.fetchTableColumns(database, this.normalizeName(table)),
    );
  }

  public async listTableIndexes(table: string): Promise<Index[]> {
    const database = this.getDatabase("listTableIndexes");
    return this._getPortableTableIndexesList(
      await this.fetchIndexColumns(database, this.normalizeName(table)),
      this.normalizeName(table),
    );
  }

  public async tablesExist(names: string[]): Promise<boolean> {
    const existingNames = new Set((await this.listTableNames()).map((name) => name.toLowerCase()));
    return names.every((name) => existingNames.has(name.toLowerCase()));
  }

  public async listTableNames(): Promise<string[]> {
    const database = this.getDatabase("listTableNames");
    const rows = await this.selectTableNames(database);
    const filter = this.connection.getConfiguration().getSchemaAssetsFilter();

    return rows
      .map((row) => this._getPortableTableDefinition(row))
      .filter((value): value is string => value.length > 0)
      .filter((value) => filter(value));
  }

  public async listTables(): Promise<Table[]> {
    const database = this.getDatabase("listTables");
    const tableColumnsByTable = await this.fetchTableColumnsByTable(database);
    const indexColumnsByTable = await this.fetchIndexColumnsByTable(database);
    const foreignKeyColumnsByTable = await this.fetchForeignKeyColumnsByTable(database);
    const tableOptionsByTable = await this.fetchTableOptionsByTable(database);
    const filter = this.connection.getConfiguration().getSchemaAssetsFilter();
    const tables: Table[] = [];

    for (const [tableName, tableColumns] of Object.entries(tableColumnsByTable)) {
      if (!filter(tableName)) {
        continue;
      }

      tables.push(
        new Table(
          tableName,
          this._getPortableTableColumnList(tableName, database, tableColumns),
          this._getPortableTableIndexesList(indexColumnsByTable[tableName] ?? [], tableName),
          this._getPortableTableForeignKeysList(foreignKeyColumnsByTable[tableName] ?? []),
          tableOptionsByTable[tableName] ?? {},
        ),
      );
    }

    return tables;
  }

  public async tableExists(tableName: string): Promise<boolean> {
    const names = await this.listTableNames();
    const normalized = normalizeTableLookupName(tableName, this.platform.supportsSchemas());

    return names.some(
      (name) => normalizeTableLookupName(name, this.platform.supportsSchemas()) === normalized,
    );
  }

  public async listViewNames(): Promise<string[]> {
    const sql = this.getListViewNamesSQL();
    if (sql === null) {
      return [];
    }

    const names = await this.connection.fetchFirstColumn<unknown>(sql);
    const filter = this.connection.getConfiguration().getSchemaAssetsFilter();

    return names
      .map((value) => normalizeName(value))
      .filter((value): value is string => value !== null)
      .filter((value) => filter(value));
  }

  public async listViews(): Promise<View[]> {
    const names = await this.listViewNames();
    return names.map((name) => new View(name, ""));
  }

  public async introspectTable(name: string): Promise<Table> {
    const columns = await this.listTableColumns(name);

    if (columns.length === 0) {
      throw TableDoesNotExist.new(name);
    }

    return new Table(
      name,
      columns,
      await this.listTableIndexes(name),
      await this.listTableForeignKeys(name),
      await this.getTableOptions(name),
    );
  }

  public async listTableForeignKeys(table: string): Promise<ForeignKeyConstraint[]> {
    const database = this.getDatabase("listTableForeignKeys");
    return this._getPortableTableForeignKeysList(
      await this.fetchForeignKeyColumns(database, this.normalizeName(table)),
    );
  }

  public async introspectDatabaseNames(): Promise<UnqualifiedName[]> {
    return (await this.listDatabases()).map((name) => UnqualifiedName.unquoted(name));
  }

  public async introspectSchemaNames(): Promise<UnqualifiedName[]> {
    return (await this.listSchemaNames()).map((name) => UnqualifiedName.unquoted(name));
  }

  public async introspectTableNames(): Promise<OptionallyQualifiedName[]> {
    return (await this.listTableNames()).map((name) => parseOptionallyQualifiedName(name));
  }

  public async introspectTables(): Promise<Table[]> {
    return this.listTables();
  }

  public async introspectTableByUnquotedName(
    tableName: string,
    schemaName: string | null = null,
  ): Promise<Table> {
    return this.introspectTable(toQualifiedTableName(tableName, schemaName));
  }

  public async introspectTableByQuotedName(
    tableName: string,
    schemaName: string | null = null,
  ): Promise<Table> {
    return this.introspectTable(OptionallyQualifiedName.quoted(tableName, schemaName).toString());
  }

  public async introspectTableColumns(tableName: OptionallyQualifiedName): Promise<Column[]> {
    return this.listTableColumns(tableName.toString());
  }

  public async introspectTableColumnsByUnquotedName(
    tableName: string,
    schemaName: string | null = null,
  ): Promise<Column[]> {
    return this.introspectTableColumns(OptionallyQualifiedName.unquoted(tableName, schemaName));
  }

  public async introspectTableColumnsByQuotedName(
    tableName: string,
    schemaName: string | null = null,
  ): Promise<Column[]> {
    return this.introspectTableColumns(OptionallyQualifiedName.quoted(tableName, schemaName));
  }

  public async introspectTableIndexes(tableName: OptionallyQualifiedName): Promise<Index[]> {
    return this.listTableIndexes(tableName.toString());
  }

  public async introspectTableIndexesByUnquotedName(
    tableName: string,
    schemaName: string | null = null,
  ): Promise<Index[]> {
    return this.introspectTableIndexes(OptionallyQualifiedName.unquoted(tableName, schemaName));
  }

  public async introspectTableIndexesByQuotedName(
    tableName: string,
    schemaName: string | null = null,
  ): Promise<Index[]> {
    return this.introspectTableIndexes(OptionallyQualifiedName.quoted(tableName, schemaName));
  }

  public async introspectTablePrimaryKeyConstraint(
    tableName: OptionallyQualifiedName,
  ): Promise<PrimaryKeyConstraint | null> {
    try {
      const table = await this.introspectTable(tableName.toString());
      return table.getPrimaryKeyConstraint();
    } catch (error) {
      if (error instanceof TableDoesNotExist) {
        return null;
      }

      throw error;
    }
  }

  public async introspectTableForeignKeyConstraints(
    tableName: OptionallyQualifiedName,
  ): Promise<ForeignKeyConstraint[]> {
    return this.listTableForeignKeys(tableName.toString());
  }

  public async introspectTableForeignKeyConstraintsByUnquotedName(
    tableName: string,
    schemaName: string | null = null,
  ): Promise<ForeignKeyConstraint[]> {
    return this.introspectTableForeignKeyConstraints(
      OptionallyQualifiedName.unquoted(tableName, schemaName),
    );
  }

  public async introspectTableForeignKeyConstraintsByQuotedName(
    tableName: string,
    schemaName: string | null = null,
  ): Promise<ForeignKeyConstraint[]> {
    return this.introspectTableForeignKeyConstraints(
      OptionallyQualifiedName.quoted(tableName, schemaName),
    );
  }

  public async introspectViews(): Promise<View[]> {
    return this.listViews();
  }

  public async introspectSequences(): Promise<Sequence[]> {
    return this.listSequences();
  }

  public async createSchema(): Promise<Schema> {
    const tables = await this.listTables();
    return new Schema(tables);
  }

  public async introspectSchema(): Promise<Schema> {
    return this.createSchema();
  }

  public async dropDatabase(database: string): Promise<void> {
    await this.executeStatement(this.platform.getDropDatabaseSQL(database));
  }

  public async dropSchema(schemaName: string): Promise<void> {
    await this.executeStatement(this.platform.getDropSchemaSQL(schemaName));
  }

  public async dropTable(name: string): Promise<void> {
    await this.executeStatement(this.platform.getDropTableSQL(name));
  }

  public async dropIndex(index: string, table: string): Promise<void> {
    await this.executeStatement(this.platform.getDropIndexSQL(index, table));
  }

  public async dropForeignKey(name: string, table: string): Promise<void> {
    await this.executeStatement(this.platform.getDropForeignKeySQL(name, table));
  }

  public async dropSequence(name: string): Promise<void> {
    await this.executeStatement(this.platform.getDropSequenceSQL(name));
  }

  public async dropUniqueConstraint(name: string, tableName: string): Promise<void> {
    await this.executeStatement(this.platform.getDropUniqueConstraintSQL(name, tableName));
  }

  public async dropView(name: string): Promise<void> {
    await this.executeStatement(this.platform.getDropViewSQL(name));
  }

  public async createSchemaObjects(schema: Schema): Promise<void> {
    await this.executeStatements(schema.toSql(this.platform));
  }

  public async createDatabase(database: string): Promise<void> {
    await this.executeStatement(this.platform.getCreateDatabaseSQL(database));
  }

  public async createTable(table: Table): Promise<void> {
    await this.executeStatements(this.platform.getCreateTableSQL(table));
  }

  public async createSequence(sequence: Sequence): Promise<void> {
    await this.executeStatement(this.platform.getCreateSequenceSQL(sequence));
  }

  public async createIndex(index: Index, table: string): Promise<void> {
    await this.executeStatement(this.platform.getCreateIndexSQL(index, table));
  }

  public async createForeignKey(foreignKey: ForeignKeyConstraint, table: string): Promise<void> {
    await this.executeStatement(this.platform.getCreateForeignKeySQL(foreignKey, table));
  }

  public async createUniqueConstraint(
    uniqueConstraint: UniqueConstraint,
    tableName: string,
  ): Promise<void> {
    await this.executeStatement(
      this.platform.getCreateUniqueConstraintSQL(uniqueConstraint, tableName),
    );
  }

  public async createView(view: View): Promise<void> {
    await this.executeStatement(this.platform.getCreateViewSQL(view.getName(), view.getSql()));
  }

  public async dropSchemaObjects(schema: Schema): Promise<void> {
    await this.executeStatements(schema.toDropSql(this.platform));
  }

  public async alterSchema(schemaDiff: SchemaDiff): Promise<void> {
    await this.executeStatements(this.platform.getAlterSchemaSQL(schemaDiff));
  }

  public async migrateSchema(newSchema: Schema): Promise<void> {
    const currentSchema = await this.introspectSchema();
    const comparator = this.createComparator();
    const diff = comparator.compareSchemas(currentSchema, newSchema);

    await this.alterSchema(diff);
  }

  public async alterTable(tableDiff: TableDiff): Promise<void> {
    await this.executeStatements(this.platform.getAlterTableSQL(tableDiff));
  }

  public async renameTable(name: string, newName: string): Promise<void> {
    await this.executeStatement(this.platform.getRenameTableSQL(name, newName));
  }

  public createSchemaConfig(): SchemaConfig {
    return new SchemaConfig();
  }

  public createComparator(config: ComparatorConfig = new ComparatorConfig()): Comparator {
    return new Comparator(this.platform, config);
  }

  public getConnection(): Connection {
    return this.connection;
  }

  public getDatabasePlatform(): AbstractPlatform {
    return this.platform;
  }

  protected async determineCurrentSchemaName(): Promise<string | null> {
    return null;
  }

  protected async getCurrentSchemaName(): Promise<string | null> {
    if (!this.platform.supportsSchemas()) {
      return null;
    }

    return this.determineCurrentSchemaName();
  }

  protected normalizeName(name: string): string {
    const normalized = normalizeName(name) ?? name;
    if (!normalized.includes(".")) {
      return stripPossiblyQuotedIdentifier(normalized);
    }

    return normalized;
  }

  protected async selectTableNames(_databaseName: string): Promise<Record<string, unknown>[]> {
    return this.connection.fetchAllAssociative<Record<string, unknown>>(
      this.getListTableNamesSQL(),
    );
  }

  protected async selectTableColumns(
    _databaseName: string,
    _tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return [];
  }

  protected async selectIndexColumns(
    _databaseName: string,
    _tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return [];
  }

  protected async selectForeignKeyColumns(
    _databaseName: string,
    _tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return [];
  }

  protected async fetchTableColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return this.selectTableColumns(databaseName, tableName);
  }

  protected async fetchIndexColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return this.selectIndexColumns(databaseName, tableName);
  }

  protected async fetchForeignKeyColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return this.selectForeignKeyColumns(databaseName, tableName);
  }

  protected async fetchTableColumnsByTable(
    databaseName: string,
  ): Promise<Record<string, Record<string, unknown>[]>> {
    return this.groupByTable(await this.fetchTableColumns(databaseName));
  }

  protected async fetchIndexColumnsByTable(
    databaseName: string,
  ): Promise<Record<string, Record<string, unknown>[]>> {
    return this.groupByTable(await this.fetchIndexColumns(databaseName));
  }

  protected async fetchForeignKeyColumnsByTable(
    databaseName: string,
  ): Promise<Record<string, Record<string, unknown>[]>> {
    return this.groupByTable(await this.fetchForeignKeyColumns(databaseName));
  }

  protected async fetchTableOptionsByTable(
    _databaseName: string,
    _tableName: string | null = null,
  ): Promise<Record<string, Record<string, unknown>>> {
    return {};
  }

  protected _getPortableDatabaseDefinition(database: Record<string, unknown>): string {
    return firstStringValue(database) ?? "";
  }

  protected _getPortableSequenceDefinition(sequence: Record<string, unknown>): Sequence {
    return new Sequence(firstStringValue(sequence) ?? "");
  }

  protected _getPortableTableColumnList(
    _table: string,
    _database: string,
    rows: Record<string, unknown>[],
  ): Column[] {
    const result: Column[] = [];

    for (const row of rows) {
      try {
        result.push(this._getPortableTableColumnDefinition(row));
      } catch {
        return [];
      }
    }

    return result;
  }

  protected _getPortableTableColumnDefinition(_tableColumn: Record<string, unknown>): Column {
    throw new Error(`${this.constructor.name}::_getPortableTableColumnDefinition() not supported`);
  }

  protected _getPortableTableIndexesList(
    rows: Record<string, unknown>[],
    _tableName: string,
  ): Index[] {
    const result = new Map<
      string,
      {
        name: string;
        columns: string[];
        unique: boolean;
        primary: boolean;
        flags: string[];
        options: { lengths: Array<number | null>; where?: string };
      }
    >();

    for (const row of rows) {
      const indexName =
        pickString(row, "key_name", "KEY_NAME", "index_name", "INDEX_NAME", "name") ?? "";
      if (indexName.length === 0) {
        continue;
      }

      const isPrimary = pickBoolean(row, "primary", "PRIMARY", "is_primary", "IS_PRIMARY");
      const keyName = (isPrimary ? "primary" : indexName).toLowerCase();

      let data = result.get(keyName);
      if (data === undefined) {
        const nonUnique = pickBoolean(row, "non_unique", "NON_UNIQUE", "is_unique", "IS_UNIQUE");
        const unique = nonUnique === null ? false : !nonUnique;
        const primary = isPrimary === true;
        const flags = normalizeIndexFlags(row.flags);
        const where = pickString(row, "where", "WHERE", "predicate", "PREDICATE");

        data = {
          columns: [],
          flags,
          name: indexName,
          options: where === null ? { lengths: [] } : { lengths: [], where },
          primary,
          unique: primary ? true : unique,
        };
        result.set(keyName, data);
      }

      const columnName = pickString(row, "column_name", "COLUMN_NAME", "attname", "ATTNAME");
      if (columnName !== null) {
        data.columns.push(columnName);
      }

      data.options.lengths.push(
        pickNumber(row, "length", "LENGTH", "sub_part", "SUB_PART", "column_length"),
      );
    }

    return [...result.values()].map(
      (data) =>
        new Index(data.name, data.columns, data.unique, data.primary, data.flags, data.options),
    );
  }

  protected _getPortableTableDefinition(table: Record<string, unknown>): string {
    return firstStringValue(table) ?? "";
  }

  protected _getPortableViewDefinition(view: Record<string, unknown>): View {
    return new View(firstStringValue(view) ?? "", "");
  }

  protected _getPortableTableForeignKeysList(
    rows: Record<string, unknown>[],
  ): ForeignKeyConstraint[] {
    return rows.map((row) => this._getPortableTableForeignKeyDefinition(row));
  }

  protected _getPortableTableForeignKeyDefinition(
    _tableForeignKey: Record<string, unknown>,
  ): ForeignKeyConstraint {
    throw new Error(
      `${this.constructor.name}::_getPortableTableForeignKeyDefinition() not supported`,
    );
  }

  protected getListDatabasesSQL(): string | null {
    return null;
  }

  protected getListSchemaNamesSQL(): string | null {
    return null;
  }

  protected getListSequencesSQL(): string | null {
    return null;
  }

  protected getListViewNamesSQL(): string | null {
    return null;
  }

  protected abstract getListTableNamesSQL(): string;

  private async fetchListedNames(sql: string | null): Promise<string[]> {
    if (sql === null) {
      return [];
    }

    const names = await this.connection.fetchFirstColumn<unknown>(sql);
    const filter = this.connection.getConfiguration().getSchemaAssetsFilter();

    return names
      .map((value) => normalizeName(value))
      .filter((value): value is string => value !== null)
      .filter((value) => filter(value));
  }

  private async executeStatements(sqlStatements: readonly string[]): Promise<void> {
    for (const sql of sqlStatements) {
      await this.executeStatement(sql);
    }
  }

  private async executeStatement(sql: string): Promise<void> {
    await this.connection.executeStatement(sql);
  }

  private getDatabase(_methodName: string): string {
    return this.connection.getDatabase() ?? "";
  }

  private groupByTable(rows: Record<string, unknown>[]): Record<string, Record<string, unknown>[]> {
    const grouped: Record<string, Record<string, unknown>[]> = {};

    for (const row of rows) {
      const key = this._getPortableTableDefinition(row);
      if (key.length === 0) {
        continue;
      }

      grouped[key] ??= [];
      grouped[key].push(row);
    }

    return grouped;
  }

  private async getTableOptions(name: string): Promise<Record<string, unknown>> {
    const normalizedName = this.normalizeName(name);
    const optionsByTable = await this.fetchTableOptionsByTable(
      this.getDatabase("getTableOptions"),
      normalizedName,
    );

    return optionsByTable[normalizedName] ?? {};
  }
}

function normalizeTableLookupName(name: string, supportsSchemas: boolean): string {
  const trimmed = name.trim();
  if (supportsSchemas) {
    return trimmed.toLowerCase();
  }

  return stripPossiblyQuotedIdentifier(trimmed).toLowerCase();
}

function stripPossiblyQuotedIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.length <= 1) {
    return trimmed;
  }

  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["`", "`"],
    ["[", "]"],
  ];

  for (const [start, end] of pairs) {
    if (trimmed.startsWith(start) && trimmed.endsWith(end)) {
      return unescapeWrappedIdentifier(trimmed.slice(1, -1), start, end);
    }
  }

  if (trimmed.startsWith('"') || trimmed.startsWith("`") || trimmed.startsWith("[")) {
    return trimmed.slice(1);
  }

  if (trimmed.endsWith('"') || trimmed.endsWith("`") || trimmed.endsWith("]")) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}

function unescapeWrappedIdentifier(identifier: string, start: string, end: string): string {
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

function normalizeName(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return null;
}

function toQualifiedTableName(tableName: string, schemaName: string | null): string {
  return schemaName === null ? tableName : `${schemaName}.${tableName}`;
}

function parseOptionallyQualifiedName(name: string): OptionallyQualifiedName {
  const parts = name.split(".");
  const unqualifiedName = parts.pop() ?? name;
  const qualifier = parts.length > 0 ? parts.join(".") : null;
  return OptionallyQualifiedName.unquoted(unqualifiedName, qualifier);
}

function firstStringValue(row: Record<string, unknown>): string | null {
  for (const value of Object.values(row)) {
    const normalized = normalizeName(value);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeName(row[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function pickNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
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

function pickBoolean(row: Record<string, unknown>, ...keys: string[]): boolean | null {
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

function normalizeIndexFlags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((flag) => String(flag));
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
}
