type AssociativeRow = Record<string, unknown>;

export interface Result {
  fetchNumeric<T = unknown>(): T[] | undefined;
  fetchAssociative<T extends AssociativeRow = AssociativeRow>(): T | undefined;
  fetchOne<T = unknown>(): T | undefined;
  fetchAllNumeric<T = unknown>(): T[][];
  fetchAllAssociative<T extends AssociativeRow = AssociativeRow>(): T[];
  fetchFirstColumn<T = unknown>(): T[];
  rowCount(): number | string;
  columnCount(): number;
  free(): void;
}
