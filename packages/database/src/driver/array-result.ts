import type { Result as DriverResult } from "./result";

type AssociativeRow = Record<string, unknown>;

type ResultWithColumnName = DriverResult & {
  getColumnName?: (index: number) => string;
};

export class ArrayResult implements DriverResult {
  private rows: AssociativeRow[];
  private cursor = 0;

  constructor(
    rows: AssociativeRow[],
    private readonly columns: string[] = [],
    private readonly affectedRowCount?: number | string,
  ) {
    this.rows = [...rows];
  }

  public fetchNumeric<T = unknown>(): T[] | undefined {
    const row = this.fetchAssociative();
    if (row === undefined) {
      return undefined;
    }

    return this.getColumnsFromRow(row).map((column) => row[column]) as T[];
  }

  public fetchAssociative<T extends AssociativeRow = AssociativeRow>(): T | undefined {
    const row = this.rows[this.cursor];
    if (row === undefined) {
      return undefined;
    }

    this.cursor += 1;
    return { ...row } as T;
  }

  public fetchOne<T = unknown>(): T | undefined {
    const row = this.fetchNumeric();
    if (row === undefined) {
      return undefined;
    }

    const value = row[0];
    return value as T | undefined;
  }

  public fetchAllNumeric<T = unknown>(): T[][] {
    const rows: T[][] = [];
    let row = this.fetchNumeric<T>();

    while (row !== undefined) {
      rows.push(row);
      row = this.fetchNumeric<T>();
    }

    return rows;
  }

  public fetchAllAssociative<T extends AssociativeRow = AssociativeRow>(): T[] {
    const rows: T[] = [];
    let row = this.fetchAssociative<T>();

    while (row !== undefined) {
      rows.push(row);
      row = this.fetchAssociative<T>();
    }

    return rows;
  }

  public fetchFirstColumn<T = unknown>(): T[] {
    const values: T[] = [];
    let value = this.fetchOne<T>();

    while (value !== undefined) {
      values.push(value);
      value = this.fetchOne<T>();
    }

    return values;
  }

  public rowCount(): number | string {
    return this.affectedRowCount ?? this.rows.length;
  }

  public columnCount(): number {
    const row = this.rows[0];
    if (row === undefined) {
      return this.columns.length;
    }

    return this.getColumnsFromRow(row).length;
  }

  public getColumnName(index: number): string {
    const row = this.rows[0];
    const columns = row === undefined ? this.columns : this.getColumnsFromRow(row);
    const name = columns[index];

    if (name === undefined) {
      throw new RangeError(`Column index ${index} is out of bounds.`);
    }

    return name;
  }

  public free(): void {
    this.rows = [];
    this.cursor = 0;
  }

  public static fromDriverResult(result: DriverResult): ArrayResult {
    const rows = result.fetchAllAssociative();
    const columns = ArrayResult.readColumns(result, rows[0]);
    const rowCount = result.rowCount();
    result.free();

    return new ArrayResult(rows, columns, rowCount);
  }

  private static readColumns(result: DriverResult, firstRow: AssociativeRow | undefined): string[] {
    const withColumnName = result as ResultWithColumnName;

    if (typeof withColumnName.getColumnName === "function") {
      const columns: string[] = [];
      const count = result.columnCount();
      for (let index = 0; index < count; index += 1) {
        columns.push(withColumnName.getColumnName(index));
      }

      return columns;
    }

    return firstRow === undefined ? [] : Object.keys(firstRow);
  }

  private getColumnsFromRow(row: AssociativeRow): string[] {
    return this.columns.length > 0 ? this.columns : Object.keys(row);
  }
}
