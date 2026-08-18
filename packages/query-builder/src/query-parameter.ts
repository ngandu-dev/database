import type { ArrayParameterType } from "./array-parameter-type";
import type { ParameterType } from "./parameter-type";

export type QueryParameterType = string | ParameterType | ArrayParameterType;
export type QueryParameters = unknown[] | Record<string, unknown>;
export type QueryParameterTypes = QueryParameterType[] | Record<string, QueryParameterType>;
