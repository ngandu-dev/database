import type { Result as DriverResult } from "../driver/result";
import { Converter } from "./converter";

type DriverResultWithColumnName = DriverResult & {
  getColumnName?: (index: number) => string;
};

export class Result implements DriverResult {
  constructor(
    private readonly result: DriverResult,
    private readonly converter: Converter,
  ) {}

  public fetchNumeric<T = unknown>(): T[] | undefined {
    const row = this.result.fetchNumeric<T>();
    if (row === undefined) {
      return undefined;
    }

    return row.map((value) => this.converter.convertValue(value)) as T[];
  }

  public fetchAssociative<T extends Record<string, unknown> = Record<string, unknown>>():
    | T
    | undefined {
    const row = this.result.fetchAssociative<Record<string, unknown>>();
    if (row === undefined) {
      return undefined;
    }

    return this.converter.convertRow(row) as T;
  }

  public fetchOne<T = unknown>(): T | undefined {
    const value = this.result.fetchOne<T>();
    if (value === undefined) {
      return undefined;
    }

    return this.converter.convertValue(value) as T;
  }

  public fetchAllNumeric<T = unknown>(): T[][] {
    return this.converter.convertAllNumeric(this.result.fetchAllNumeric<T>());
  }

  public fetchAllAssociative<T extends Record<string, unknown> = Record<string, unknown>>(): T[] {
    return this.converter.convertAllAssociative(this.result.fetchAllAssociative<T>());
  }

  public fetchFirstColumn<T = unknown>(): T[] {
    return this.converter.convertFirstColumn(this.result.fetchFirstColumn<T>());
  }

  public rowCount(): number | string {
    return this.result.rowCount();
  }

  public columnCount(): number {
    return this.result.columnCount();
  }

  public getColumnName(index: number): string {
    const resultWithColumnName = this.result as DriverResultWithColumnName;
    if (typeof resultWithColumnName.getColumnName !== "function") {
      throw new Error("The driver result does not support accessing the column name.");
    }

    return this.converter.convertColumnName(resultWithColumnName.getColumnName(index));
  }

  public free(): void {
    this.result.free();
  }
}
