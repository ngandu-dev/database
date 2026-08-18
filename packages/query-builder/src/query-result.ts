type AssociativeRow = Record<string, unknown>;
type NumericRow = unknown[];

export interface QueryResult<TRow extends AssociativeRow = AssociativeRow> {
  fetchAssociative<T extends AssociativeRow = TRow>(): T | undefined;
  fetchNumeric<T extends NumericRow = NumericRow>(): T | undefined;
  fetchOne<T = unknown>(): T | undefined;
  fetchAllNumeric<T extends NumericRow = NumericRow>(): T[];
  fetchAllAssociative<T extends AssociativeRow = TRow>(): T[];
  fetchAllKeyValue<T = unknown>(): Record<string, T>;
  fetchAllAssociativeIndexed<T extends AssociativeRow = AssociativeRow>(): Record<string, T>;
  fetchFirstColumn<T = unknown>(): T[];
}
