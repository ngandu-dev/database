import type { Connection } from "./connection";
import type { Result as DriverResult } from "./driver/result";
import { InvalidColumnIndex } from "./exception/invalid-column-index";
import { NoKeyValue } from "./exception/no-key-value";

type AssociativeRow = Record<string, unknown>;
type NumericRow = unknown[];

type DriverResultWithColumnName = DriverResult & {
  getColumnName?: (index: number) => string;
};

export class Result<TRow extends AssociativeRow = AssociativeRow> {
  constructor(
    private readonly result: DriverResult,
    private readonly connection: Connection,
  ) {}

  public fetchNumeric<T extends NumericRow = NumericRow>(): T | undefined {
    return this.convertDriverException(
      "fetchNumeric",
      () => this.result.fetchNumeric<unknown>() as T | undefined,
    );
  }

  public fetchAssociative<T extends AssociativeRow = TRow>(): T | undefined {
    return this.convertDriverException("fetchAssociative", () => this.result.fetchAssociative<T>());
  }

  public fetchOne<T = unknown>(): T | undefined {
    return this.convertDriverException("fetchOne", () => this.result.fetchOne<T>());
  }

  public fetchAllNumeric<T extends NumericRow = NumericRow>(): T[] {
    return this.convertDriverException(
      "fetchAllNumeric",
      () => this.result.fetchAllNumeric<unknown>() as T[],
    );
  }

  public fetchAllAssociative<T extends AssociativeRow = TRow>(): T[] {
    return this.convertDriverException("fetchAllAssociative", () =>
      this.result.fetchAllAssociative<T>(),
    );
  }

  public fetchAllKeyValue<T = unknown>(): Record<string, T> {
    this.ensureHasKeyValue();

    const rows = this.fetchAllNumeric();
    const data: Record<string, T> = {};

    for (const row of rows) {
      const key = row[0];
      if (key === undefined) {
        continue;
      }

      data[String(key)] = row[1] as T;
    }

    return data;
  }

  public fetchAllAssociativeIndexed<T extends AssociativeRow = AssociativeRow>(): Record<
    string,
    T
  > {
    const rows = this.fetchAllAssociative<AssociativeRow>();
    const indexed: Record<string, T> = {};

    for (const row of rows) {
      const keyColumn = this.getColumnName(0);
      const key = row[keyColumn];
      const clone = { ...row };
      delete clone[keyColumn];
      indexed[String(key)] = clone as T;
    }

    return indexed;
  }

  public fetchFirstColumn<T = unknown>(): T[] {
    return this.convertDriverException("fetchFirstColumn", () => this.result.fetchFirstColumn<T>());
  }

  public *iterateNumeric<T extends NumericRow = NumericRow>(): IterableIterator<T> {
    try {
      let row = this.fetchNumeric<T>();
      while (row !== undefined) {
        yield row;
        row = this.fetchNumeric<T>();
      }
    } finally {
      this.free();
    }
  }

  public *iterateAssociative<T extends AssociativeRow = TRow>(): IterableIterator<T> {
    try {
      let row = this.fetchAssociative<T>();
      while (row !== undefined) {
        yield row;
        row = this.fetchAssociative<T>();
      }
    } finally {
      this.free();
    }
  }

  public *iterateKeyValue<T = unknown>(): IterableIterator<[string, T]> {
    this.ensureHasKeyValue();

    try {
      for (const row of this.iterateNumeric()) {
        const key = row[0];
        if (key === undefined) {
          continue;
        }

        yield [String(key), row[1] as T];
      }
    } finally {
      this.free();
    }
  }

  public *iterateAssociativeIndexed<T extends AssociativeRow = AssociativeRow>(): IterableIterator<
    [string, T]
  > {
    try {
      for (const row of this.iterateAssociative<AssociativeRow>()) {
        const keyColumn = this.getColumnName(0);
        const key = row[keyColumn];
        const clone = { ...row };
        delete clone[keyColumn];
        yield [String(key), clone as T];
      }
    } finally {
      this.free();
    }
  }

  public *iterateColumn<T = unknown>(): IterableIterator<T> {
    try {
      for (const value of this.iterateNumeric()) {
        const first = value[0];
        if (first !== undefined) {
          yield first as T;
        }
      }
    } finally {
      this.free();
    }
  }

  public rowCount(): number | string {
    return this.convertDriverException("rowCount", () => this.result.rowCount());
  }

  public columnCount(): number {
    return this.convertDriverException("columnCount", () => this.result.columnCount());
  }

  public getColumnName(index: number): string {
    const withColumnName = this.result as DriverResultWithColumnName;

    if (typeof withColumnName.getColumnName === "function") {
      try {
        return withColumnName.getColumnName(index);
      } catch (error) {
        if (error instanceof RangeError) {
          throw InvalidColumnIndex.new(index, error);
        }

        throw this.connection.convertException(error, "getColumnName");
      }
    }

    throw new Error("The driver result does not support accessing the column name.");
  }

  public free(): void {
    this.result.free();
  }

  private ensureHasKeyValue(): void {
    const columnCount = this.columnCount();

    if (columnCount < 2) {
      throw NoKeyValue.fromColumnCount(columnCount);
    }
  }

  private convertDriverException<T>(operation: string, callback: () => T): T {
    try {
      return callback();
    } catch (error) {
      throw this.connection.convertException(error, operation);
    }
  }
}
