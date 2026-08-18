import { InvalidParameterException } from "../../exception/invalid-parameter-exception";
import { Parser } from "../../sql/parser";
import type { Visitor } from "../../sql/parser/visitor";
import type { Connection as DriverConnection } from "../connection";
import { IdentityColumnsNotSupported } from "../exception/identity-columns-not-supported";
import type { Result as DriverResult } from "../result";
import type { Statement as DriverStatement } from "../statement";
import { Result as MSSQLResult } from "./result";
import { MSSQLStatement } from "./statement";
import type { MSSQLPoolLike, MSSQLRequestLike, MSSQLTransactionLike } from "./types";

type MSSQLTypedParameter = {
  typeHint: "varbinary" | "varchar";
  value: unknown;
  length?: number;
};

export class MSSQLConnection implements DriverConnection {
  private readonly parser = new Parser(false);
  private transaction: MSSQLTransactionLike | null = null;
  private serialQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly pool: MSSQLPoolLike,
    private readonly ownsClient: boolean,
  ) {}

  public async prepare(sql: string): Promise<DriverStatement> {
    return new MSSQLStatement(this, sql);
  }

  public async query(sql: string): Promise<DriverResult> {
    return this.runSerial(async () => {
      const request = this.createRequest();
      const payload = await request.query(sql);
      return this.toDriverResult(payload);
    });
  }

  public quote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  public async exec(sql: string): Promise<number | string> {
    return this.runSerial(async () => {
      const request = this.createRequest();
      const payload = await request.query(sql);
      return this.getRowsAffected(payload);
    });
  }

  public async lastInsertId(): Promise<number | string> {
    throw IdentityColumnsNotSupported.new();
  }

  public async beginTransaction(): Promise<void> {
    if (this.transaction !== null) {
      throw new Error("A transaction is already active on this connection.");
    }

    const transaction = this.pool.transaction();
    await transaction.begin();
    this.transaction = transaction;
  }

  public async commit(): Promise<void> {
    const transaction = this.transaction;
    if (transaction === null) {
      throw new Error("No active transaction to commit.");
    }

    await transaction.commit();
    this.transaction = null;
  }

  public async rollBack(): Promise<void> {
    const transaction = this.transaction;
    if (transaction === null) {
      throw new Error("No active transaction to roll back.");
    }

    await transaction.rollback();
    this.transaction = null;
  }

  public async getServerVersion(): Promise<string> {
    const result = await this.query("SELECT @@VERSION AS version");
    const version = result.fetchOne() ?? "unknown";
    result.free();

    return typeof version === "string" ? version : String(version);
  }

  public async close(): Promise<void> {
    if (this.transaction !== null) {
      await this.transaction.rollback();
      this.transaction = null;
    }

    if (this.ownsClient && this.pool.close !== undefined) {
      await this.pool.close();
    }
  }

  public getNativeConnection(): unknown {
    return this.pool;
  }

  public async executePrepared(
    sql: string,
    parameters: Record<string, unknown>,
  ): Promise<DriverResult> {
    return this.runSerial(async () => {
      const request = this.createRequest();
      const convertedSql = this.applyTypedParameterCasts(this.convertPlaceholders(sql), parameters);
      this.bindNamedParameters(request, parameters);
      const payload = await request.query(convertedSql);

      return this.toDriverResult(payload);
    });
  }

  private createRequest(): MSSQLRequestLike {
    if (this.transaction !== null) {
      return this.transaction.request();
    }

    return this.pool.request();
  }

  private bindNamedParameters(
    request: MSSQLRequestLike,
    parameters: Record<string, unknown>,
  ): void {
    for (const [name, value] of Object.entries(parameters)) {
      if (this.isTypedParameter(value)) {
        this.bindTypedParameter(request, name, value);
        continue;
      }

      request.input(name, value);
    }
  }

  private bindTypedParameter(
    request: MSSQLRequestLike,
    name: string,
    parameter: MSSQLTypedParameter,
  ): void {
    request.input(name, parameter.value);
  }

  private isTypedParameter(value: unknown): value is MSSQLTypedParameter {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "typeHint" in value &&
      "value" in value &&
      ((value as { typeHint?: unknown }).typeHint === "varbinary" ||
        (value as { typeHint?: unknown }).typeHint === "varchar")
    );
  }

  public toNamedParameters(parameters: unknown): Record<string, unknown> {
    if (parameters !== null && typeof parameters === "object" && !Array.isArray(parameters)) {
      return parameters as Record<string, unknown>;
    }

    throw new InvalidParameterException(
      "The mssql driver expects named parameters after SQL compilation.",
    );
  }

  private convertPlaceholders(sql: string): string {
    const parts: string[] = [];
    let position = 0;

    const visitor: Visitor = {
      acceptNamedParameter: (token: string): void => {
        const name = token.slice(1);
        parts.push(`@${name}`);
      },
      acceptOther: (fragment: string): void => {
        parts.push(fragment);
      },
      acceptPositionalParameter: (): void => {
        position += 1;
        parts.push(`@p${position}`);
      },
    };

    this.parser.parse(sql, visitor);

    return parts.join("");
  }

  private applyTypedParameterCasts(sql: string, parameters: Record<string, unknown>): string {
    let castedSql = sql;

    for (const [name, value] of Object.entries(parameters)) {
      if (!this.isTypedParameter(value)) {
        continue;
      }

      const replacement =
        value.typeHint === "varbinary"
          ? `CAST(@${name} AS VARBINARY(MAX))`
          : `CAST(@${name} AS VARCHAR(${value.length ?? "MAX"}))`;

      castedSql = castedSql.replaceAll(
        new RegExp(`@${this.escapeRegExp(name)}\\b`, "g"),
        replacement,
      );
    }

    return castedSql;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private toDriverResult(payload: unknown): DriverResult {
    const rows = this.toRows(payload);
    const firstRow = rows[0];
    const columns = this.toColumns(payload, firstRow);

    return new MSSQLResult(
      rows,
      columns,
      rows.length > 0 ? rows.length : this.getRowsAffected(payload),
    );
  }

  private toRows(payload: unknown): Array<Record<string, unknown>> {
    if (payload === null || typeof payload !== "object") {
      return [];
    }

    const columnTypeNames = this.readColumnTypeNames(payload);
    const recordset = (payload as { recordset?: unknown }).recordset;
    if (!Array.isArray(recordset)) {
      return [];
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const row of recordset) {
      if (row !== null && typeof row === "object" && !Array.isArray(row)) {
        rows.push(this.normalizeRowValues(row as Record<string, unknown>, columnTypeNames));
      }
    }

    return rows;
  }

  private toColumns(payload: unknown, firstRow: Record<string, unknown> | undefined): string[] {
    if (payload !== null && typeof payload === "object") {
      const recordset = (payload as { recordset?: unknown }).recordset;
      if (recordset !== null && typeof recordset === "object") {
        const columns = (recordset as { columns?: unknown }).columns;
        if (columns !== null && typeof columns === "object" && !Array.isArray(columns)) {
          const names = Object.keys(columns);
          if (names.length > 0) {
            return names;
          }
        }
      }
    }

    return firstRow === undefined ? [] : Object.keys(firstRow);
  }

  private getRowsAffected(payload: unknown): number {
    if (payload === null || typeof payload !== "object") {
      return 0;
    }

    const rowsAffected = (payload as { rowsAffected?: unknown }).rowsAffected;
    if (!Array.isArray(rowsAffected)) {
      return 0;
    }

    return rowsAffected.reduce((total, value) => {
      if (typeof value === "number") {
        return total + value;
      }

      return total;
    }, 0);
  }

  private readColumnTypeNames(payload: unknown): Record<string, string> {
    if (payload === null || typeof payload !== "object") {
      return {};
    }

    const recordset = (payload as { recordset?: unknown }).recordset;
    if (recordset === null || typeof recordset !== "object") {
      return {};
    }

    const columns = (recordset as { columns?: unknown }).columns;
    if (columns === null || typeof columns !== "object" || Array.isArray(columns)) {
      return {};
    }

    const typeNames: Record<string, string> = {};
    for (const [columnName, metadata] of Object.entries(columns)) {
      if (metadata === null || typeof metadata !== "object") {
        continue;
      }

      const type = (metadata as { type?: unknown }).type;
      const typeName =
        type !== null && (typeof type === "object" || typeof type === "function")
          ? (type as { name?: unknown }).name
          : undefined;

      if (typeof typeName === "string" && typeName.length > 0) {
        typeNames[columnName] = typeName;
      }
    }

    return typeNames;
  }

  private normalizeRowValues(
    row: Record<string, unknown>,
    columnTypeNames: Record<string, string>,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [columnName, value] of Object.entries(row)) {
      normalized[columnName] = this.normalizeColumnValue(value, columnTypeNames[columnName]);
    }

    return normalized;
  }

  private normalizeColumnValue(value: unknown, typeName: string | undefined): unknown {
    if (!(value instanceof Date) || typeof typeName !== "string") {
      return value;
    }

    switch (typeName) {
      case "Date":
        return this.formatUtcDate(value);
      case "Time":
        return this.formatUtcTime(value);
      case "DateTime":
      case "DateTime2":
      case "SmallDateTime":
        return this.formatUtcDateTime(value);
      case "DateTimeOffset":
        return `${this.formatUtcDateTime(value)} +00:00`;
      default:
        return value;
    }
  }

  private formatUtcDateTime(date: Date): string {
    return `${this.formatUtcDate(date)} ${this.formatUtcTime(date)}.${this.pad(date.getUTCMilliseconds() * 1000, 6)}`;
  }

  private formatUtcDate(date: Date): string {
    return `${this.pad(date.getUTCFullYear(), 4)}-${this.pad(date.getUTCMonth() + 1)}-${this.pad(date.getUTCDate())}`;
  }

  private formatUtcTime(date: Date): string {
    return `${this.pad(date.getUTCHours())}:${this.pad(date.getUTCMinutes())}:${this.pad(date.getUTCSeconds())}`;
  }

  private pad(value: number, width = 2): string {
    return String(value).padStart(width, "0");
  }

  private runSerial<T>(work: () => Promise<T>): Promise<T> {
    const current = this.serialQueue.then(work, work);
    this.serialQueue = current.then(
      () => undefined,
      () => undefined,
    );

    return current;
  }
}
