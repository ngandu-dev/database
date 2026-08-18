import type { Connection } from "../connection";
import { OracleSchemaManager } from "../schema/oracle-schema-manager";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import type { KeywordList } from "./keywords/keyword-list";
import { OracleKeywords } from "./keywords/oracle-keywords";

export class OraclePlatform extends AbstractPlatform {
  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      binary_double: Types.FLOAT,
      binary_float: Types.FLOAT,
      binary_integer: Types.BOOLEAN,
      blob: Types.BLOB,
      char: Types.STRING,
      clob: Types.TEXT,
      date: Types.DATE_MUTABLE,
      float: Types.FLOAT,
      integer: Types.INTEGER,
      long: Types.STRING,
      "long raw": Types.BLOB,
      nchar: Types.STRING,
      nclob: Types.TEXT,
      number: Types.INTEGER,
      nvarchar2: Types.STRING,
      pls_integer: Types.BOOLEAN,
      raw: Types.BINARY,
      real: Types.SMALLFLOAT,
      rowid: Types.STRING,
      timestamp: Types.DATETIME_MUTABLE,
      timestamptz: Types.DATETIMETZ_MUTABLE,
      urowid: Types.STRING,
      varchar: Types.STRING,
      varchar2: Types.STRING,
    };
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

  public getLocateExpression(
    string: string,
    substring: string,
    start: string | null = null,
  ): string {
    if (start === null) {
      return `INSTR(${string}, ${substring})`;
    }

    return `INSTR(${string}, ${substring}, ${start})`;
  }

  protected getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    if (
      unit === DateIntervalUnit.MONTH ||
      unit === DateIntervalUnit.QUARTER ||
      unit === DateIntervalUnit.YEAR
    ) {
      let value = interval;
      if (unit === DateIntervalUnit.QUARTER) {
        value = this.multiplyInterval(interval, 3);
      } else if (unit === DateIntervalUnit.YEAR) {
        value = this.multiplyInterval(interval, 12);
      }

      return `ADD_MONTHS(${date}, ${operator}${value})`;
    }

    let calculation = "";
    if (unit === DateIntervalUnit.SECOND) {
      calculation = "/24/60/60";
    } else if (unit === DateIntervalUnit.MINUTE) {
      calculation = "/24/60";
    } else if (unit === DateIntervalUnit.HOUR) {
      calculation = "/24";
    } else if (unit === DateIntervalUnit.WEEK) {
      calculation = "*7";
    }

    return `(${date}${operator}${interval}${calculation})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `TRUNC(${date1}) - TRUNC(${date2})`;
  }

  public getCurrentDatabaseExpression(): string {
    return "SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')";
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET TRANSACTION ISOLATION LEVEL ${this.getOracleIsolationLevelSQL(level)}`;
  }

  public supportsSequences(): boolean {
    return true;
  }

  public supportsReleaseSavepoints(): boolean {
    return false;
  }

  protected createReservedKeywordsList(): KeywordList {
    return new OracleKeywords();
  }

  public createSchemaManager(connection: Connection): OracleSchemaManager {
    return new OracleSchemaManager(connection, this);
  }

  public releaseSavePoint(_savepoint: string): string {
    return "";
  }

  protected doModifyLimitQuery(query: string, limit: number | null, offset: number): string {
    if (offset > 0) {
      query += ` OFFSET ${offset} ROWS`;
    }

    if (limit !== null) {
      query += ` FETCH NEXT ${limit} ROWS ONLY`;
    }

    return query;
  }

  public getDummySelectSQL(expression = "1"): string {
    return `SELECT ${expression} FROM DUAL`;
  }

  public getTruncateTableSQL(tableName: string, _cascade = false): string {
    return `TRUNCATE TABLE ${tableName}`;
  }

  public getDateTimeTzFormatString(): string {
    return "Y-m-d H:i:sP";
  }

  public getDateFormatString(): string {
    return "Y-m-d 00:00:00";
  }

  public getTimeFormatString(): string {
    return "1900-01-01 H:i:s";
  }

  public getMaxIdentifierLength(): number {
    return 128;
  }

  public getDropAutoincrementSql(table: string): string[] {
    return [this.getDropSequenceSQL(this.getAutoincrementIdentifierName(table))];
  }

  protected getCreateAutoincrementSql(_name: string, table: string, start: number = 1): string[] {
    return [`CREATE SEQUENCE ${this.getAutoincrementIdentifierName(table)} START WITH ${start}`];
  }

  protected getIdentitySequenceName(tableName: string): string {
    return this.addSuffix(this.normalizeIdentifier(tableName), "_SEQ");
  }

  private getOracleIsolationLevelSQL(level: TransactionIsolationLevel): string {
    if (level === TransactionIsolationLevel.REPEATABLE_READ) {
      return "SERIALIZABLE";
    }

    return this.getTransactionIsolationLevelSQL(level);
  }

  private normalizeIdentifier(name: string): string {
    const unquoted = name.replace(/^"+|"+$/g, "");
    return unquoted.replace(/\./g, "_").toUpperCase();
  }

  private addSuffix(identifier: string, suffix: string): string {
    const normalized = identifier.endsWith(suffix) ? identifier : `${identifier}${suffix}`;
    const maxLength = this.getMaxIdentifierLength();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    const prefixLength = Math.max(1, maxLength - suffix.length);
    return `${identifier.slice(0, prefixLength)}${suffix}`;
  }

  private getAutoincrementIdentifierName(table: string): string {
    return this.getIdentitySequenceName(table);
  }
}
