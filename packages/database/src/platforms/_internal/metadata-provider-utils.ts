import { Column } from "../../schema/column";
import { MatchType } from "../../schema/foreign-key-constraint/match-type";
import { ReferentialAction } from "../../schema/foreign-key-constraint/referential-action";
import { IndexType } from "../../schema/index/index-type";
import { Types } from "../../types/types";
import type { AbstractPlatform } from "../abstract-platform";

export function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
  }

  return null;
}

export function pickNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function pickBoolean(row: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = row[key];
    const normalized = asBoolean(value);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

export function mapIndexType(row: Record<string, unknown>): IndexType {
  const explicitType = pickString(row, "index_type", "INDEX_TYPE", "type", "TYPE")?.toUpperCase();
  if (explicitType === "FULLTEXT") {
    return IndexType.FULLTEXT;
  }

  if (explicitType === "SPATIAL") {
    return IndexType.SPATIAL;
  }

  const unique = pickBoolean(row, "is_unique", "IS_UNIQUE");
  if (unique === true) {
    return IndexType.UNIQUE;
  }

  const nonUnique = pickBoolean(row, "non_unique", "NON_UNIQUE");
  if (nonUnique === false) {
    return IndexType.UNIQUE;
  }

  return IndexType.REGULAR;
}

export function mapReferentialAction(action: string | null): ReferentialAction {
  if (action === null) {
    return ReferentialAction.NO_ACTION;
  }

  const normalized = action.toUpperCase().replaceAll("_", " ");
  switch (normalized) {
    case ReferentialAction.CASCADE:
      return ReferentialAction.CASCADE;
    case ReferentialAction.SET_NULL:
      return ReferentialAction.SET_NULL;
    case ReferentialAction.SET_DEFAULT:
      return ReferentialAction.SET_DEFAULT;
    case ReferentialAction.RESTRICT:
      return ReferentialAction.RESTRICT;
    default:
      return ReferentialAction.NO_ACTION;
  }
}

export function mapMatchType(matchType: string | null): MatchType {
  if (matchType === null) {
    return MatchType.SIMPLE;
  }

  const normalized = matchType.toUpperCase();
  if (normalized === MatchType.FULL) {
    return MatchType.FULL;
  }

  if (normalized === MatchType.PARTIAL) {
    return MatchType.PARTIAL;
  }

  return MatchType.SIMPLE;
}

export function createColumnFromMetadataRow(
  platform: AbstractPlatform,
  row: Record<string, unknown>,
): Column {
  const columnName = pickString(row, "column_name", "COLUMN_NAME", "name", "NAME");
  if (columnName === null) {
    throw new Error("Missing column_name in metadata row.");
  }

  const rawDbType = pickString(
    row,
    "data_type",
    "DATA_TYPE",
    "type",
    "TYPE_NAME",
    "coltype",
    "COLTYPE",
  );
  const domainType = pickString(row, "domain_type", "DOMAIN_TYPE");
  let dbType = normalizeDbType(rawDbType);
  if (domainType !== null && dbType.length > 0 && !platform.hasDatazenTypeMappingFor(dbType)) {
    dbType = normalizeDbType(domainType);
  }

  const typeName = resolveTypeName(platform, dbType);

  const nullable = readNullable(row);
  const length = pickNumber(
    row,
    "character_maximum_length",
    "CHARACTER_MAXIMUM_LENGTH",
    "max_length",
    "MAX_LENGTH",
    "length",
    "LENGTH",
  );
  const precision = pickNumber(row, "numeric_precision", "NUMERIC_PRECISION", "precision");
  const scale = pickNumber(row, "numeric_scale", "NUMERIC_SCALE", "scale");
  const comment = pickString(
    row,
    "column_comment",
    "COLUMN_COMMENT",
    "comment",
    "REMARKS",
    "remarks",
  );
  const charset = pickString(row, "character_set_name", "CHARACTER_SET_NAME", "charset");
  const collation = pickString(row, "collation_name", "COLLATION_NAME", "collation");
  const defaultConstraintName = pickString(
    row,
    "default_constraint_name",
    "DEFAULT_CONSTRAINT_NAME",
  );
  const defaultValue = normalizeColumnDefaultForType(typeName, pickDefaultValue(platform, row));

  const options: Record<string, unknown> = {
    notnull: nullable === null ? true : !nullable,
  };

  if (defaultValue !== undefined) {
    options.default = defaultValue;
  }

  if (length !== null && typeName !== Types.ENUM) {
    options.length = length;
  }

  if (precision !== null) {
    options.precision = precision;
  }

  if (scale !== null) {
    options.scale = scale;
  }

  if (comment !== null) {
    options.comment = comment;
  }

  if (isUnsignedDbType(rawDbType)) {
    options.unsigned = true;
  }

  if (isFixedLengthType(dbType)) {
    options.fixed = true;
  }

  if (isAutoincrementRow(row)) {
    options.autoincrement = true;
  }

  if (typeName === Types.ENUM) {
    const enumValues = parseEnumColumnValues(pickString(row, "column_type", "COLUMN_TYPE"));
    if (enumValues !== null) {
      options.values = enumValues;
    }
  }

  const column = new Column(columnName, typeName, options);

  if (typeName === Types.JSON && dbType === "jsonb") {
    column.setPlatformOption("jsonb", true);
  }

  if (charset !== null) {
    column.setPlatformOption("charset", charset);
  }

  if (collation !== null) {
    column.setPlatformOption("collation", collation);
  }

  if (defaultConstraintName !== null) {
    column.setPlatformOption("default_constraint_name", defaultConstraintName);
  }

  return column;
}

function normalizeColumnDefaultForType(typeName: string, value: unknown): unknown {
  if (value === undefined || value === null || typeof value !== "string") {
    return value;
  }

  if (
    (typeName === Types.INTEGER || typeName === Types.SMALLINT || typeName === Types.BIGINT) &&
    /^-?\d+$/.test(value)
  ) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  if (typeName === Types.BOOLEAN) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true") {
      return true;
    }

    if (normalized === "0" || normalized === "false") {
      return false;
    }
  }

  return value;
}

export function buildTableOptions(row: Record<string, unknown>): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  const engine = pickString(row, "engine", "ENGINE");
  const charset = pickString(
    row,
    "table_charset",
    "TABLE_CHARSET",
    "character_set_name",
    "CHARACTER_SET_NAME",
  );
  const collation = pickString(row, "table_collation", "TABLE_COLLATION", "collation_name");
  const comment = pickString(row, "table_comment", "TABLE_COMMENT", "comment");
  const autoincrement = pickNumber(row, "auto_increment", "AUTO_INCREMENT");

  if (engine !== null) {
    options.engine = engine;
  }
  if (charset !== null) {
    options.charset = charset;
  }
  if (collation !== null) {
    options.collation = collation;
  }
  if (comment !== null) {
    options.comment = comment;
  }
  if (autoincrement !== null) {
    options.autoincrement = autoincrement;
  }

  return options;
}

function readNullable(row: Record<string, unknown>): boolean | null {
  const isNullable = pickString(row, "is_nullable", "IS_NULLABLE");
  if (isNullable !== null) {
    return isNullable.toUpperCase() === "YES";
  }

  const notNull = pickBoolean(row, "notnull", "NOTNULL", "is_not_null", "IS_NOT_NULL");
  if (notNull !== null) {
    return !notNull;
  }

  const nullable = pickBoolean(row, "nullable", "NULLABLE");
  if (nullable !== null) {
    return nullable;
  }

  return null;
}

function pickDefaultValue(platform: AbstractPlatform, row: Record<string, unknown>): unknown {
  for (const key of [
    "column_default",
    "COLUMN_DEFAULT",
    "default_value",
    "DEFAULT_VALUE",
    "dflt_value",
    "DFLT_VALUE",
  ]) {
    if (Object.hasOwn(row, key)) {
      return normalizeDefaultValue(platform, row[key], key);
    }
  }

  return undefined;
}

function normalizeDefaultValue(
  platform: AbstractPlatform,
  value: unknown,
  sourceKey: string,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const vendor = platform.constructor.name;
  const isMariaDb = vendor.includes("MariaDB");
  const isMySql = vendor.includes("MySQL");

  let normalized = value.trim();

  if (normalized === "") {
    return normalized;
  }

  const unwrapped = unwrapDefaultExpressionParentheses(normalized);
  if (unwrapped !== null) {
    normalized = unwrapped;
  }

  const castStripped = stripPostgreSqlCastSuffix(normalized);
  if (castStripped !== null) {
    normalized = castStripped;
  }

  const parsedSqlLiteral = parseSqlStringLiteral(normalized);
  if (parsedSqlLiteral !== undefined) {
    return isMariaDb ? decodeMySqlLikeMetadataEscapes(parsedSqlLiteral) : parsedSqlLiteral;
  }

  if (normalized.toUpperCase() === "NULL") {
    if (sourceKey === "dflt_value" || sourceKey === "DFLT_VALUE") {
      return null;
    }

    // MariaDB, PostgreSQL and SQL Server can expose SQL NULL as bare NULL in metadata.
    // MySQL returns literal "NULL" for string defaults unquoted in COLUMN_DEFAULT, so keep it.
    if (
      (isMariaDb || !isMySql) &&
      (sourceKey === "column_default" || sourceKey === "COLUMN_DEFAULT")
    ) {
      return null;
    }
  }

  // MariaDB may expose COLUMN_DEFAULT as an unquoted string with MySQL-style escapes
  // (varies across versions / sql_mode). Decode those escapes to align introspection with
  // the original column default value expected by Datazen/Doctrine tests.
  if (isMariaDb && (sourceKey === "column_default" || sourceKey === "COLUMN_DEFAULT")) {
    return decodeMySqlLikeMetadataEscapes(normalized);
  }

  return normalized;
}

function unwrapDefaultExpressionParentheses(value: string): string | null {
  let current = value;
  let changed = false;

  while (current.length >= 2 && current.startsWith("(") && current.endsWith(")")) {
    let depth = 0;
    let inString = false;
    let valid = true;

    for (let i = 0; i < current.length; i += 1) {
      const char = current[i];
      const next = current[i + 1];

      if (inString) {
        if (char === "'" && next === "'") {
          i += 1;
          continue;
        }

        if (char === "'") {
          inString = false;
        }

        continue;
      }

      if (char === "'") {
        inString = true;
        continue;
      }

      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth < 0) {
          valid = false;
          break;
        }

        if (depth === 0 && i !== current.length - 1) {
          valid = false;
          break;
        }
      }
    }

    if (!valid || depth !== 0 || inString) {
      break;
    }

    current = current.slice(1, -1).trim();
    changed = true;
  }

  return changed ? current : null;
}

function stripPostgreSqlCastSuffix(value: string): string | null {
  if (!value.includes("::")) {
    return null;
  }

  let inString = false;
  for (let i = 0; i < value.length - 1; i += 1) {
    const char = value[i];
    const next = value[i + 1];

    if (inString) {
      if (char === "'" && next === "'") {
        i += 1;
        continue;
      }

      if (char === "'") {
        inString = false;
      }

      continue;
    }

    if (char === "'") {
      inString = true;
      continue;
    }

    if (char === ":" && next === ":") {
      const lhs = value.slice(0, i).trim();
      const rhs = value.slice(i + 2).trim();
      if (lhs === "" || rhs === "") {
        return null;
      }

      return lhs;
    }
  }

  return null;
}

function parseSqlStringLiteral(value: string): string | undefined {
  let offset = 0;

  if ((value.startsWith("N'") || value.startsWith("n'")) && value.length >= 3) {
    offset = 1;
  } else if ((value.startsWith("E'") || value.startsWith("e'")) && value.length >= 3) {
    offset = 1;
  }

  if (value[offset] !== "'" || !value.endsWith("'")) {
    return undefined;
  }

  const body = value.slice(offset + 1, -1);
  const unquoted = body.replaceAll("''", "'");
  const isEscapeString = offset === 1 && (value[0] === "E" || value[0] === "e");

  return isEscapeString ? decodePgEscapeString(unquoted) : unquoted;
}

function decodePgEscapeString(value: string): string {
  let out = "";

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== "\\") {
      out += char;
      continue;
    }

    const next = value[i + 1];
    if (next === undefined) {
      out += "\\";
      continue;
    }

    i += 1;
    switch (next) {
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "\\":
        out += "\\";
        break;
      case "'":
        out += "'";
        break;
      default:
        out += next;
        break;
    }
  }

  return out;
}

function decodeMySqlLikeMetadataEscapes(value: string): string {
  if (!value.includes("\\")) {
    return value;
  }

  let out = "";

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== "\\") {
      out += char;
      continue;
    }

    const next = value[i + 1];
    if (next === undefined) {
      out += "\\";
      continue;
    }

    i += 1;
    switch (next) {
      case "0":
        out += "\0";
        break;
      case "b":
        out += "\b";
        break;
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "Z":
        out += "\x1a";
        break;
      case "\\":
        out += "\\";
        break;
      case "'":
        out += "'";
        break;
      case '"':
        out += '"';
        break;
      default:
        // Preserve the backslash for unknown sequences to avoid over-conversion.
        out += `\\${next}`;
        break;
    }
  }

  return out;
}

function normalizeDbType(dbType: string | null): string {
  if (dbType === null) {
    return "varchar";
  }

  return dbType
    .toLowerCase()
    .replace(/\(.*/, "")
    .replace(/\s+unsigned$/, "")
    .trim();
}

function resolveTypeName(platform: AbstractPlatform, dbType: string): string {
  try {
    if (platform.hasDatazenTypeMappingFor(dbType)) {
      return platform.getDatazenTypeMapping(dbType);
    }
  } catch {
    // fall through to heuristics below
  }

  if (dbType.includes("char")) {
    return Types.STRING;
  }
  if (dbType.includes("text") || dbType.includes("clob")) {
    return Types.TEXT;
  }
  if (dbType.includes("blob") || dbType.includes("binary")) {
    return Types.BLOB;
  }
  if (dbType.includes("int")) {
    return Types.INTEGER;
  }
  if (dbType.includes("bool")) {
    return Types.BOOLEAN;
  }
  if (dbType.includes("json")) {
    return Types.JSON;
  }
  if (dbType.includes("date") && dbType.includes("time")) {
    return Types.DATETIME_MUTABLE;
  }
  if (dbType === "date") {
    return Types.DATE_MUTABLE;
  }
  if (dbType === "time") {
    return Types.TIME_MUTABLE;
  }
  if (dbType.includes("real") || dbType.includes("float") || dbType.includes("double")) {
    return Types.FLOAT;
  }
  if (dbType.includes("dec") || dbType.includes("num")) {
    return Types.DECIMAL;
  }

  return Types.STRING;
}

function isUnsignedDbType(rawDbType: string | null): boolean {
  return typeof rawDbType === "string" && /\bunsigned\b/i.test(rawDbType);
}

function isFixedLengthType(dbType: string): boolean {
  return dbType === "char" || dbType === "nchar" || dbType === "character";
}

function isAutoincrementRow(row: Record<string, unknown>): boolean {
  const extra = pickString(row, "extra", "EXTRA");
  if (extra !== null && /auto_increment/i.test(extra)) {
    return true;
  }

  const isIdentity = pickBoolean(row, "is_identity", "IS_IDENTITY", "identity", "IDENTITY");
  if (isIdentity === true) {
    return true;
  }

  return false;
}

function parseEnumColumnValues(columnType: string | null): string[] | null {
  if (columnType === null) {
    return null;
  }

  const trimmed = columnType.trim();
  if (!/^enum\s*\(/i.test(trimmed) || !trimmed.endsWith(")")) {
    return null;
  }

  const body = trimmed.slice(trimmed.indexOf("(") + 1, -1);
  const values: string[] = [];
  let i = 0;

  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i]!)) {
      i += 1;
    }

    if (i >= body.length) {
      break;
    }

    const quote = body[i];
    if (quote !== "'" && quote !== '"') {
      return null;
    }

    i += 1;
    let value = "";

    while (i < body.length) {
      const char = body[i]!;
      const next = body[i + 1];

      if (char === "\\") {
        if (next !== undefined) {
          value += next;
          i += 2;
          continue;
        }

        value += "\\";
        i += 1;
        continue;
      }

      if (char === quote && next === quote) {
        value += quote;
        i += 2;
        continue;
      }

      if (char === quote) {
        i += 1;
        break;
      }

      value += char;
      i += 1;
    }

    values.push(value);

    while (i < body.length && /\s/.test(body[i]!)) {
      i += 1;
    }

    if (i < body.length) {
      if (body[i] !== ",") {
        return null;
      }
      i += 1;
    }
  }

  return values;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "t"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "f"].includes(normalized)) {
      return false;
    }
  }

  return null;
}
