import type { CommonTableExpression } from "./query/common-table-expression";
import type { SelectQuery } from "./query/select-query";
import type { UnionQuery } from "./query/union-query";

export interface QueryBuilderPlatform {
  createSelectSQLBuilder(): { buildSQL(query: SelectQuery): string };
  createUnionSQLBuilder(): { buildSQL(query: UnionQuery): string };
  createWithSQLBuilder(): {
    buildSQL(
      firstExpression: CommonTableExpression,
      ...otherExpressions: CommonTableExpression[]
    ): string;
  };
}
