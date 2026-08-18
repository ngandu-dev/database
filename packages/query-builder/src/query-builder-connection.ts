import type { ExpressionBuilder } from "./query/expression/expression-builder";
import type { QueryBuilder } from "./query/query-builder";
import type { QueryBuilderPlatform } from "./query-builder-platform";
import type { QueryParameters, QueryParameterTypes } from "./query-parameter";
import type { QueryResult } from "./query-result";

type AssociativeRow = Record<string, unknown>;

export interface QueryBuilderConnection {
  createExpressionBuilder(): ExpressionBuilder;
  createQueryBuilder(): QueryBuilder;
  executeQuery<T extends AssociativeRow = AssociativeRow>(
    sql: string,
    params?: QueryParameters,
    types?: QueryParameterTypes,
  ): Promise<QueryResult<T>>;
  executeStatement(
    sql: string,
    params?: QueryParameters,
    types?: QueryParameterTypes,
  ): Promise<number>;
  getDatabasePlatform(): QueryBuilderPlatform;
  quote(value: string): Promise<string>;
}
