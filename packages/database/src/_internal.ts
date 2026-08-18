import { coerce, compare, valid } from "semver";

export const CASE_LOWER = 0;
export const CASE_UPPER = 1;

export type PortingArrayKey = string | number;

type ColumnKey = string | number | null;

export function is_int(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function is_string(value: unknown): value is string {
  return typeof value === "string";
}

export function is_boolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isset(value: unknown): boolean {
  return value !== undefined && value !== null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

export function strval(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (value === true) {
    return "1";
  }

  if (value === false) {
    return "";
  }

  return String(value);
}

export function empty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (value === false || value === 0 || value === "" || value === "0") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length === 0;
  }

  return false;
}

export const is_bool = is_boolean;

export function array_change_key_case<T>(
  input: Record<string, T>,
  caseMode: typeof CASE_LOWER | typeof CASE_UPPER = CASE_LOWER,
): Record<string, T> {
  const output: Record<string, T> = {};

  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = caseMode === CASE_LOWER ? key.toLowerCase() : key.toUpperCase();
    output[normalizedKey] = value;
  }

  return output;
}

export function key(value: unknown[] | Record<string, unknown>): PortingArrayKey | null {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return null;
  }

  const firstKey = keys[0];

  return firstKey === undefined ? null : toArrayKey(firstKey);
}

export function array_key_exists(keyValue: PortingArrayKey, value: unknown): boolean {
  if (value === null || (typeof value !== "object" && !Array.isArray(value))) {
    return false;
  }

  return Object.hasOwn(value, String(keyValue));
}

export function array_fill<T>(startIndex: number, count: number, value: T): T[] {
  if (!Number.isInteger(startIndex)) {
    throw new TypeError("array_fill(): startIndex must be an integer.");
  }

  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("array_fill(): count must be a non-negative integer.");
  }

  const output: T[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const index = startIndex + offset;
    (output as unknown as Record<string, T>)[String(index)] = value;
  }

  return output;
}

export function method_exists(value: unknown, methodName: string): boolean {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return false;
  }

  let current: object | null = value;

  while (current !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(current, methodName);

    if (descriptor !== undefined) {
      if ("value" in descriptor) {
        return typeof descriptor.value === "function";
      }

      return false;
    }

    current = Object.getPrototypeOf(current);
  }

  return false;
}

export function array_column<TColumn = unknown>(input: unknown[], columnKey: ColumnKey): TColumn[];
export function array_column<TColumn = unknown>(
  input: unknown[],
  columnKey: ColumnKey,
  indexKey: ColumnKey,
): Record<string, TColumn>;
export function array_column<TColumn = unknown>(
  input: unknown[],
  columnKey: ColumnKey,
  indexKey?: ColumnKey,
): TColumn[] | Record<string, TColumn> {
  if (indexKey === undefined) {
    const output: TColumn[] = [];

    for (const row of input) {
      const columnValue = columnKey === null ? row : readColumnValue(row, columnKey);

      if (columnValue === missingColumnValue) {
        continue;
      }

      output.push(columnValue as TColumn);
    }

    return output;
  }

  const output: Record<string, TColumn> = {};
  let fallbackIndex = 0;

  for (const row of input) {
    const columnValue = columnKey === null ? row : readColumnValue(row, columnKey);

    if (columnValue === missingColumnValue) {
      continue;
    }

    const rawIndex = indexKey === null ? missingColumnValue : readColumnValue(row, indexKey);
    const resolvedIndex =
      rawIndex === missingColumnValue ? String(fallbackIndex++) : String(rawIndex);

    output[resolvedIndex] = columnValue as TColumn;
  }

  return output;
}

export function assert(condition: unknown, message?: string | Error): asserts condition {
  if (condition) {
    return;
  }

  if (message instanceof Error) {
    throw message;
  }

  throw new Error(message ?? "Assertion failed");
}

export type VersionCompareOperator =
  | "<"
  | "lt"
  | "<="
  | "le"
  | ">"
  | "gt"
  | ">="
  | "ge"
  | "=="
  | "="
  | "eq"
  | "!="
  | "<>"
  | "ne";

export function version_compare(version1: string, version2: string): -1 | 0 | 1;
export function version_compare(
  version1: string,
  version2: string,
  operator: VersionCompareOperator,
): boolean;
export function version_compare(
  version1: string,
  version2: string,
  operator?: VersionCompareOperator,
): boolean | -1 | 0 | 1 {
  const comparison = comparePhpLikeVersions(version1, version2);

  if (operator === undefined) {
    return comparison;
  }

  switch (operator) {
    case "<":
    case "lt":
      return comparison < 0;
    case "<=":
    case "le":
      return comparison <= 0;
    case ">":
    case "gt":
      return comparison > 0;
    case ">=":
    case "ge":
      return comparison >= 0;
    case "==":
    case "=":
    case "eq":
      return comparison === 0;
    case "!=":
    case "<>":
    case "ne":
      return comparison !== 0;
  }
}

function toArrayKey(value: string): PortingArrayKey {
  if (/^(0|-?[1-9]\d*)$/.test(value)) {
    const parsed = Number(value);

    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  return value;
}

const missingColumnValue = Symbol("missingColumnValue");

function readColumnValue(row: unknown, columnKey: Exclude<ColumnKey, null>): unknown {
  if (Array.isArray(row)) {
    const normalizedKey =
      typeof columnKey === "number" ? columnKey : Number.parseInt(columnKey, 10);

    if (Number.isNaN(normalizedKey)) {
      return missingColumnValue;
    }

    return Object.hasOwn(row, normalizedKey) ? row[normalizedKey] : missingColumnValue;
  }

  if (row === null || typeof row !== "object") {
    return missingColumnValue;
  }

  const record = row as Record<string, unknown>;
  const keyName = String(columnKey);

  return Object.hasOwn(record, keyName) ? record[keyName] : missingColumnValue;
}

function comparePhpLikeVersions(left: string, right: string): -1 | 0 | 1 {
  const leftVersion = normalizePhpVersionToSemver(left);
  const rightVersion = normalizePhpVersionToSemver(right);
  const result = compare(leftVersion, rightVersion);

  if (result < 0) {
    return -1;
  }

  if (result > 0) {
    return 1;
  }

  return 0;
}

function normalizePhpVersionToSemver(input: string): string {
  const direct = valid(input);
  if (direct !== null) {
    return direct;
  }

  const base = coerce(input)?.version ?? "0.0.0";
  const baseMatch = input.match(/\d+(?:\.\d+){0,2}/);
  const suffix =
    baseMatch === null ? "" : input.slice(baseMatch.index! + baseMatch[0].length).trim();
  const suffixMatch = /^(?<label>dev|alpha|a|beta|b|rc|pl|p)\s*(?<n>\d+)?/i.exec(suffix);

  if (suffixMatch?.groups === undefined) {
    return base;
  }

  const label = (suffixMatch.groups.label ?? "").toLowerCase();
  const iteration = Number.parseInt(suffixMatch.groups.n ?? "1", 10);
  const [majorPart, minorPart, patchPart] = base.split(".");
  const major = Number.parseInt(majorPart ?? "0", 10);
  const minor = Number.parseInt(minorPart ?? "0", 10);
  const patch = Number.parseInt(patchPart ?? "0", 10);

  switch (label) {
    case "dev":
      return `${major}.${minor}.${patch}-0.dev.${iteration}`;
    case "alpha":
    case "a":
      return `${major}.${minor}.${patch}-1.alpha.${iteration}`;
    case "beta":
    case "b":
      return `${major}.${minor}.${patch}-2.beta.${iteration}`;
    case "rc":
      return `${major}.${minor}.${patch}-3.rc.${iteration}`;
    case "pl":
    case "p":
      return `${major}.${minor}.${patch + 1}-0.pl.${iteration}`;
  }

  return base;
}
