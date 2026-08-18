import { FetchUtils } from "../fetch-utils";
import type { Result as DriverResult } from "../result";

type AssociativeRow = Record<string, unknown>;

export class Result implements DriverResult {
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
    return FetchUtils.fetchOne<T>(this);
  }

  public fetchAllNumeric<T = unknown>(): T[][] {
    return FetchUtils.fetchAllNumeric<T>(this);
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
    return FetchUtils.fetchFirstColumn<T>(this);
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

  private getColumnsFromRow(row: AssociativeRow): string[] {
    return this.columns.length > 0 ? this.columns : Object.keys(row);
  }
}
