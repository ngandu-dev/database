import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { expect } from "vitest";

import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { AbstractPlatform } from "../../../platforms/abstract-platform";
import { TransactionIsolationLevel } from "../../../transaction-isolation-level";

export class DummyPlatform extends AbstractPlatform {
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

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DATEDIFF(${date1}, ${date2})`;
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET TRANSACTION ISOLATION LEVEL ${level}`;
  }
}

export class DummyMySQLPlatform extends AbstractMySQLPlatform {}

export function assertCommonPlatformSurface(platform: AbstractPlatform): void {
  expect(platform.getDateFormatString()).toBeTypeOf("string");
  expect(platform.getDateTimeFormatString()).toBeTypeOf("string");
  expect(platform.getTimeFormatString()).toBeTypeOf("string");
  expect(platform.quoteIdentifier("users.id")).toContain(".");
}

export function assertMissingSourcePath(relativePath: string): void {
  expect(existsSync(resolve(process.cwd(), relativePath))).toBe(false);
}
