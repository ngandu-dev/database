export interface LimitSQLDialect {
  modifyLimitQuery(query: string, limit: number | null, offset?: number): string;
}

export interface UnionSQLDialect extends LimitSQLDialect {
  getUnionSelectPartSQL(subQuery: string): string;
  getUnionAllSQL(): string;
  getUnionDistinctSQL(): string;
}
