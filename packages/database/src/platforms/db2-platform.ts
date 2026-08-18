import type { Connection } from "../connection";
import { DB2SchemaManager } from "../schema/db2-schema-manager";
import { DefaultSelectSQLBuilder } from "../sql/builder/default-select-sql-builder";
import { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import { Db2MetadataProvider } from "./db2/db2-metadata-provider";
import { NotSupported } from "./exception/not-supported";
import { DB2Keywords } from "./keywords/db2-keywords";
import type { KeywordList } from "./keywords/keyword-list";

export class DB2Platform extends AbstractPlatform {
  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      bigint: Types.BIGINT,
      binary: Types.BINARY,
      blob: Types.BLOB,
      character: Types.STRING,
      clob: Types.TEXT,
      date: Types.DATE_MUTABLE,
      decimal: Types.DECIMAL,
      double: Types.FLOAT,
      integer: Types.INTEGER,
      real: Types.SMALLFLOAT,
      smallint: Types.SMALLINT,
      time: Types.TIME_MUTABLE,
      timestamp: Types.DATETIME_MUTABLE,
      varbinary: Types.BINARY,
      varchar: Types.STRING,
    };
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

  public getLengthExpression(string: string): string {
    return `LENGTH(${string}, CODEUNITS32)`;
  }

  protected getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    let mappedUnit = unit;
    let mappedInterval = interval;

    if (unit === DateIntervalUnit.WEEK) {
      mappedUnit = DateIntervalUnit.DAY;
      mappedInterval = this.multiplyInterval(interval, 7);
    } else if (unit === DateIntervalUnit.QUARTER) {
      mappedUnit = DateIntervalUnit.MONTH;
      mappedInterval = this.multiplyInterval(interval, 3);
    }

    return `${date} ${operator} ${mappedInterval} ${mappedUnit}`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DAYS(${date1}) - DAYS(${date2})`;
  }

  public getCurrentDateSQL(): string {
    return "CURRENT DATE";
  }

  public getCurrentTimeSQL(): string {
    return "CURRENT TIME";
  }

  public getCurrentTimestampSQL(): string {
    return "CURRENT TIMESTAMP";
  }

  public getCurrentDatabaseExpression(): string {
    return "CURRENT_USER";
  }

  public getSetTransactionIsolationSQL(_level: TransactionIsolationLevel): string {
    throw NotSupported.new("setTransactionIsolation");
  }

  public supportsIdentityColumns(): boolean {
    return true;
  }

  public supportsSavepoints(): boolean {
    return false;
  }

  protected createReservedKeywordsList(): KeywordList {
    return new DB2Keywords();
  }

  public createSchemaManager(connection: Connection): DB2SchemaManager {
    return new DB2SchemaManager(connection, this);
  }

  public override createMetadataProvider(connection: Connection): Db2MetadataProvider {
    return new Db2MetadataProvider(connection, this);
  }

  public getDummySelectSQL(expression = "1"): string {
    return `SELECT ${expression} FROM sysibm.sysdummy1`;
  }

  public getTruncateTableSQL(tableName: string, _cascade = false): string {
    return `TRUNCATE ${tableName} IMMEDIATE`;
  }

  public createSelectSQLBuilder(): SelectSQLBuilder {
    return new DefaultSelectSQLBuilder(this, "WITH RR USE AND KEEP UPDATE LOCKS", null);
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
}
