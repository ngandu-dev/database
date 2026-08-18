import { AbstractMySQLPlatform } from "../platforms/abstract-mysql-platform";
import { Comparator as MySQLComparator } from "../platforms/mysql/comparator";
import { DefaultTableOptions } from "../platforms/mysql/default-table-options";
import { AbstractSchemaManager } from "./abstract-schema-manager";
import { Column } from "./column";
import { Comparator } from "./comparator";
import { ComparatorConfig } from "./comparator-config";
import { CurrentDate } from "./default-expression/current-date";
import { CurrentTime } from "./default-expression/current-time";
import { CurrentTimestamp } from "./default-expression/current-timestamp";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { SchemaConfig } from "./schema-config";
import { View } from "./view";

export class MySQLSchemaManager extends AbstractSchemaManager {
  private readonly defaultCollationByCharset = new Map<string, string>();
  private readonly charsetByCollation = new Map<string, string>();
  private databaseDefaultCharset: string | null = null;
  private databaseDefaultCollation: string | null = null;
  private comparatorMetadataLoaded = false;
  private comparatorMetadataLoadPromise: Promise<void> | null = null;

  public override async initialize(): Promise<void> {
    await this.ensureComparatorMetadataLoaded();
  }

  public override createComparator(config: ComparatorConfig = new ComparatorConfig()): Comparator {
    const defaultCharset = this.databaseDefaultCharset ?? "";
    const defaultCollation =
      this.databaseDefaultCollation ?? this.defaultCollationByCharset.get(defaultCharset) ?? "";

    return new MySQLComparator(
      this.platform as AbstractMySQLPlatform,
      {
        getDefaultCharsetCollation: (charset) =>
          this.defaultCollationByCharset.get(charset) ?? null,
      },
      {
        getCollationCharset: (collation) => this.charsetByCollation.get(collation) ?? null,
      },
      new DefaultTableOptions(defaultCharset, defaultCollation),
      config,
    );
  }

  public override createSchemaConfig(): SchemaConfig {
    const config = super.createSchemaConfig();
    const params = this.connection.getParams();
    const charset = params.charset;

    if (typeof charset === "string" && charset.length > 0) {
      config.setDefaultTableOptions({
        ...config.getDefaultTableOptions(),
        charset,
      });
    }

    return config;
  }

  protected getListTableNamesSQL(): string {
    return "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'VIEW' ORDER BY TABLE_NAME";
  }

  protected override normalizeName(name: string): string {
    return stripPossiblyQuotedIdentifier(name.trim());
  }

  protected override _getPortableTableDefinition(table: Record<string, unknown>): string {
    return readString(table, "TABLE_NAME", "table_name") ?? "";
  }

  protected override _getPortableViewDefinition(view: Record<string, unknown>): View {
    return new View(
      readString(view, "TABLE_NAME", "table_name") ?? "",
      readString(view, "VIEW_DEFINITION", "view_definition") ?? "",
    );
  }

  protected override _getPortableTableIndexesList(
    rows: Record<string, unknown>[],
    tableName: string,
  ): Index[] {
    const normalizedRows = rows.map((row) => {
      const keyName =
        readString(row, "key_name", "KEY_NAME", "Key_name", "index_name", "INDEX_NAME") ?? "";
      const indexType = readString(row, "index_type", "INDEX_TYPE", "Index_Type") ?? "";
      const primary = keyName === "PRIMARY";

      const normalized: Record<string, unknown> = {
        column_name: readString(row, "column_name", "COLUMN_NAME", "Column_Name"),
        key_name: keyName,
        non_unique:
          readBoolean(row, "non_unique", "NON_UNIQUE", "Non_Unique", "is_unique", "IS_UNIQUE") ??
          false,
        primary,
        sub_part: readNumber(row, "sub_part", "SUB_PART", "Sub_Part"),
      };

      if (indexType.includes("FULLTEXT")) {
        normalized.flags = ["FULLTEXT"];
      } else if (indexType.includes("SPATIAL")) {
        normalized.flags = ["SPATIAL"];
      }

      if (!indexType.includes("SPATIAL")) {
        normalized.length = normalized.sub_part;
      }

      return normalized;
    });

    return super._getPortableTableIndexesList(normalizedRows, tableName);
  }

  protected override _getPortableDatabaseDefinition(database: Record<string, unknown>): string {
    return readString(database, "Database", "database", "SCHEMA_NAME", "schema_name") ?? "";
  }

  protected override _getPortableTableColumnDefinition(
    tableColumn: Record<string, unknown>,
  ): Column {
    const dbType = (
      readString(tableColumn, "type", "TYPE", "data_type", "DATA_TYPE") ?? ""
    ).toLowerCase();
    let length: number | null = null;
    let precision: number | null = null;
    let scale = 0;
    let fixed = false;
    let values: string[] = [];

    const typeName = this.platform.getDatazenTypeMapping(dbType);

    switch (dbType) {
      case "char":
      case "varchar":
        length = readNumber(tableColumn, "character_maximum_length", "CHARACTER_MAXIMUM_LENGTH");
        break;

      case "binary":
      case "varbinary":
        length = readNumber(tableColumn, "character_octet_length", "CHARACTER_OCTET_LENGTH");
        break;

      case "tinytext":
        length = AbstractMySQLPlatform.LENGTH_LIMIT_TINYTEXT;
        break;

      case "text":
        length = AbstractMySQLPlatform.LENGTH_LIMIT_TEXT;
        break;

      case "mediumtext":
        length = AbstractMySQLPlatform.LENGTH_LIMIT_MEDIUMTEXT;
        break;

      case "tinyblob":
        length = AbstractMySQLPlatform.LENGTH_LIMIT_TINYBLOB;
        break;

      case "blob":
        length = AbstractMySQLPlatform.LENGTH_LIMIT_BLOB;
        break;

      case "mediumblob":
        length = AbstractMySQLPlatform.LENGTH_LIMIT_MEDIUMBLOB;
        break;

      case "float":
      case "double":
      case "real":
      case "numeric":
      case "decimal":
        precision = readNumber(tableColumn, "numeric_precision", "NUMERIC_PRECISION");
        scale = readNumber(tableColumn, "numeric_scale", "NUMERIC_SCALE") ?? 0;
        break;
    }

    switch (dbType) {
      case "char":
      case "binary":
        fixed = true;
        break;

      case "enum": {
        const parsedValues = parseEnumExpression(
          readString(tableColumn, "column_type", "COLUMN_TYPE") ?? "",
        );
        values = parsedValues;
        break;
      }
    }

    const defaultValue = readString(
      tableColumn,
      "default",
      "DEFAULT",
      "column_default",
      "COLUMN_DEFAULT",
    );
    let columnDefault: unknown;
    if (defaultValue === null) {
      columnDefault = null;
    } else if (isMariaDBPlatform(this.platform)) {
      columnDefault = parseMariaDBColumnDefault(defaultValue);
    } else {
      columnDefault = parseMySQLColumnDefault(dbType, defaultValue);
    }

    const options: Record<string, unknown> = {
      autoincrement: (readString(tableColumn, "extra", "EXTRA") ?? "").includes("auto_increment"),
      default: columnDefault,
      fixed,
      length,
      notnull:
        (readString(tableColumn, "null", "NULL", "is_nullable", "IS_NULLABLE") ?? "") !== "YES",
      precision,
      scale,
      unsigned: (readString(tableColumn, "column_type", "COLUMN_TYPE") ?? "").includes("unsigned"),
      values,
    };

    const comment = readString(
      tableColumn,
      "comment",
      "COMMENT",
      "column_comment",
      "COLUMN_COMMENT",
    );
    if (comment !== null) {
      options.comment = comment;
    }

    const column = new Column(
      readString(tableColumn, "field", "FIELD", "column_name", "COLUMN_NAME") ?? "",
      typeName,
      options,
    );

    const charset = readString(
      tableColumn,
      "characterset",
      "CHARACTERSET",
      "character_set_name",
      "CHARACTER_SET_NAME",
    );
    if (charset !== null) {
      column.setPlatformOption("charset", charset);
    }

    const collation = readString(
      tableColumn,
      "collation",
      "COLLATION",
      "collation_name",
      "COLLATION_NAME",
    );
    if (collation !== null) {
      column.setPlatformOption("collation", collation);
    }

    return column;
  }

  protected override _getPortableTableForeignKeysList(
    rows: Record<string, unknown>[],
  ): ForeignKeyConstraint[] {
    const grouped = new Map<
      string,
      {
        name: string | null;
        local: string[];
        foreign: string[];
        foreignTable: string;
        onDelete: string | null;
        onUpdate: string | null;
      }
    >();

    for (const row of rows) {
      const constraintName = readString(row, "constraint_name", "CONSTRAINT_NAME");
      const key = constraintName ?? "";

      if (!grouped.has(key)) {
        const deleteRule = readString(row, "delete_rule", "DELETE_RULE");
        const updateRule = readString(row, "update_rule", "UPDATE_RULE");

        grouped.set(key, {
          foreign: [],
          foreignTable: readString(row, "referenced_table_name", "REFERENCED_TABLE_NAME") ?? "",
          local: [],
          name: this.getQuotedIdentifierName(constraintName),
          onDelete: deleteRule === null || deleteRule === "RESTRICT" ? null : deleteRule,
          onUpdate: updateRule === null || updateRule === "RESTRICT" ? null : updateRule,
        });
      }

      const data = grouped.get(key);
      if (data === undefined) {
        continue;
      }

      const localColumn = readString(row, "column_name", "COLUMN_NAME");
      if (localColumn !== null) {
        data.local.push(localColumn);
      }

      const foreignColumn = readString(row, "referenced_column_name", "REFERENCED_COLUMN_NAME");
      if (foreignColumn !== null) {
        data.foreign.push(foreignColumn);
      }
    }

    return super._getPortableTableForeignKeysList(
      [...grouped.values()].map((value) => ({
        ...value,
      })),
    );
  }

  protected override _getPortableTableForeignKeyDefinition(
    tableForeignKey: Record<string, unknown>,
  ): ForeignKeyConstraint {
    const localColumns = Array.isArray(tableForeignKey.local)
      ? tableForeignKey.local.map((value) => String(value))
      : [];
    const foreignColumns = Array.isArray(tableForeignKey.foreign)
      ? tableForeignKey.foreign.map((value) => String(value))
      : [];

    return new ForeignKeyConstraint(
      localColumns,
      readString(tableForeignKey, "foreignTable") ?? "",
      foreignColumns,
      readString(tableForeignKey, "name"),
      {
        onDelete: readString(tableForeignKey, "onDelete"),
        onUpdate: readString(tableForeignKey, "onUpdate"),
      },
    );
  }

  protected override async selectTableNames(
    databaseName: string,
  ): Promise<Record<string, unknown>[]> {
    const sql = `SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = ?
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, [databaseName]);
  }

  protected override async selectTableColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const conditions = ["c.TABLE_SCHEMA = ?", "t.TABLE_SCHEMA = ?"];
    const params: unknown[] = [databaseName, databaseName];

    if (tableName !== null) {
      conditions.push("t.TABLE_NAME = ?");
      params.push(tableName);
    }

    const sql = `SELECT
       c.TABLE_NAME,
       c.COLUMN_NAME        AS field,
       ${(this.platform as AbstractMySQLPlatform).getColumnTypeSQLSnippet(
         "c",
         databaseName,
       )}                   AS type,
       c.COLUMN_TYPE,
       c.CHARACTER_MAXIMUM_LENGTH,
       c.CHARACTER_OCTET_LENGTH,
       c.NUMERIC_PRECISION,
       c.NUMERIC_SCALE,
       c.IS_NULLABLE        AS \`null\`,
       c.COLUMN_KEY         AS \`key\`,
       c.COLUMN_DEFAULT     AS \`default\`,
       c.EXTRA,
       c.COLUMN_COMMENT     AS comment,
       c.CHARACTER_SET_NAME AS characterset,
       c.COLLATION_NAME     AS collation
FROM information_schema.COLUMNS c
    INNER JOIN information_schema.TABLES t
        ON t.TABLE_NAME = c.TABLE_NAME
 WHERE ${conditions.join(" AND ")}
   AND t.TABLE_TYPE = 'BASE TABLE'
ORDER BY c.TABLE_NAME,
         c.ORDINAL_POSITION`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async selectIndexColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const conditions = ["TABLE_SCHEMA = ?"];
    const params: unknown[] = [databaseName];

    if (tableName !== null) {
      conditions.push("TABLE_NAME = ?");
      params.push(tableName);
    }

    const sql = `SELECT
        TABLE_NAME,
        NON_UNIQUE  AS Non_Unique,
        INDEX_NAME  AS Key_name,
        COLUMN_NAME AS Column_Name,
        SUB_PART    AS Sub_Part,
        INDEX_TYPE  AS Index_Type
FROM information_schema.STATISTICS
WHERE ${conditions.join(" AND ")}
ORDER BY TABLE_NAME,
         SEQ_IN_INDEX`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async selectForeignKeyColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    const conditions = ["k.TABLE_SCHEMA = ?", "c.CONSTRAINT_SCHEMA = ?"];
    const params: unknown[] = [databaseName, databaseName];

    if (tableName !== null) {
      conditions.push("k.TABLE_NAME = ?");
      params.push(tableName);
    }

    const sql = `SELECT
            k.TABLE_NAME,
            k.CONSTRAINT_NAME,
            k.COLUMN_NAME,
            k.REFERENCED_TABLE_NAME,
            k.REFERENCED_COLUMN_NAME,
            k.ORDINAL_POSITION,
            c.UPDATE_RULE,
            c.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE k
INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS c
ON c.CONSTRAINT_NAME = k.CONSTRAINT_NAME
AND c.TABLE_NAME = k.TABLE_NAME
WHERE ${conditions.join(" AND ")}
AND k.REFERENCED_COLUMN_NAME IS NOT NULL
ORDER BY k.TABLE_NAME,
         k.CONSTRAINT_NAME,
         k.ORDINAL_POSITION`;

    return this.connection.fetchAllAssociative<Record<string, unknown>>(sql, params);
  }

  protected override async fetchTableOptionsByTable(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, Record<string, unknown>>> {
    const sql = `SELECT TABLE_NAME,
       ENGINE,
       TABLE_COLLATION,
       TABLE_COMMENT,
       AUTO_INCREMENT,
       CREATE_OPTIONS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = ?
  AND TABLE_TYPE = 'BASE TABLE'${tableName !== null ? "\n  AND TABLE_NAME = ?" : ""}
ORDER BY TABLE_NAME`;

    const params = tableName !== null ? [databaseName, tableName] : [databaseName];
    const metadata = await this.connection.fetchAllAssociativeIndexed<Record<string, unknown>>(
      sql,
      params,
    );

    const tableOptions: Record<string, Record<string, unknown>> = {};
    for (const [table, data] of Object.entries(metadata)) {
      const collation = readString(data, "TABLE_COLLATION", "table_collation");
      const charset = collation === null ? null : (collation.split("_")[0] ?? null);

      tableOptions[table] = {
        autoincrement: readNumber(data, "AUTO_INCREMENT", "auto_increment"),
        charset,
        collation,
        comment: readString(data, "TABLE_COMMENT", "table_comment"),
        create_options: parseCreateOptions(readString(data, "CREATE_OPTIONS", "create_options")),
        engine: readString(data, "ENGINE", "engine"),
      };
    }

    return tableOptions;
  }

  private async ensureComparatorMetadataLoaded(): Promise<void> {
    if (this.comparatorMetadataLoaded) {
      return;
    }

    if (this.comparatorMetadataLoadPromise !== null) {
      await this.comparatorMetadataLoadPromise;
      return;
    }

    this.comparatorMetadataLoadPromise = (async () => {
      const [charsetRows, collationRows, databaseDefaultsRow] = await Promise.all([
        this.connection.fetchAllAssociative<Record<string, unknown>>(
          `SELECT CHARACTER_SET_NAME, DEFAULT_COLLATE_NAME
FROM information_schema.CHARACTER_SETS`,
        ),
        this.connection.fetchAllAssociative<Record<string, unknown>>(
          `SELECT COLLATION_NAME, CHARACTER_SET_NAME
FROM information_schema.COLLATIONS`,
        ),
        this.connection.fetchAssociative<Record<string, unknown>>(
          `SELECT @@character_set_database AS character_set_database,
       @@collation_database AS collation_database`,
        ),
      ]);

      for (const row of charsetRows) {
        const charset = readString(row, "CHARACTER_SET_NAME");
        const collation = readString(row, "DEFAULT_COLLATE_NAME");
        if (charset === null || collation === null) {
          continue;
        }

        this.defaultCollationByCharset.set(charset, collation);
      }

      for (const row of collationRows) {
        const collation = readString(row, "COLLATION_NAME");
        const charset = readString(row, "CHARACTER_SET_NAME");
        if (collation === null || charset === null) {
          continue;
        }

        this.charsetByCollation.set(collation, charset);
      }

      if (databaseDefaultsRow !== undefined) {
        this.databaseDefaultCharset = readString(
          databaseDefaultsRow,
          "character_set_database",
          "CHARACTER_SET_DATABASE",
        );
        this.databaseDefaultCollation = readString(
          databaseDefaultsRow,
          "collation_database",
          "COLLATION_DATABASE",
        );
      }

      this.comparatorMetadataLoaded = true;
    })();

    try {
      await this.comparatorMetadataLoadPromise;
    } finally {
      this.comparatorMetadataLoadPromise = null;
    }
  }

  private getQuotedIdentifierName(identifier: string | null): string | null {
    if (identifier === null) {
      return null;
    }

    return this.platform.quoteSingleIdentifier(identifier);
  }
}

function readString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
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
      const parsed = Number(value);
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

function parseEnumExpression(expression: string): string[] {
  const matches = [...expression.matchAll(/'([^']*(?:''[^']*)*)'/g)];
  return matches.map((match) => (match[1] ?? "").replaceAll("''", "'"));
}

function parseMySQLColumnDefault(type: string, defaultValue: string): string | CurrentTimestamp {
  if ((type === "datetime" || type === "timestamp") && defaultValue === "CURRENT_TIMESTAMP") {
    return new CurrentTimestamp();
  }

  return defaultValue;
}

function parseMariaDBColumnDefault(
  columnDefault: string,
): string | CurrentTimestamp | CurrentDate | CurrentTime | null {
  if (columnDefault === "NULL") {
    return null;
  }

  const quotedLiteral = /^'(.*)'$/s.exec(columnDefault);
  if (quotedLiteral !== null) {
    return quotedLiteral[1]!.replaceAll(
      /\\0|\\'|\\"|\\b|\\n|\\r|\\t|\\Z|\\\\|\\%|\\_|''/g,
      (token) => {
        switch (token) {
          case "\\0":
            return "\0";
          case "\\'":
            return "'";
          case '\\"':
            return '"';
          case "\\b":
            return "\b";
          case "\\n":
            return "\n";
          case "\\r":
            return "\r";
          case "\\t":
            return "\t";
          case "\\Z":
            return "\x1a";
          case "\\\\":
            return "\\";
          case "\\%":
            return "%";
          case "\\_":
            return "_";
          case "''":
            return "'";
          default:
            return token;
        }
      },
    );
  }

  switch (columnDefault) {
    case "current_timestamp()":
      return new CurrentTimestamp();
    case "curdate()":
      return new CurrentDate();
    case "curtime()":
      return new CurrentTime();
    default:
      return columnDefault;
  }
}

function parseCreateOptions(value: string | null): Record<string, string | true> {
  if (value === null || value === "") {
    return {};
  }

  const options: Record<string, string | true> = {};
  for (const pair of value.split(" ")) {
    const parts = pair.split("=", 2);
    if (parts[0] === undefined || parts[0].length === 0) {
      continue;
    }

    options[parts[0]] = parts[1] ?? true;
  }

  return options;
}

function isMariaDBPlatform(platform: unknown): boolean {
  if (platform === null || platform === undefined || typeof platform !== "object") {
    return false;
  }

  return platform.constructor.name.includes("MariaDB");
}

function stripPossiblyQuotedIdentifier(identifier: string): string {
  if (identifier.length <= 1) {
    return identifier;
  }

  const wrappers: Array<[string, string]> = [
    ['"', '"'],
    ["`", "`"],
    ["[", "]"],
  ];

  for (const [start, end] of wrappers) {
    if (
      identifier.startsWith(start) &&
      identifier.endsWith(end) &&
      isFullyWrappedIdentifier(identifier, start, end)
    ) {
      return unescapeWrappedIdentifier(identifier.slice(1, -1), start, end);
    }
  }

  if (identifier.startsWith('"') || identifier.startsWith("`") || identifier.startsWith("[")) {
    return identifier.slice(1);
  }

  if (identifier.endsWith('"') || identifier.endsWith("`") || identifier.endsWith("]")) {
    return identifier.slice(0, -1);
  }

  return identifier;
}

function isFullyWrappedIdentifier(identifier: string, _start: string, end: string): boolean {
  for (let index = 1; index < identifier.length - 1; index += 1) {
    if (identifier[index] !== end) {
      continue;
    }

    const next = identifier[index + 1];
    if (next === end) {
      index += 1;
      continue;
    }

    return false;
  }

  return true;
}

function unescapeWrappedIdentifier(identifier: string, start: string, end: string): string {
  if (start === '"' && end === '"') {
    return identifier.replaceAll('""', '"');
  }

  if (start === "`" && end === "`") {
    return identifier.replaceAll("``", "`");
  }

  if (start === "[" && end === "]") {
    return identifier.replaceAll("]]", "]");
  }

  return identifier;
}
