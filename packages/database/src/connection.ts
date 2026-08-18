import { ArrayParameterType } from "./array-parameter-type";
import { Configuration } from "./configuration";
import { StaticServerVersionProvider } from "./connection/static-server-version-provider";
import type { Driver } from "./driver";
import { ParameterBindingStyle } from "./driver/_internal";
import type { ExceptionConverter } from "./driver/api/exception-converter";
import type { Connection as DriverConnection } from "./driver/connection";
import type { Statement as DriverStatement } from "./driver/statement";
import type { Exception } from "./exception";
import { isDatazenException } from "./exception/_internal";
import { CommitFailedRollbackOnly } from "./exception/commit-failed-rollback-only";
import { ConnectionException } from "./exception/connection-exception";
import { MissingPositionalParameterException } from "./exception/missing-positional-parameter-exception";
import { NoActiveTransaction } from "./exception/no-active-transaction";
import { SavepointsNotSupported } from "./exception/savepoints-not-supported";
import { ExpandArrayParameters } from "./expand-array-parameters";
import { ParameterType } from "./parameter-type";
import { AbstractPlatform } from "./platforms/abstract-platform";
import type {
  QueryParameterType,
  QueryParameterTypes,
  QueryParameters,
  QueryScalarParameterType,
} from "./query";
import { Query } from "./query";
import { ExpressionBuilder } from "./query/expression/expression-builder";
import { QueryBuilder } from "./query/query-builder";
import { Result } from "./result";
import type { AbstractSchemaManager } from "./schema/abstract-schema-manager";
import { DefaultSchemaManagerFactory } from "./schema/default-schema-manager-factory";
import type { SchemaManagerFactory } from "./schema/schema-manager-factory";
import type { ServerVersionProvider } from "./server-version-provider";
import { Parser } from "./sql/parser";
import type { SQLParser } from "./sql/parser/sql-parser";
import type { Visitor } from "./sql/parser/visitor";
import { Statement } from "./statement";
import { TransactionIsolationLevel } from "./transaction-isolation-level";
import { Type } from "./types/type";

type AssociativeRow = Record<string, unknown>;

interface CompiledPositionalQuery {
  sql: string;
  parameters: unknown[];
  types: QueryScalarParameterType[];
}

interface CompiledQuery {
  sql: string;
  parameters: Query["parameters"];
  types: Query["types"];
}

export class Connection {
  private autoCommit: boolean;
  private driverConnection: DriverConnection | null = null;
  private readonly driver: Driver;
  private transactionNestingLevel = 0;
  private rollbackOnly = false;
  private exceptionConverter: ExceptionConverter | null = null;
  private databasePlatform: AbstractPlatform | null = null;
  private databasePlatformPromise: Promise<AbstractPlatform> | null = null;
  private resolvingDatabasePlatform = false;
  private parser: SQLParser | null = null;
  private readonly schemaManagerFactory: SchemaManagerFactory;
  private nestTransactionsWithSavepoints = true;
  private transactionIsolationLevel: TransactionIsolationLevel | null = null;

  constructor(
    private readonly params: AssociativeRow,
    driver: Driver,
    private readonly configuration: Configuration = new Configuration(),
  ) {
    this.autoCommit = this.configuration.getAutoCommit();
    this.driver = this.wrapDriverWithMiddlewares(driver);
    this.schemaManagerFactory =
      this.configuration.getSchemaManagerFactory() ?? new DefaultSchemaManagerFactory();
  }

  public getParams(): AssociativeRow {
    return this.params;
  }

  public getDriver(): Driver {
    return this.driver;
  }

  public getDatabase(): string | null {
    const dbname = this.params.dbname;
    if (typeof dbname === "string") {
      return dbname;
    }

    const database = this.params.database;
    return typeof database === "string" ? database : null;
  }

  public getConfiguration(): Configuration {
    return this.configuration;
  }

  public isAutoCommit(): boolean {
    return this.autoCommit;
  }

  public async setAutoCommit(autoCommit: boolean): Promise<void> {
    if (autoCommit === this.autoCommit) {
      return;
    }

    this.autoCommit = autoCommit;

    if (this.driverConnection === null || this.transactionNestingLevel === 0) {
      return;
    }

    await this.commitAll();
  }

  public createExpressionBuilder(): ExpressionBuilder {
    return new ExpressionBuilder(this);
  }

  public createQueryBuilder(): QueryBuilder {
    return new QueryBuilder(this);
  }

  public isConnected(): boolean {
    return this.driverConnection !== null;
  }

  public isTransactionActive(): boolean {
    return this.transactionNestingLevel > 0;
  }

  public getTransactionNestingLevel(): number {
    return this.transactionNestingLevel;
  }

  public async getServerVersion(): Promise<string> {
    try {
      return (await this.connect()).getServerVersion();
    } catch (error) {
      throw this.convertException(error, "getServerVersion");
    }
  }

  public async prepare(sql: string): Promise<Statement> {
    try {
      const statement = await (await this.connect()).prepare(sql);
      return new Statement(this, statement, sql);
    } catch (error) {
      throw this.convertException(error, "prepare", new Query(sql));
    }
  }

  public async executeQuery(
    sql: string,
    params?: QueryParameters,
    types?: QueryParameterTypes,
  ): Promise<Result>;
  public async executeQuery<T extends AssociativeRow>(
    sql: string,
    params?: QueryParameters,
    types?: QueryParameterTypes,
  ): Promise<Result<T>>;
  public async executeQuery(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<Result> {
    await this.connect();
    const [boundParams, boundTypes] = this.normalizeParameters(params, types);
    const compiledQuery = this.compileQuery(sql, boundParams, boundTypes);
    const query = new Query(sql, params, types);

    try {
      const result = await this.executeDriverQuery(compiledQuery);
      return new Result(result, this);
    } catch (error) {
      throw this.convertException(error, "executeQuery", query);
    }
  }

  public async executeStatement(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<number> {
    await this.connect();
    const [boundParams, boundTypes] = this.normalizeParameters(params, types);
    const compiledQuery = this.compileQuery(sql, boundParams, boundTypes);
    const query = new Query(sql, params, types);

    try {
      return await this.executeDriverStatement(compiledQuery);
    } catch (error) {
      throw this.convertException(error, "executeStatement", query);
    }
  }

  public async fetchAssociative<T extends AssociativeRow = AssociativeRow>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<T | undefined> {
    return (await this.executeQuery<T>(sql, params, types)).fetchAssociative<T>();
  }

  public async fetchNumeric<T extends unknown[] = unknown[]>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<T | undefined> {
    return (await this.executeQuery(sql, params, types)).fetchNumeric<T>();
  }

  public async fetchOne<T = unknown>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<T | undefined> {
    return (await this.executeQuery(sql, params, types)).fetchOne<T>();
  }

  public async fetchAllAssociative<T extends AssociativeRow = AssociativeRow>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<T[]> {
    return (await this.executeQuery<T>(sql, params, types)).fetchAllAssociative<T>();
  }

  public async fetchAllNumeric<T extends unknown[] = unknown[]>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<T[]> {
    return (await this.executeQuery(sql, params, types)).fetchAllNumeric<T>();
  }

  public async fetchAllKeyValue<T = unknown>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<Record<string, T>> {
    return (await this.executeQuery(sql, params, types)).fetchAllKeyValue<T>();
  }

  public async fetchAllAssociativeIndexed<T extends AssociativeRow = AssociativeRow>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<Record<string, T>> {
    return (await this.executeQuery(sql, params, types)).fetchAllAssociativeIndexed<T>();
  }

  public async fetchFirstColumn<T = unknown>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<T[]> {
    return (await this.executeQuery(sql, params, types)).fetchFirstColumn<T>();
  }

  public async *iterateNumeric<T extends unknown[] = unknown[]>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): AsyncIterableIterator<T> {
    const result = await this.executeQuery(sql, params, types);
    yield* result.iterateNumeric<T>();
  }

  public async *iterateAssociative<T extends AssociativeRow = AssociativeRow>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): AsyncIterableIterator<T> {
    const result = await this.executeQuery<T>(sql, params, types);
    yield* result.iterateAssociative<T>();
  }

  public async *iterateKeyValue<T = unknown>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): AsyncIterableIterator<[string, T]> {
    const result = await this.executeQuery(sql, params, types);
    yield* result.iterateKeyValue<T>();
  }

  public async *iterateAssociativeIndexed<T extends AssociativeRow = AssociativeRow>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): AsyncIterableIterator<[string, T]> {
    const result = await this.executeQuery(sql, params, types);
    yield* result.iterateAssociativeIndexed<T>();
  }

  public async *iterateColumn<T = unknown>(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): AsyncIterableIterator<T> {
    const result = await this.executeQuery(sql, params, types);
    yield* result.iterateColumn<T>();
  }

  public async delete(
    table: string,
    criteria: AssociativeRow = {},
    types: QueryParameterTypes = [],
  ): Promise<number> {
    const [columns, values, conditions] = this.getCriteriaCondition(criteria);

    let sql = `DELETE FROM ${table}`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    const orderedTypes = this.extractTypeValues(columns, types);
    return this.executeStatement(sql, values, orderedTypes);
  }

  public async update(
    table: string,
    data: AssociativeRow,
    criteria: AssociativeRow = {},
    types: QueryParameterTypes = [],
  ): Promise<number> {
    const columns: string[] = [];
    const values: unknown[] = [];
    const set: string[] = [];

    for (const [columnName, value] of Object.entries(data)) {
      columns.push(columnName);
      values.push(value);
      set.push(`${columnName} = ?`);
    }

    const [criteriaColumns, criteriaValues, criteriaConditions] =
      this.getCriteriaCondition(criteria);
    columns.push(...criteriaColumns);
    values.push(...criteriaValues);

    let sql = `UPDATE ${table} SET ${set.join(", ")}`;
    if (criteriaConditions.length > 0) {
      sql += ` WHERE ${criteriaConditions.join(" AND ")}`;
    }

    const orderedTypes = this.extractTypeValues(columns, types);
    return this.executeStatement(sql, values, orderedTypes);
  }

  public async insert(
    table: string,
    data: AssociativeRow,
    types: QueryParameterTypes = [],
  ): Promise<number> {
    const columns = Object.keys(data);
    if (columns.length === 0) {
      return this.executeStatement(`INSERT INTO ${table} () VALUES ()`);
    }

    const values = columns.map((column) => data[column]);
    const placeholders = columns.map(() => "?");
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
    const orderedTypes = this.extractTypeValues(columns, types);

    return this.executeStatement(sql, values, orderedTypes);
  }

  public async beginTransaction(): Promise<void> {
    try {
      const connection = await this.connect();

      this.transactionNestingLevel += 1;

      if (this.transactionNestingLevel === 1) {
        await connection.beginTransaction();
        return;
      }

      await this.createSavepoint(
        this.getNestedTransactionSavePointName(this.transactionNestingLevel),
      );
    } catch (error) {
      throw this.convertException(error, "beginTransaction");
    }
  }

  public async createSavepoint(savepoint: string): Promise<void> {
    await this.connect();
    const platform = this.getDatabasePlatform();
    if (!platform.supportsSavepoints()) {
      throw SavepointsNotSupported.new({ driverName: this.getDriverName() });
    }

    await this.executeStatement(platform.createSavePoint(savepoint));
  }

  public async releaseSavepoint(savepoint: string): Promise<void> {
    await this.connect();
    const platform = this.getDatabasePlatform();
    if (!platform.supportsSavepoints()) {
      throw SavepointsNotSupported.new({ driverName: this.getDriverName() });
    }

    if (!platform.supportsReleaseSavepoints()) {
      return;
    }

    await this.executeStatement(platform.releaseSavePoint(savepoint));
  }

  public async rollbackSavepoint(savepoint: string): Promise<void> {
    await this.connect();
    const platform = this.getDatabasePlatform();
    if (!platform.supportsSavepoints()) {
      throw SavepointsNotSupported.new({ driverName: this.getDriverName() });
    }

    await this.executeStatement(platform.rollbackSavePoint(savepoint));
  }

  public async commit(): Promise<void> {
    if (this.transactionNestingLevel === 0) {
      throw NoActiveTransaction.new();
    }

    if (this.rollbackOnly) {
      throw CommitFailedRollbackOnly.new();
    }

    const connection = await this.connect();

    try {
      if (this.transactionNestingLevel === 1) {
        await connection.commit();
      } else {
        await this.releaseSavepoint(
          this.getNestedTransactionSavePointName(this.transactionNestingLevel),
        );
      }
    } catch (error) {
      throw this.convertException(error, "commit");
    } finally {
      await this.updateTransactionStateAfterCommit();
    }
  }

  public async rollBack(): Promise<void> {
    if (this.transactionNestingLevel === 0) {
      throw NoActiveTransaction.new();
    }

    try {
      const connection = await this.connect();
      if (this.transactionNestingLevel === 1) {
        this.transactionNestingLevel = 0;

        try {
          await connection.rollBack();
        } finally {
          this.rollbackOnly = false;

          if (!this.autoCommit) {
            await this.beginTransaction();
          }
        }

        return;
      }

      await this.rollbackSavepoint(
        this.getNestedTransactionSavePointName(this.transactionNestingLevel),
      );
      this.transactionNestingLevel -= 1;
    } catch (error) {
      throw this.convertException(error, "rollBack");
    }
  }

  public setRollbackOnly(): void {
    if (this.transactionNestingLevel === 0) {
      throw NoActiveTransaction.new();
    }

    this.rollbackOnly = true;
  }

  public isRollbackOnly(): boolean {
    if (this.transactionNestingLevel === 0) {
      throw NoActiveTransaction.new();
    }

    return this.rollbackOnly;
  }

  public async transactional<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    await this.beginTransaction();

    try {
      const result = await fn(this);
      await this.commit();
      return result;
    } catch (error) {
      if (this.isTransactionActive()) {
        try {
          await this.rollBack();
        } catch (rollbackError) {
          if (!(rollbackError instanceof NoActiveTransaction)) {
            throw rollbackError;
          }
        }
      }

      throw error;
    }
  }

  public async lastInsertId(): Promise<number | string | null> {
    try {
      return await (await this.connect()).lastInsertId();
    } catch (error) {
      throw this.convertException(error, "lastInsertId");
    }
  }

  public async quote(value: string): Promise<string> {
    try {
      const connection = await this.connect();

      if (connection.quote !== undefined) {
        return connection.quote(value);
      }

      return `'${value.replace(/'/g, "''")}'`;
    } catch (error) {
      throw this.convertException(error, "quote");
    }
  }

  public async close(): Promise<void> {
    if (this.driverConnection === null) {
      return;
    }

    try {
      const closableConnection = this.driverConnection as DriverConnection & {
        close?: () => Promise<void>;
      };

      if (closableConnection.close !== undefined) {
        await closableConnection.close();
      }
      this.resetConnectionState();
    } catch (error) {
      throw this.convertException(error, "close");
    }
  }

  public async getNativeConnection(): Promise<unknown> {
    try {
      return (await this.connect()).getNativeConnection();
    } catch (error) {
      throw this.convertException(error, "getNativeConnection");
    }
  }

  public async createSchemaManager(): Promise<AbstractSchemaManager> {
    await this.resolveDatabasePlatform();
    const schemaManager = this.schemaManagerFactory.createSchemaManager(this);
    await schemaManager.initialize();
    return schemaManager;
  }

  public async setTransactionIsolation(level: TransactionIsolationLevel): Promise<void> {
    await this.connect();
    await this.executeStatement(this.getDatabasePlatform().getSetTransactionIsolationSQL(level));
    this.transactionIsolationLevel = level;
  }

  public getTransactionIsolation(): TransactionIsolationLevel {
    return (
      this.transactionIsolationLevel ??
      this.getDatabasePlatform().getDefaultTransactionIsolationLevel()
    );
  }

  public quoteIdentifier(identifier: string): string {
    return this.getDatabasePlatform().quoteIdentifier(identifier);
  }

  public quoteSingleIdentifier(identifier: string): string {
    return this.getDatabasePlatform().quoteSingleIdentifier(identifier);
  }

  public setNestTransactionsWithSavepoints(flag: boolean): void {
    this.nestTransactionsWithSavepoints = flag;
  }

  public getNestTransactionsWithSavepoints(): boolean {
    return this.nestTransactionsWithSavepoints;
  }

  private getNestedTransactionSavePointName(level: number): string {
    return `DATAZEN_${level}`;
  }

  protected _getNestedTransactionSavePointName(level: number): string {
    return this.getNestedTransactionSavePointName(level);
  }

  private getCriteriaCondition(criteria: AssociativeRow): [string[], unknown[], string[]] {
    const columns: string[] = [];
    const values: unknown[] = [];
    const conditions: string[] = [];

    for (const [columnName, value] of Object.entries(criteria)) {
      if (value === null) {
        conditions.push(`${columnName} IS NULL`);
        continue;
      }

      columns.push(columnName);
      values.push(value);
      conditions.push(`${columnName} = ?`);
    }

    return [columns, values, conditions];
  }

  private extractTypeValues(columns: string[], types: QueryParameterTypes): QueryParameterTypes {
    if (Array.isArray(types)) {
      return types;
    }

    return columns.map((columnName) => types[columnName] ?? ParameterType.STRING);
  }

  private async updateTransactionStateAfterCommit(): Promise<void> {
    if (this.transactionNestingLevel !== 0) {
      this.transactionNestingLevel -= 1;
    }

    if (this.autoCommit || this.transactionNestingLevel !== 0) {
      return;
    }

    this.rollbackOnly = false;
    await this.beginTransaction();
  }

  private async commitAll(): Promise<void> {
    while (this.transactionNestingLevel !== 0) {
      if (!this.autoCommit && this.transactionNestingLevel === 1) {
        await this.commit();
        return;
      }

      await this.commit();
    }
  }

  private async executeDriverQuery(compiledQuery: CompiledQuery) {
    const connection = await this.connect();

    if (!this.hasBoundParameters(compiledQuery.parameters)) {
      return connection.query(compiledQuery.sql);
    }

    const statement = await connection.prepare(compiledQuery.sql);
    this.bindDriverParameters(statement, compiledQuery.parameters, compiledQuery.types);

    return statement.execute();
  }

  private async executeDriverStatement(compiledQuery: CompiledQuery): Promise<number> {
    const connection = await this.connect();

    if (!this.hasBoundParameters(compiledQuery.parameters)) {
      const affectedRows = await connection.exec(compiledQuery.sql);
      return typeof affectedRows === "number" ? affectedRows : Number(affectedRows);
    }

    const statement = await connection.prepare(compiledQuery.sql);
    this.bindDriverParameters(statement, compiledQuery.parameters, compiledQuery.types);

    const result = await statement.execute();

    try {
      const affectedRows = result.rowCount();
      return typeof affectedRows === "number" ? affectedRows : Number(affectedRows);
    } finally {
      result.free();
    }
  }

  private bindDriverParameters(
    statement: DriverStatement,
    parameters: Query["parameters"],
    types: Query["types"],
  ): void {
    if (Array.isArray(parameters) && Array.isArray(types)) {
      for (let index = 0; index < parameters.length; index += 1) {
        const type = (types[index] ?? ParameterType.STRING) as ParameterType;
        statement.bindValue(index + 1, this.normalizeBoundParameterValue(parameters[index]), type);
      }

      return;
    }

    if (!Array.isArray(parameters) && !Array.isArray(types)) {
      for (const [name, value] of Object.entries(parameters)) {
        statement.bindValue(
          name,
          this.normalizeBoundParameterValue(value),
          (types[name] ?? ParameterType.STRING) as ParameterType,
        );
      }

      return;
    }
  }

  private normalizeBoundParameterValue(value: unknown): unknown {
    return value === undefined ? null : value;
  }

  private hasBoundParameters(parameters: Query["parameters"]): boolean {
    if (Array.isArray(parameters)) {
      return parameters.length > 0;
    }

    return Object.keys(parameters).length > 0;
  }

  private compileQuery(
    sql: string,
    params: QueryParameters,
    types: QueryParameterTypes,
  ): CompiledQuery {
    const expanded = this.expandArrayParameters(sql, params, types);

    if (this.getDriverBindingStyle() === ParameterBindingStyle.POSITIONAL) {
      return expanded;
    }

    return this.convertPositionalToNamedBindings(expanded.sql, expanded.parameters, expanded.types);
  }

  private expandArrayParameters(
    sql: string,
    params: QueryParameters,
    types: QueryParameterTypes,
  ): CompiledPositionalQuery {
    const needsExpansion =
      !Array.isArray(params) ||
      (Array.isArray(types) && types.some((type) => this.isArrayParameterType(type)));

    if (!needsExpansion) {
      return {
        parameters: [...params],
        sql,
        types: this.normalizePositionalTypes(params, types),
      };
    }

    const visitor = new ExpandArrayParameters(params, types);
    this.getParser().parse(sql, visitor);

    return {
      parameters: visitor.getParameters(),
      sql: visitor.getSQL(),
      types: visitor.getTypes(),
    };
  }

  private convertPositionalToNamedBindings(
    sql: string,
    parameters: unknown[],
    types: QueryScalarParameterType[],
  ): CompiledQuery {
    const sqlParts: string[] = [];
    const namedParameters: AssociativeRow = {};
    const namedTypes: Record<string, QueryScalarParameterType> = {};
    let parameterIndex = 0;
    let bindCounter = 0;

    const visitor: Visitor = {
      acceptNamedParameter: (): void => {
        if (!Object.hasOwn(parameters, parameterIndex)) {
          throw new MissingPositionalParameterException(parameterIndex);
        }

        bindCounter += 1;
        const name = `p${bindCounter}`;
        sqlParts.push(`@${name}`);
        namedParameters[name] = parameters[parameterIndex];
        namedTypes[name] = types[parameterIndex] ?? ParameterType.STRING;
        parameterIndex += 1;
      },
      acceptOther: (fragment: string): void => {
        sqlParts.push(fragment);
      },
      acceptPositionalParameter: (): void => {
        if (!Object.hasOwn(parameters, parameterIndex)) {
          throw new MissingPositionalParameterException(parameterIndex);
        }

        bindCounter += 1;
        const name = `p${bindCounter}`;
        sqlParts.push(`@${name}`);
        namedParameters[name] = parameters[parameterIndex];
        namedTypes[name] = types[parameterIndex] ?? ParameterType.STRING;
        parameterIndex += 1;
      },
    };

    this.getParser().parse(sql, visitor);

    return {
      parameters: namedParameters,
      sql: sqlParts.join(""),
      types: namedTypes,
    };
  }

  private normalizePositionalTypes(
    params: unknown[],
    types: QueryParameterTypes,
  ): QueryScalarParameterType[] {
    if (!Array.isArray(types)) {
      return params.map(() => ParameterType.STRING);
    }

    return params.map((_, index) => {
      const type = types[index];
      if (type === undefined) {
        return ParameterType.STRING;
      }

      if (this.isArrayParameterType(type)) {
        return ArrayParameterType.toElementParameterType(type);
      }

      return type;
    });
  }

  private getParser(): SQLParser {
    this.parser ??= new Parser(true);
    return this.parser;
  }

  private getDriverBindingStyle(): ParameterBindingStyle {
    const bindingStyle = (this.driver as { bindingStyle?: unknown }).bindingStyle;

    if (bindingStyle === ParameterBindingStyle.NAMED) {
      return ParameterBindingStyle.NAMED;
    }

    return ParameterBindingStyle.POSITIONAL;
  }

  private getDriverName(): string {
    const explicitName = (this.driver as { name?: unknown }).name;
    if (typeof explicitName === "string" && explicitName.length > 0) {
      return explicitName;
    }

    const ctorName = (this.driver as { constructor?: { name?: unknown } }).constructor?.name;
    if (typeof ctorName === "string" && ctorName.length > 0) {
      return ctorName;
    }

    return "driver";
  }

  public convertToDatabaseValue(value: unknown, type: string): unknown {
    return Type.getType(type).convertToDatabaseValue(value, this.getDatabasePlatform());
  }

  public convertToNodeValue(value: unknown, type: string): unknown {
    return Type.getType(type).convertToNodeValue(value, this.getDatabasePlatform());
  }

  public convertToPHPValue(value: unknown, type: string): unknown {
    return this.convertToNodeValue(value, type);
  }

  public convertExceptionDuringQuery(
    error: unknown,
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Exception {
    return this.convertException(error, "query", new Query(sql, params, types));
  }

  public getDatabasePlatform(): AbstractPlatform {
    if (this.databasePlatform !== null) {
      return this.databasePlatform;
    }

    const customPlatform = this.params.platform;
    if (customPlatform instanceof AbstractPlatform) {
      this.databasePlatform = customPlatform;
      return this.databasePlatform;
    }

    const platform = this.driver.getDatabasePlatform(this.getDatabasePlatformVersionProvider());
    if (!this.isPromiseLike(platform)) {
      this.databasePlatform = platform;
      return this.databasePlatform;
    }

    if (this.databasePlatformPromise === null) {
      this.resolvingDatabasePlatform = true;
      this.databasePlatformPromise = platform
        .then((resolvedPlatform) => {
          this.databasePlatform = resolvedPlatform;
          return resolvedPlatform;
        })
        .finally(() => {
          this.databasePlatformPromise = null;
          this.resolvingDatabasePlatform = false;
        });
    }

    throw new Error(
      "Database platform is not resolved yet. Await connection.resolveDatabasePlatform() " +
        "or connection.connect() before calling getDatabasePlatform().",
    );
  }

  public async resolveDatabasePlatform(): Promise<AbstractPlatform> {
    if (this.databasePlatform !== null) {
      return this.databasePlatform;
    }

    const customPlatform = this.params.platform;
    if (customPlatform instanceof AbstractPlatform) {
      this.databasePlatform = customPlatform;
      return this.databasePlatform;
    }

    if (this.databasePlatformPromise !== null) {
      return this.databasePlatformPromise;
    }

    const versionProvider = this.getDatabasePlatformVersionProvider();
    this.resolvingDatabasePlatform = true;
    try {
      this.databasePlatformPromise = Promise.resolve(
        this.driver.getDatabasePlatform(versionProvider),
      )
        .then((platform) => {
          this.databasePlatform = platform;
          return platform;
        })
        .finally(() => {
          this.databasePlatformPromise = null;
          this.resolvingDatabasePlatform = false;
        });
    } catch (error) {
      this.resolvingDatabasePlatform = false;
      throw error;
    }

    return this.databasePlatformPromise;
  }

  public async connect(): Promise<DriverConnection> {
    if (this.driverConnection !== null) {
      return this.driverConnection;
    }

    try {
      this.driverConnection = await this.performConnect();
      if (!this.resolvingDatabasePlatform) {
        await this.resolveDatabasePlatform();
      }

      if (!this.autoCommit) {
        await this.beginTransaction();
      }

      return this.driverConnection;
    } catch (error) {
      throw this.convertException(error, "connect");
    }
  }

  protected async performConnect(_connectionName?: string): Promise<DriverConnection> {
    return this.driver.connect(this.params);
  }

  protected getWrappedDriverConnection(): DriverConnection | null {
    return this.driverConnection;
  }

  protected setWrappedDriverConnection(connection: DriverConnection | null): void {
    this.driverConnection = connection;
  }

  protected resetConnectionState(): void {
    this.driverConnection = null;
    this.transactionNestingLevel = 0;
    this.rollbackOnly = false;
    this.databasePlatformPromise = null;
    this.resolvingDatabasePlatform = false;
  }

  public convertException(error: unknown, operation: string, query?: Query): Exception {
    if (isDatazenException(error)) {
      return error;
    }

    this.exceptionConverter ??= this.driver.getExceptionConverter();
    const converted = this.exceptionConverter.convert(error, { operation, query });

    if (converted instanceof ConnectionException) {
      this.resetConnectionState();
    }

    return converted;
  }

  private getDatabasePlatformVersionProvider(): ServerVersionProvider {
    if (typeof this.params.serverVersion === "string") {
      return new StaticServerVersionProvider(this.params.serverVersion);
    }

    const primary = this.params.primary;
    if (primary !== null && typeof primary === "object") {
      const primaryServerVersion = (primary as Record<string, unknown>).serverVersion;
      if (typeof primaryServerVersion === "string") {
        return new StaticServerVersionProvider(primaryServerVersion);
      }
    }

    return this;
  }

  private isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
    return typeof value === "object" && value !== null && "then" in value;
  }

  private normalizeParameters(
    params: QueryParameters,
    types: QueryParameterTypes,
  ): [QueryParameters, QueryParameterTypes] {
    if (Array.isArray(params) && Array.isArray(types)) {
      const normalizedParams = [...params];
      const normalizedTypes = [...types];

      for (const key in normalizedParams) {
        const index = Number(key);
        if (!Object.hasOwn(normalizedTypes, index)) {
          continue;
        }

        const type = normalizedTypes[index];
        if (type === undefined) {
          continue;
        }

        const [value, bindingType] = this.getBindingInfo(normalizedParams[index], type);
        normalizedParams[index] = value;
        normalizedTypes[index] = bindingType;
      }

      return [normalizedParams, normalizedTypes];
    }

    if (!Array.isArray(params) && !Array.isArray(types)) {
      const normalizedParams: AssociativeRow = { ...params };
      const normalizedTypes: Record<string, QueryParameterType> = { ...types };

      for (const [name, value] of Object.entries(normalizedParams)) {
        const type = this.readNamedType(name, normalizedTypes);
        if (type === undefined) {
          continue;
        }

        const [convertedValue, bindingType] = this.getBindingInfo(value, type);
        normalizedParams[name] = convertedValue;
        normalizedTypes[name] = bindingType;
      }

      return [normalizedParams, normalizedTypes];
    }

    return [params, types];
  }

  private wrapDriverWithMiddlewares(driver: Driver): Driver {
    let wrappedDriver = driver;

    for (const middleware of this.configuration.getMiddlewares()) {
      wrappedDriver = middleware.wrap(wrappedDriver);
    }

    return wrappedDriver;
  }

  private getBindingInfo(
    value: unknown,
    type: QueryParameterType,
  ): [unknown, QueryScalarParameterType | ArrayParameterType] {
    if (this.isArrayParameterType(type) || this.isParameterType(type)) {
      return [value, type];
    }

    const datazenType = typeof type === "string" ? Type.getType(type) : type;
    const converted = datazenType.convertToDatabaseValue(value, this.getDatabasePlatform());

    return [converted, datazenType.getBindingType()];
  }

  private isArrayParameterType(type: QueryParameterType): type is ArrayParameterType {
    return (
      type === ArrayParameterType.INTEGER ||
      type === ArrayParameterType.STRING ||
      type === ArrayParameterType.ASCII ||
      type === ArrayParameterType.BINARY
    );
  }

  private isParameterType(value: unknown): value is ParameterType {
    return (
      value === ParameterType.NULL ||
      value === ParameterType.INTEGER ||
      value === ParameterType.STRING ||
      value === ParameterType.LARGE_OBJECT ||
      value === ParameterType.BOOLEAN ||
      value === ParameterType.BINARY ||
      value === ParameterType.ASCII
    );
  }

  private readNamedType(
    name: string,
    types: Record<string, QueryParameterType>,
  ): QueryParameterType | undefined {
    if (Object.hasOwn(types, name)) {
      return types[name];
    }

    if (name.startsWith(":")) {
      const plain = name.slice(1);
      if (Object.hasOwn(types, plain)) {
        return types[plain];
      }
    } else {
      const prefixed = `:${name}`;
      if (Object.hasOwn(types, prefixed)) {
        return types[prefixed];
      }
    }

    return undefined;
  }
}
