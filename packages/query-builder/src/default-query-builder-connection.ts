import { MySQLPlatform } from "./platforms/mysql-platform";
import { ExpressionBuilder } from "./query/expression/expression-builder";
import { QueryBuilder } from "./query/query-builder";
import type { QueryBuilderConnection } from "./query-builder-connection";
import type { QueryBuilderPlatform } from "./query-builder-platform";
import type { QueryParameters, QueryParameterTypes } from "./query-parameter";
import type { QueryResult } from "./query-result";

type AssociativeRow = Record<string, unknown>;

export class DefaultQueryBuilderConnection implements QueryBuilderConnection {
  public constructor(private readonly platform: QueryBuilderPlatform = new MySQLPlatform()) {}

  public createExpressionBuilder(): ExpressionBuilder {
    return new ExpressionBuilder(this);
  }

  public createQueryBuilder(): QueryBuilder {
    return new QueryBuilder(this);
  }

  public executeQuery<T extends AssociativeRow = AssociativeRow>(
    _sql: string,
    _params?: QueryParameters,
    _types?: QueryParameterTypes,
  ): Promise<QueryResult<T>> {
    throw new Error("This query builder is not attached to a database connection.");
  }

  public executeStatement(
    _sql: string,
    _params?: QueryParameters,
    _types?: QueryParameterTypes,
  ): Promise<number> {
    throw new Error("This query builder is not attached to a database connection.");
  }

  public getDatabasePlatform(): QueryBuilderPlatform {
    return this.platform;
  }

  public quote(value: string): Promise<string> {
    if (!("quoteStringLiteral" in this.platform)) {
      throw new Error("The configured query platform cannot quote string literals.");
    }

    const quoteStringLiteral = this.platform.quoteStringLiteral;
    if (typeof quoteStringLiteral !== "function") {
      throw new Error("The configured query platform cannot quote string literals.");
    }

    return Promise.resolve(quoteStringLiteral.call(this.platform, value));
  }
}
