import { Types } from "../types/types";
import { AbstractSchemaManager } from "./abstract-schema-manager";
import { Column } from "./column";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { Sequence } from "./sequence";
import { View } from "./view";

export class PostgreSQLSchemaManager extends AbstractSchemaManager {
  public async listSchemaNames(): Promise<string[]> {
    const rows = await this.connection.fetchFirstColumn<unknown>(`
SELECT schema_name
FROM   information_schema.schemata
WHERE  schema_name NOT LIKE 'pg\\_%'
AND    schema_name != 'information_schema'
`);

    return rows
      .map((value) =>
        typeof value === "string" || typeof value === "number" ? String(value) : null,
      )
      .filter((value): value is string => value !== null);
  }

  protected getListTableNamesSQL(): string {
    return "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema() ORDER BY tablename";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT viewname FROM pg_catalog.pg_views WHERE schemaname = current_schema() ORDER BY viewname";
  }

  protected override async determineCurrentSchemaName(): Promise<string | null> {
    const currentSchema = await this.connection.fetchOne<unknown>("SELECT current_schema()");
    return typeof currentSchema === "string" && currentSchema.length > 0 ? currentSchema : null;
  }

  protected override async selectTableNames(
    databaseName: string,
  ): Promise<Record<string, unknown>[]> {
    const sql = `
SELECT quote_ident(table_name) AS table_name,
       table_schema AS schema_name,
       table_schema = current_schema() AS is_current_schema
FROM information_schema.tables
WHERE table_catalog = ?
  AND table_schema NOT LIKE 'pg\\_%'
  AND table_schema != 'information_schema'
  AND table_name != 'geometry_columns'
  AND table_name != 'spatial_ref_sys'
  AND table_type = 'BASE TABLE'
ORDER BY quote_ident(table_name)`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, [databaseName]);
  }

  protected override async selectTableColumns(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];
    const whereClause = this.buildQueryConditions(tableName, params).join(" AND ");
    const platformWithDefaultSql = this.platform as unknown as {
      getDefaultColumnValueSQLSnippet?: () => string;
    };
    const defaultValueSqlSnippet =
      typeof platformWithDefaultSql.getDefaultColumnValueSQLSnippet === "function"
        ? platformWithDefaultSql.getDefaultColumnValueSQLSnippet()
        : "NULL";
    const sql = `
SELECT quote_ident(n.nspname)               AS schema_name,
       quote_ident(c.relname)               AS table_name,
       n.nspname = current_schema()         AS is_current_schema,
       quote_ident(a.attname)               AS field,
       t.typname                            AS type,
       format_type(a.atttypid, a.atttypmod) AS complete_type,
       bt.typname                           AS domain_type,
       format_type(bt.oid, t.typtypmod)     AS domain_complete_type,
       a.attnotnull                         AS isnotnull,
       a.attidentity,
       (${defaultValueSqlSnippet}) AS "default",
       dsc.description                      AS comment,
       CASE
         WHEN coll.collprovider = 'c' THEN coll.collcollate
         WHEN coll.collprovider = 'd' THEN NULL
         ELSE coll.collname
       END AS collation
FROM pg_attribute a
JOIN pg_class c
  ON c.oid = a.attrelid
JOIN pg_namespace n
  ON n.oid = c.relnamespace
JOIN pg_type t
  ON t.oid = a.atttypid
LEFT JOIN pg_type bt
  ON t.typtype = 'd'
 AND bt.oid = t.typbasetype
LEFT JOIN pg_collation coll
  ON coll.oid = a.attcollation
LEFT JOIN pg_depend dep
  ON dep.objid = c.oid
 AND dep.deptype = 'e'
 AND dep.classid = (SELECT oid FROM pg_class WHERE relname = 'pg_class')
LEFT JOIN pg_description dsc
  ON dsc.objoid = c.oid AND dsc.objsubid = a.attnum
LEFT JOIN pg_inherits i
  ON i.inhrelid = c.oid
LEFT JOIN pg_class p
  ON i.inhparent = p.oid
 AND p.relkind = 'p'
WHERE ${whereClause}
  AND c.relkind IN ('r', 'p')
  AND a.attnum > 0
  AND dep.refobjid IS NULL
  AND p.oid IS NULL
ORDER BY n.nspname, c.relname, a.attnum`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async selectIndexColumns(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];
    const whereClause = this.buildQueryConditions(tableName, params).join(" AND ");
    const sql = `
SELECT quote_ident(n.nspname) AS schema_name,
       quote_ident(c.relname) AS table_name,
       n.nspname = current_schema() AS is_current_schema,
       quote_ident(ic.relname) AS relname,
       i.indisunique,
       i.indisprimary,
       pg_get_expr(indpred, indrelid) AS "where",
       quote_ident(attname) AS attname
FROM pg_index i
JOIN pg_class AS c
  ON c.oid = i.indrelid
JOIN pg_namespace n
  ON n.oid = c.relnamespace
JOIN pg_class AS ic
  ON ic.oid = i.indexrelid
JOIN LATERAL UNNEST(i.indkey) WITH ORDINALITY AS keys(attnum, ord)
  ON TRUE
JOIN pg_attribute a
  ON a.attrelid = c.oid
 AND a.attnum = keys.attnum
WHERE ${whereClause}
ORDER BY n.nspname, c.relname, keys.ord`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async selectForeignKeyColumns(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];
    const whereClause = this.buildQueryConditions(tableName, params).join(" AND ");
    const sql = `
SELECT quote_ident(tn.nspname) AS schema_name,
       quote_ident(tc.relname) AS table_name,
       tn.nspname = current_schema() AS is_current_schema,
       quote_ident(r.conname) AS conname,
       pg_get_constraintdef(r.oid, true) AS condef,
       r.condeferrable,
       r.condeferred
FROM pg_constraint r
JOIN pg_class AS tc
  ON tc.oid = r.conrelid
JOIN pg_namespace tn
  ON tn.oid = tc.relnamespace
WHERE r.conrelid IN (
  SELECT c.oid
  FROM pg_class c
  JOIN pg_namespace n
    ON n.oid = c.relnamespace
  WHERE ${whereClause}
)
  AND r.contype = 'f'
ORDER BY tn.nspname, tc.relname`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async fetchTableOptionsByTable(
    _databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, Record<string, unknown>>> {
    const params: unknown[] = [];
    const whereClause = this.buildQueryConditions(tableName, params).join(" AND ");
    const sql = `
SELECT quote_ident(n.nspname) AS schema_name,
       quote_ident(c.relname) AS table_name,
       n.nspname = current_schema() AS is_current_schema,
       CASE c.relpersistence WHEN 'u' THEN true ELSE false END AS unlogged,
       obj_description(c.oid, 'pg_class') AS comment
FROM pg_class c
JOIN pg_namespace n
  ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND ${whereClause}`;

    const rows = await this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
    const tableOptions: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      const table = this._getPortableTableDefinition(row);
      if (table.length === 0) {
        continue;
      }

      const options: Record<string, unknown> = {};
      if (readBoolean(row, "unlogged") === true) {
        options.unlogged = true;
      }

      const comment = readString(row, "comment");
      if (comment !== null) {
        options.comment = comment;
      }

      tableOptions[table] = options;
    }

    return tableOptions;
  }

  protected override _getPortableDatabaseDefinition(database: Record<string, unknown>): string {
    return readString(database, "datname") ?? "";
  }

  protected override _getPortableSequenceDefinition(sequence: Record<string, unknown>): Sequence {
    const schemaName = readString(sequence, "schemaname");
    const name = readString(sequence, "relname") ?? "";
    const sequenceName =
      schemaName !== null && schemaName !== "public" ? `${schemaName}.${name}` : name;

    return new Sequence(
      sequenceName,
      readNumber(sequence, "increment_by") ?? 1,
      readNumber(sequence, "min_value") ?? 1,
    );
  }

  protected override _getPortableTableColumnDefinition(
    tableColumn: Record<string, unknown>,
  ): Column {
    const dbTypeValue = readString(tableColumn, "type") ?? "";
    let dbType = dbTypeValue;

    const domainType = readString(tableColumn, "domain_type");
    let completeType = readString(tableColumn, "complete_type") ?? "";
    if (
      domainType !== null &&
      dbType.length > 0 &&
      !this.platform.hasDatazenTypeMappingFor(dbType)
    ) {
      dbType = domainType;
      completeType = readString(tableColumn, "domain_complete_type") ?? completeType;
    }

    const type = this.platform.getDatazenTypeMapping(dbType);

    let length: number | null = null;
    let precision: number | null = null;
    let scale = 0;
    let fixed = false;
    let jsonb = false;

    switch (dbType) {
      case "bpchar":
      case "varchar": {
        const [columnLength] = this.parseColumnTypeParameters(completeType);
        if (columnLength !== undefined) {
          length = columnLength;
        }

        break;
      }
      case "double":
      case "decimal":
      case "money":
      case "numeric": {
        const parameters = this.parseColumnTypeParameters(completeType);
        if (parameters[0] !== undefined) {
          precision = parameters[0];
        }

        if (parameters[1] !== undefined) {
          scale = parameters[1]!;
        }

        break;
      }
    }

    if (dbType === "bpchar") {
      fixed = true;
    } else if (dbType === "jsonb") {
      jsonb = true;
    }

    const options: Record<string, unknown> = {
      autoincrement: readString(tableColumn, "attidentity") === "d",
      fixed,
      length,
      notnull: readBoolean(tableColumn, "isnotnull") === true,
      precision,
      scale,
    };
    const defaultValue = this.parseDefaultExpression(readString(tableColumn, "default"));
    options.default = normalizeIntegerDefault(type, defaultValue);

    const comment = readString(tableColumn, "comment");
    if (comment !== null) {
      options.comment = comment;
    }

    const column = new Column(readString(tableColumn, "field") ?? "", type, options);
    const collation = readString(tableColumn, "collation");
    if (collation !== null && collation.length > 0) {
      column.setPlatformOption("collation", collation);
    }

    if (type === Types.JSON && jsonb) {
      column.setPlatformOption("jsonb", true);
    }

    return column;
  }

  protected override _getPortableTableDefinition(table: Record<string, unknown>): string {
    const tableName = readString(table, "table_name");
    if (tableName === null) {
      return "";
    }

    const schemaName = readString(table, "schema_name");
    if (schemaName === null || readBoolean(table, "is_current_schema") === true) {
      return tableName;
    }

    return `${schemaName}.${tableName}`;
  }

  protected override _getPortableTableForeignKeyDefinition(
    tableForeignKey: Record<string, unknown>,
  ): ForeignKeyConstraint {
    const condef = readString(tableForeignKey, "condef") ?? "";
    const onUpdate =
      /ON UPDATE ([a-zA-Z0-9]+(?: (?:NULL|ACTION|DEFAULT))?)/.exec(condef)?.[1] ?? null;
    const onDelete =
      /ON DELETE ([a-zA-Z0-9]+(?: (?:NULL|ACTION|DEFAULT))?)/.exec(condef)?.[1] ?? null;
    const values = /FOREIGN KEY \((.+)\) REFERENCES (.+)\((.+)\)/.exec(condef);
    if (values === null) {
      return new ForeignKeyConstraint([], "", [], readString(tableForeignKey, "conname"));
    }

    const localColumns = values[1]!.split(",").map((value) => value.trim());
    const foreignTable = values[2]!.trim();
    const foreignColumns = values[3]!.split(",").map((value) => value.trim());

    return new ForeignKeyConstraint(
      localColumns,
      foreignTable,
      foreignColumns,
      readString(tableForeignKey, "conname"),
      {
        deferrable: readBoolean(tableForeignKey, "condeferrable") === true,
        deferred: readBoolean(tableForeignKey, "condeferred") === true,
        onDelete,
        onUpdate,
      },
    );
  }

  protected override _getPortableTableIndexesList(
    rows: Record<string, unknown>[],
    tableName: string,
  ): Index[] {
    return super._getPortableTableIndexesList(
      rows.map((row) => ({
        column_name: readString(row, "attname"),
        key_name: readString(row, "relname"),
        non_unique: !(readBoolean(row, "indisunique") === true),
        primary: readBoolean(row, "indisprimary") === true,
        where: readString(row, "where"),
      })),
      tableName,
    );
  }

  protected override _getPortableViewDefinition(view: Record<string, unknown>): View {
    const schemaName = readString(view, "schemaname");
    const viewName = readString(view, "viewname") ?? "";
    return new View(
      schemaName === null ? viewName : `${schemaName}.${viewName}`,
      readString(view, "definition") ?? "",
    );
  }

  private parseColumnTypeParameters(type: string): number[] {
    const matches = /\((\d+)(?:,(\d+))?\)/.exec(type);
    if (matches === null) {
      return [];
    }

    const parameters = [Number.parseInt(matches[1]!, 10)];
    if (matches[2] !== undefined) {
      parameters.push(Number.parseInt(matches[2], 10));
    }

    return parameters.filter((value) => Number.isFinite(value));
  }

  private parseDefaultExpression(expression: string | null): unknown {
    if (expression === null || expression.startsWith("NULL::")) {
      return null;
    }

    if (expression === "true") {
      return true;
    }

    if (expression === "false") {
      return false;
    }

    const literal = /^'(.*)'::/s.exec(expression);
    if (literal !== null) {
      return literal[1]!.replaceAll("''", "'");
    }

    return expression;
  }

  private buildQueryConditions(tableName: string | null, params: unknown[]): string[] {
    const conditions: string[] = [];

    if (tableName !== null) {
      const parsed = parseSchemaQualifiedTableName(tableName);
      if (parsed.schemaName !== null) {
        conditions.push("n.nspname = ?");
        params.push(parsed.schemaName);
      } else {
        conditions.push("n.nspname = ANY(current_schemas(false))");
      }

      conditions.push("c.relname = ?");
      params.push(parsed.tableName);
    }

    conditions.push("n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')");
    return conditions;
  }
}

function readString(row: Record<string, unknown>, ...keys: string[]): string | null {
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

function readNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function readBoolean(row: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = row[key];

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
  }

  return null;
}

function parseSchemaQualifiedTableName(tableName: string): {
  schemaName: string | null;
  tableName: string;
} {
  const trimmed = tableName.trim();
  const dotIndex = findUnquotedDot(trimmed);
  if (dotIndex === -1) {
    return {
      schemaName: null,
      tableName: stripIdentifierQuotes(trimmed),
    };
  }

  return {
    schemaName: stripIdentifierQuotes(trimmed.slice(0, dotIndex)),
    tableName: stripIdentifierQuotes(trimmed.slice(dotIndex + 1)),
  };
}

function findUnquotedDot(value: string): number {
  let inDoubleQuotes = false;
  let inSquareBrackets = false;
  let inBackticks = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (inDoubleQuotes) {
      if (char === '"' && next === '"') {
        index += 1;
        continue;
      }

      if (char === '"') {
        inDoubleQuotes = false;
      }

      continue;
    }

    if (inSquareBrackets) {
      if (char === "]" && next === "]") {
        index += 1;
        continue;
      }

      if (char === "]") {
        inSquareBrackets = false;
      }

      continue;
    }

    if (inBackticks) {
      if (char === "`" && next === "`") {
        index += 1;
        continue;
      }

      if (char === "`") {
        inBackticks = false;
      }

      continue;
    }

    if (char === '"') {
      inDoubleQuotes = true;
      continue;
    }

    if (char === "[") {
      inSquareBrackets = true;
      continue;
    }

    if (char === "`") {
      inBackticks = true;
      continue;
    }

    if (char === ".") {
      return index;
    }
  }

  return -1;
}

function stripIdentifierQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('""', '"');
  }

  if (trimmed.length >= 2 && trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1).replaceAll("``", "`");
  }

  if (trimmed.length >= 2 && trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).replaceAll("]]", "]");
  }

  if (trimmed.startsWith('"') || trimmed.startsWith("`") || trimmed.startsWith("[")) {
    return trimmed.slice(1);
  }

  if (trimmed.endsWith('"') || trimmed.endsWith("`") || trimmed.endsWith("]")) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}

function normalizeIntegerDefault(typeName: string, defaultValue: unknown): unknown {
  if (
    ![Types.INTEGER, Types.SMALLINT, Types.BIGINT].includes(typeName) ||
    typeof defaultValue !== "string"
  ) {
    return defaultValue;
  }

  if (!/^-?\d+$/.test(defaultValue)) {
    return defaultValue;
  }

  const parsed = Number(defaultValue);
  if (!Number.isSafeInteger(parsed)) {
    return defaultValue;
  }

  return parsed;
}
