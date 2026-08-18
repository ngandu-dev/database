import type { Result as DriverResult } from "../result";

type ResultWithColumnName = DriverResult & {
  getColumnName?: (index: number) => string;
};

export abstract class AbstractResultMiddleware implements DriverResult {
  constructor(private readonly wrappedResult: DriverResult) {}

  public fetchNumeric<T = unknown>(): T[] | undefined {
    return this.wrappedResult.fetchNumeric<T>();
  }

  public fetchAssociative<T extends Record<string, unknown> = Record<string, unknown>>():
    | T
    | undefined {
    return this.wrappedResult.fetchAssociative<T>();
  }

  public fetchOne<T = unknown>(): T | undefined {
    return this.wrappedResult.fetchOne<T>();
  }

  public fetchAllNumeric<T = unknown>(): T[][] {
    return this.wrappedResult.fetchAllNumeric<T>();
  }

  public fetchAllAssociative<T extends Record<string, unknown> = Record<string, unknown>>(): T[] {
    return this.wrappedResult.fetchAllAssociative<T>();
  }

  public fetchFirstColumn<T = unknown>(): T[] {
    return this.wrappedResult.fetchFirstColumn<T>();
  }

  public rowCount(): number | string {
    return this.wrappedResult.rowCount();
  }

  public columnCount(): number {
    return this.wrappedResult.columnCount();
  }

  public getColumnName(index: number): string {
    const result = this.wrappedResult as ResultWithColumnName;
    if (typeof result.getColumnName !== "function") {
      throw new Error(`The driver result does not support accessing the column name.`);
    }

    return result.getColumnName(index);
  }

  public free(): void {
    this.wrappedResult.free();
  }
}
