import { Result } from "./result";

export class FetchUtils {
  public static fetchOne<T = unknown>(result: Result): T | undefined {
    const row = result.fetchNumeric();
    if (row === undefined) {
      return undefined;
    }
    return row[0] as T;
  }

  public static fetchAllNumeric<T = unknown>(result: Result): T[][] {
    const rows: T[][] = [];

    let row = result.fetchNumeric<T>();
    while (row !== undefined) {
      rows.push(row as T[]);
      row = result.fetchNumeric<T>();
    }

    return rows;
  }

  public static fetchAllAssociative<T extends Record<string, unknown> = Record<string, unknown>>(
    result: Result,
  ): T[] {
    const rows: T[] = [];

    let row = result.fetchAssociative<T>();
    while (row !== undefined) {
      rows.push(row);
      row = result.fetchAssociative<T>();
    }

    return rows;
  }

  public static fetchFirstColumn<T = unknown>(result: Result): T[] {
    const rows: T[] = [];

    let value = result.fetchOne<T>();
    while (value !== undefined) {
      rows.push(value);
      value = result.fetchOne<T>();
    }

    return rows;
  }
}
