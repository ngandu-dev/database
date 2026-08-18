import { ArrayParameterType } from "./array-parameter-type";
import { ParameterType } from "./parameter-type";
import type { Type } from "./types/type";

export type QueryScalarParameterType = ParameterType | string | Type;
export type QueryParameterType = QueryScalarParameterType | ArrayParameterType;
export type QueryParameters = unknown[] | Record<string, unknown>;
export type QueryParameterTypes = QueryParameterType[] | Record<string, QueryParameterType>;

export class Query {
  constructor(
    public readonly sql: string,
    public readonly parameters: QueryParameters = [],
    public readonly types: QueryParameterTypes = [],
  ) {}

  public getSQL(): string {
    return this.sql;
  }

  public getParams(): QueryParameters {
    return this.parameters;
  }

  public getTypes(): QueryParameterTypes {
    return this.types;
  }
}
