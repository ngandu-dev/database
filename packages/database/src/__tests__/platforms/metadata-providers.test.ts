import { describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { Db2MetadataProvider } from "../../platforms/db2/db2-metadata-provider";
import { DB2Platform } from "../../platforms/db2-platform";
import { NotSupported } from "../../platforms/exception/not-supported";
import { MariaDBPlatform } from "../../platforms/mariadb-platform";
import { MySQLMetadataProvider } from "../../platforms/mysql/mysql-metadata-provider";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { PostgreSQLMetadataProvider } from "../../platforms/postgresql/postgresql-metadata-provider";
import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { SQLiteMetadataProvider } from "../../platforms/sqlite/sqlite-metadata-provider";
import { ForeignKeyConstraintDetails } from "../../platforms/sqlite/sqlite-metadata-provider/foreign-key-constraint-details";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { SQLServerMetadataProvider } from "../../platforms/sqlserver/sqlserver-metadata-provider";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { ReferentialAction } from "../../schema/foreign-key-constraint/referential-action";
import { IndexType } from "../../schema/index/index-type";

class StubAsyncQueryConnection {
  public constructor(
    private readonly columns: Record<string, unknown[]> = {},
    private readonly numerics: Record<string, unknown[][]> = {},
    private readonly associatives: Record<string, Record<string, unknown>[]> = {},
    private readonly fetchOneValue: unknown = undefined,
  ) {}

  public async fetchOne<T = unknown>(
    _sql: string,
    _params: unknown[] = [],
  ): Promise<T | undefined> {
    return this.fetchOneValue as T | undefined;
  }

  public async fetchFirstColumn<T = unknown>(sql: string, _params: unknown[] = []): Promise<T[]> {
    return [...this.lookup(this.columns, sql)] as T[];
  }

  public async fetchAllNumeric<T extends unknown[] = unknown[]>(
    sql: string,
    _params: unknown[] = [],
  ): Promise<T[]> {
    return [...this.lookup(this.numerics, sql)] as T[];
  }

  public async fetchAllAssociative<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    _params: unknown[] = [],
  ): Promise<T[]> {
    return [...this.lookup(this.associatives, sql)] as T[];
  }

  private lookup<T>(bucket: Record<string, T[]>, sql: string): T[] {
    const key = this.findKey(bucket, sql);
    return key === null ? [] : (bucket[key] ?? []);
  }

  private findKey<T>(bucket: Record<string, T[]>, sql: string): string | null {
    if (Object.hasOwn(bucket, sql)) {
      return sql;
    }

    const normalizedSql = normalizeSql(sql);
    const normalizedSqlNoSlashes = normalizedSql.replaceAll("\\", "");
    for (const key of Object.keys(bucket)) {
      const normalizedKey = normalizeSql(key);
      if (
        normalizedKey === normalizedSql ||
        normalizedKey.replaceAll("\\", "") === normalizedSqlNoSlashes
      ) {
        return key;
      }
    }

    return null;
  }
}

function normalizeSql(sql: string): string {
  return sql.replaceAll(/\s+/g, " ").trim();
}

function asPlatformConnectionStub(
  base: StubAsyncQueryConnection,
  dbname: string | null = null,
): Connection {
  return {
    ...base,
    getDatabase: () => dbname,
  } as unknown as Connection;
}

describe("Platform MetadataProvider surfaces (async, Doctrine-parity intent)", () => {
  it("wires createMetadataProvider() in concrete platforms", () => {
    const query = new StubAsyncQueryConnection();

    expect(
      new MySQLPlatform().createMetadataProvider(asPlatformConnectionStub(query, "appdb")),
    ).toBeInstanceOf(MySQLMetadataProvider);
    expect(
      new MariaDBPlatform().createMetadataProvider(asPlatformConnectionStub(query, "appdb")),
    ).toBeInstanceOf(MySQLMetadataProvider);
    expect(
      new PostgreSQLPlatform().createMetadataProvider(asPlatformConnectionStub(query)),
    ).toBeInstanceOf(PostgreSQLMetadataProvider);
    expect(
      new SQLitePlatform().createMetadataProvider(asPlatformConnectionStub(query)),
    ).toBeInstanceOf(SQLiteMetadataProvider);
    expect(
      new SQLServerPlatform().createMetadataProvider(asPlatformConnectionStub(query)),
    ).toBeInstanceOf(SQLServerMetadataProvider);
    expect(
      new DB2Platform().createMetadataProvider(asPlatformConnectionStub(query)),
    ).toBeInstanceOf(Db2MetadataProvider);
  });

  it("maps MySQL rows including columns/indexes/keys/table options", async () => {
    const provider = new MySQLMetadataProvider(
      new StubAsyncQueryConnection(
        {
          "SELECT SCHEMA_NAME\nFROM information_schema.SCHEMATA\nORDER BY SCHEMA_NAME": ["appdb"],
        },
        {
          "SELECT TABLE_NAME\nFROM information_schema.TABLES\nWHERE TABLE_SCHEMA = ?\n  AND TABLE_TYPE = 'BASE TABLE'\nORDER BY TABLE_NAME":
            [["users"]],
          "SELECT TABLE_NAME,\n       VIEW_DEFINITION\nFROM information_schema.VIEWS\nWHERE TABLE_SCHEMA = ?\nORDER BY TABLE_NAME":
            [["active_users", "SELECT * FROM users"]],
        },
        {
          "SELECT c.TABLE_NAME,\n       c.COLUMN_NAME,\n       c.DATA_TYPE AS DATA_TYPE,\n       c.COLUMN_TYPE,\n       c.IS_NULLABLE,\n       c.COLUMN_DEFAULT,\n       c.CHARACTER_MAXIMUM_LENGTH,\n       c.NUMERIC_PRECISION,\n       c.NUMERIC_SCALE,\n       c.EXTRA,\n       c.COLUMN_COMMENT,\n       c.CHARACTER_SET_NAME,\n       c.COLLATION_NAME\nFROM information_schema.COLUMNS c\nWHERE c.TABLE_SCHEMA = ?\nORDER BY c.TABLE_NAME, c.ORDINAL_POSITION":
            [
              {
                TABLE_NAME: "users",
                COLUMN_NAME: "id",
                DATA_TYPE: "int",
                COLUMN_TYPE: "int unsigned",
                IS_NULLABLE: "NO",
                COLUMN_DEFAULT: null,
                NUMERIC_PRECISION: 10,
                NUMERIC_SCALE: 0,
                EXTRA: "auto_increment",
                COLUMN_COMMENT: "pk",
              },
            ],
          "SELECT TABLE_NAME,\n       INDEX_NAME,\n       NON_UNIQUE,\n       INDEX_TYPE,\n       COLUMN_NAME,\n       SUB_PART\nFROM information_schema.STATISTICS\nWHERE TABLE_SCHEMA = ?\n  AND INDEX_NAME <> 'PRIMARY'\nORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX":
            [
              {
                TABLE_NAME: "users",
                INDEX_NAME: "uniq_email",
                NON_UNIQUE: 0,
                INDEX_TYPE: "BTREE",
                COLUMN_NAME: "email",
                SUB_PART: null,
              },
            ],
          "SELECT TABLE_NAME,\n       INDEX_NAME,\n       COLUMN_NAME\nFROM information_schema.STATISTICS\nWHERE TABLE_SCHEMA = ?\n  AND INDEX_NAME = 'PRIMARY'\nORDER BY TABLE_NAME, SEQ_IN_INDEX":
            [{ TABLE_NAME: "users", INDEX_NAME: "PRIMARY", COLUMN_NAME: "id" }],
          "SELECT kcu.TABLE_NAME,\n       kcu.CONSTRAINT_NAME,\n       kcu.ORDINAL_POSITION,\n       kcu.COLUMN_NAME,\n       kcu.REFERENCED_TABLE_SCHEMA,\n       kcu.REFERENCED_TABLE_NAME,\n       kcu.REFERENCED_COLUMN_NAME,\n       rc.MATCH_OPTION,\n       rc.UPDATE_RULE,\n       rc.DELETE_RULE\nFROM information_schema.KEY_COLUMN_USAGE AS kcu\nLEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS AS rc\n  ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA\n AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME\nWHERE kcu.TABLE_SCHEMA = ?\n  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL\nORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION":
            [
              {
                TABLE_NAME: "users",
                CONSTRAINT_NAME: "fk_users_roles",
                ORDINAL_POSITION: 1,
                COLUMN_NAME: "role_id",
                REFERENCED_TABLE_SCHEMA: "appdb",
                REFERENCED_TABLE_NAME: "roles",
                REFERENCED_COLUMN_NAME: "id",
                MATCH_OPTION: "SIMPLE",
                UPDATE_RULE: "CASCADE",
                DELETE_RULE: "RESTRICT",
              },
            ],
          "SELECT TABLE_NAME,\n       ENGINE,\n       TABLE_COLLATION,\n       TABLE_COMMENT,\n       AUTO_INCREMENT\nFROM information_schema.TABLES\nWHERE TABLE_SCHEMA = ?\n  AND TABLE_TYPE = 'BASE TABLE'\nORDER BY TABLE_NAME":
            [
              {
                TABLE_NAME: "users",
                ENGINE: "InnoDB",
                TABLE_COLLATION: "utf8mb4_unicode_ci",
                TABLE_COMMENT: "User table",
                AUTO_INCREMENT: 42,
              },
            ],
        },
      ),
      new MySQLPlatform(),
      "appdb",
    );

    expect((await provider.getAllDatabaseNames()).map((row) => row.getDatabaseName())).toEqual([
      "appdb",
    ]);
    expect((await provider.getAllTableNames()).map((row) => row.getTableName())).toEqual(["users"]);
    expect((await provider.getAllViews()).map((row) => row.getViewName())).toEqual([
      "active_users",
    ]);

    const columns = await provider.getTableColumnsForAllTables();
    expect(columns).toHaveLength(1);
    expect(columns[0]!.getTableName()).toBe("users");
    expect(columns[0]!.getColumn().getName()).toBe("id");
    expect(columns[0]!.getColumn().getAutoincrement()).toBe(true);

    const indexes = await provider.getIndexColumnsForAllTables();
    expect(indexes[0]!.getIndexName()).toBe("uniq_email");
    expect(indexes[0]!.getType()).toBe(IndexType.UNIQUE);

    const pks = await provider.getPrimaryKeyConstraintColumnsForAllTables();
    expect(pks[0]!.getConstraintName()).toBe("PRIMARY");
    expect(pks[0]!.isClustered()).toBe(true);

    const fks = await provider.getForeignKeyConstraintColumnsForAllTables();
    expect(fks[0]!.getReferencedTableName()).toBe("roles");
    expect(fks[0]!.getOnUpdateAction()).toBe(ReferentialAction.CASCADE);
    expect(fks[0]!.getOnDeleteAction()).toBe(ReferentialAction.RESTRICT);

    const options = await provider.getTableOptionsForAllTables();
    expect(options[0]!.getOptions()).toMatchObject({
      engine: "InnoDB",
      charset: "utf8mb4",
      collation: "utf8mb4_unicode_ci",
      autoincrement: 42,
    });

    await expect(provider.getAllSequences()).rejects.toThrow(NotSupported);
  });

  it("maps PostgreSQL database/schema/table/view/sequence rows and metadata details", async () => {
    const provider = new PostgreSQLMetadataProvider(
      new StubAsyncQueryConnection(
        {
          "SELECT datname FROM pg_database ORDER BY datname": ["postgres"],
          "SELECT nspname\nFROM pg_namespace\nWHERE nspname NOT LIKE 'pg\\\\_%'\n  AND nspname != 'information_schema'\nORDER BY nspname":
            ["public"],
        },
        {
          "SELECT n.nspname, c.relname\nFROM pg_class c\nJOIN pg_namespace n ON n.oid = c.relnamespace\nWHERE n.nspname NOT LIKE 'pg\\\\_%'\n  AND n.nspname != 'information_schema'\n  AND c.relkind IN ('r', 'p')\n  AND c.relname NOT IN ('geometry_columns', 'spatial_ref_sys')\nORDER BY n.nspname, c.relname":
            [["public", "users"]],
          "SELECT schemaname, viewname, definition\nFROM pg_views\nWHERE schemaname NOT LIKE 'pg\\\\_%'\n  AND schemaname != 'information_schema'\nORDER BY schemaname, viewname":
            [["public", "active_users", "SELECT * FROM users"]],
          "SELECT sequence_schema, sequence_name, increment, minimum_value\nFROM information_schema.sequences\nWHERE sequence_catalog = CURRENT_DATABASE()\n  AND sequence_schema NOT LIKE 'pg\\\\_%'\n  AND sequence_schema != 'information_schema'\nORDER BY sequence_schema, sequence_name":
            [["public", "users_id_seq", 1, 1]],
        },
        {
          "SELECT table_schema,\n       table_name,\n       COALESCE(domain_name, udt_name) AS data_type,\n       udt_name AS domain_type,\n       column_name,\n       is_nullable,\n       column_default,\n       is_identity,\n       character_maximum_length,\n       collation_name,\n       numeric_precision,\n       numeric_scale\nFROM information_schema.columns\nWHERE table_schema NOT LIKE 'pg\\\\_%'\n  AND table_schema != 'information_schema'\nORDER BY table_schema, table_name, ordinal_position":
            [
              {
                table_schema: "public",
                table_name: "users",
                data_type: "integer",
                column_name: "id",
                is_nullable: "NO",
                collation_name: null,
              },
            ],
          "SELECT quote_ident(tc.table_schema) AS table_schema,\n       quote_ident(tc.table_name) AS table_name,\n       quote_ident(tc.constraint_name) AS constraint_name,\n       quote_ident(kcu.column_name) AS column_name\nFROM information_schema.table_constraints tc\nJOIN information_schema.key_column_usage kcu\n  ON tc.constraint_schema = kcu.constraint_schema\n AND tc.constraint_name = kcu.constraint_name\n AND tc.table_name = kcu.table_name\nWHERE tc.constraint_type = 'PRIMARY KEY'\nORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position":
            [
              {
                table_schema: "public",
                table_name: "users",
                constraint_name: "users_pkey",
                column_name: "id",
              },
            ],
          "SELECT quote_ident(pkn.nspname) AS table_schema,\n       quote_ident(pkc.relname) AS table_name,\n       quote_ident(r.conname) AS constraint_name,\n       quote_ident(fkn.nspname) AS referenced_table_schema,\n       quote_ident(fkc.relname) AS referenced_table_name,\n       r.confupdtype AS update_rule,\n       r.confdeltype AS delete_rule,\n       r.condeferrable AS is_deferrable,\n       r.condeferred AS initially_deferred,\n       quote_ident(pka.attname) AS column_name,\n       quote_ident(fka.attname) AS referenced_column_name\nFROM pg_constraint r\nJOIN pg_class fkc\n  ON fkc.oid = r.confrelid\nJOIN pg_namespace fkn\n  ON fkn.oid = fkc.relnamespace\nJOIN unnest(r.confkey) WITH ORDINALITY AS fk_attnum(attnum, ord)\n  ON TRUE\nJOIN pg_attribute fka\n  ON fka.attrelid = fkc.oid\n AND fka.attnum = fk_attnum.attnum\nJOIN pg_class pkc\n  ON pkc.oid = r.conrelid\nJOIN pg_namespace pkn\n  ON pkn.oid = pkc.relnamespace\nJOIN unnest(r.conkey) WITH ORDINALITY AS pk_attnum(attnum, ord)\n  ON pk_attnum.ord = fk_attnum.ord\nJOIN pg_attribute pka\n  ON pka.attrelid = pkc.oid\n AND pka.attnum = pk_attnum.attnum\nWHERE r.contype = 'f'\n  AND pkn.nspname NOT LIKE 'pg\\\\_%'\n  AND pkn.nspname != 'information_schema'\nORDER BY pkn.nspname, pkc.relname, r.conname, fk_attnum.ord":
            [
              {
                table_schema: "public",
                table_name: "users",
                constraint_name: "fk_users_roles",
                column_name: "role_id",
                referenced_table_schema: "public",
                referenced_table_name: "roles",
                referenced_column_name: "id",
                update_rule: "a",
                delete_rule: "c",
                is_deferrable: true,
                initially_deferred: false,
              },
            ],
        },
      ),
      new PostgreSQLPlatform(),
    );

    expect((await provider.getAllDatabaseNames()).map((row) => row.getDatabaseName())).toEqual([
      "postgres",
    ]);
    expect((await provider.getAllSchemaNames()).map((row) => row.getSchemaName())).toEqual([
      "public",
    ]);
    expect((await provider.getAllTableNames()).map((row) => row.getTableName())).toEqual(["users"]);
    expect((await provider.getAllViews()).map((row) => row.getViewName())).toEqual([
      "active_users",
    ]);
    expect((await provider.getAllSequences()).map((row) => row.getSequenceName())).toEqual([
      "users_id_seq",
    ]);
    expect((await provider.getTableColumnsForAllTables())[0]!.getColumn().getName()).toBe("id");
    expect(
      (await provider.getPrimaryKeyConstraintColumnsForAllTables())[0]!.getConstraintName(),
    ).toBe("users_pkey");
    expect((await provider.getForeignKeyConstraintColumnsForAllTables())[0]!.isDeferrable()).toBe(
      true,
    );
  });

  it("maps DB2 tables/views/sequences and key metadata", async () => {
    const provider = new Db2MetadataProvider(
      new StubAsyncQueryConnection(
        {},
        {
          "SELECT TABNAME\nFROM SYSCAT.TABLES\nWHERE TABSCHEMA = CURRENT USER\n  AND TYPE = 'T'\nORDER BY TABNAME":
            [["USERS"]],
          "SELECT VIEWNAME, TEXT\nFROM SYSCAT.VIEWS\nWHERE VIEWSCHEMA = CURRENT USER\nORDER BY VIEWNAME":
            [["ACTIVE_USERS", "SELECT * FROM USERS"]],
        },
        {
          "SELECT TABNAME AS table_name,\n       COLNAME AS column_name,\n       TYPENAME AS data_type,\n       LENGTH AS character_maximum_length,\n       SCALE AS numeric_scale,\n       NULLS AS is_nullable,\n       DEFAULT AS column_default,\n       REMARKS AS remarks\nFROM SYSCAT.COLUMNS\nWHERE TABSCHEMA = CURRENT USER\nORDER BY TABNAME, COLNO":
            [{ table_name: "USERS", column_name: "ID", data_type: "INTEGER", is_nullable: "N" }],
          "SELECT i.TABNAME AS table_name,\n       i.INDNAME AS index_name,\n       i.UNIQUERULE AS unique_rule,\n       'BTREE' AS index_type,\n       c.COLNAME AS column_name\nFROM SYSCAT.INDEXES i\nJOIN SYSCAT.INDEXCOLUSE c\n  ON c.INDSCHEMA = i.INDSCHEMA\n AND c.INDNAME = i.INDNAME\nWHERE i.TABSCHEMA = CURRENT USER\n  AND i.UNIQUERULE <> 'P'\nORDER BY i.TABNAME, i.INDNAME, c.COLSEQ":
            [
              {
                table_name: "USERS",
                index_name: "UQ_USERS_EMAIL",
                unique_rule: "U",
                column_name: "EMAIL",
              },
            ],
          "SELECT i.TABNAME AS table_name,\n       i.INDNAME AS constraint_name,\n       c.COLNAME AS column_name\nFROM SYSCAT.INDEXES i\nJOIN SYSCAT.INDEXCOLUSE c\n  ON c.INDSCHEMA = i.INDSCHEMA\n AND c.INDNAME = i.INDNAME\nWHERE i.TABSCHEMA = CURRENT USER\n  AND i.UNIQUERULE = 'P'\nORDER BY i.TABNAME, c.COLSEQ":
            [{ table_name: "USERS", constraint_name: "PK_USERS", column_name: "ID" }],
          "SELECT r.TABNAME AS table_name,\n       r.CONSTNAME AS constraint_name,\n       k.COLNAME AS column_name,\n       r.REFTABNAME AS referenced_table_name,\n       rk.COLNAME AS referenced_column_name,\n       r.DELETERULE AS delete_rule,\n       r.UPDATERULE AS update_rule,\n       k.COLSEQ AS ordinal_position\nFROM SYSCAT.REFERENCES r\nJOIN SYSCAT.KEYCOLUSE k\n  ON k.TABSCHEMA = r.TABSCHEMA\n AND k.TABNAME = r.TABNAME\n AND k.CONSTNAME = r.CONSTNAME\nLEFT JOIN SYSCAT.KEYCOLUSE rk\n  ON rk.TABSCHEMA = r.REFTABSCHEMA\n AND rk.TABNAME = r.REFTABNAME\n AND rk.CONSTNAME = r.REFKEYNAME\n AND rk.COLSEQ = k.COLSEQ\nWHERE r.TABSCHEMA = CURRENT USER\nORDER BY r.TABNAME, r.CONSTNAME, k.COLSEQ":
            [
              {
                table_name: "USERS",
                constraint_name: "FK_USERS_ROLES",
                column_name: "ROLE_ID",
                referenced_table_name: "ROLES",
                referenced_column_name: "ID",
                delete_rule: "CASCADE",
                update_rule: "NO ACTION",
                ordinal_position: 1,
              },
            ],
          "SELECT SEQNAME, INCREMENT, START, CACHE\nFROM SYSCAT.SEQUENCES\nWHERE SEQSCHEMA = CURRENT USER\nORDER BY SEQNAME":
            [{ SEQNAME: "USERS_ID_SEQ", INCREMENT: 1, START: 1, CACHE: 20 }],
        },
      ),
      new DB2Platform(),
    );

    expect((await provider.getAllTableNames()).map((row) => row.getTableName())).toEqual(["USERS"]);
    expect((await provider.getAllViews()).map((row) => row.getViewName())).toEqual([
      "ACTIVE_USERS",
    ]);
    expect((await provider.getAllSequences()).map((row) => row.getSequenceName())).toEqual([
      "USERS_ID_SEQ",
    ]);
    expect((await provider.getIndexColumnsForAllTables())[0]!.getType()).toBe(IndexType.UNIQUE);
    expect(
      (await provider.getForeignKeyConstraintColumnsForAllTables())[0]!.getReferencedTableName(),
    ).toBe("ROLES");
    await expect(provider.getAllDatabaseNames()).rejects.toThrow(NotSupported);
  });

  it("maps SQLite tables/views and pragma-based column/index/key metadata", async () => {
    const provider = new SQLiteMetadataProvider(
      new StubAsyncQueryConnection(
        {
          "SELECT name\nFROM sqlite_master\nWHERE type = 'table'\n  AND name NOT IN ('geometry_columns', 'spatial_ref_sys', 'sqlite_sequence')":
            ["users"],
        },
        {
          "SELECT name, sql\nFROM sqlite_master\nWHERE type = 'view'\nORDER BY name": [
            ["active_users", "SELECT * FROM users"],
          ],
        },
        {
          "PRAGMA table_info('users')": [
            { name: "id", type: "INTEGER", notnull: 1, dflt_value: null, pk: 1 },
            { name: "email", type: "TEXT", notnull: 0, dflt_value: null, pk: 0 },
          ],
          "PRAGMA index_list('users')": [
            { name: "idx_users_email", unique: 0, origin: "c", partial: 0 },
            { name: "sqlite_autoindex_users_1", unique: 1, origin: "pk", partial: 0 },
          ],
          "PRAGMA index_info('idx_users_email')": [{ name: "email" }],
          "PRAGMA foreign_key_list('users')": [
            {
              id: 0,
              table: "roles",
              from: "role_id",
              to: "id",
              on_update: "CASCADE",
              on_delete: "SET NULL",
              match: "SIMPLE",
            },
          ],
        },
      ),
      new SQLitePlatform(),
    );

    expect((await provider.getAllTableNames()).map((row) => row.getTableName())).toEqual(["users"]);
    expect((await provider.getAllViews()).map((row) => row.getViewName())).toEqual([
      "active_users",
    ]);
    expect(
      (await provider.getTableColumnsForAllTables()).map((row) => row.getColumn().getName()),
    ).toEqual(["id", "email"]);
    expect((await provider.getIndexColumnsForAllTables())[0]!.getIndexName()).toBe(
      "idx_users_email",
    );
    expect((await provider.getPrimaryKeyConstraintColumnsForAllTables())[0]!.getColumnName()).toBe(
      "id",
    );
    expect(
      (await provider.getForeignKeyConstraintColumnsForAllTables())[0]!.getOnDeleteAction(),
    ).toBe(ReferentialAction.SET_NULL);
    expect((await provider.getTableOptionsForAllTables())[0]!.getOptions()).toEqual({});

    const details = new ForeignKeyConstraintDetails("fk_users_roles", true, false);
    expect(details.getName()).toBe("fk_users_roles");
    expect(details.isDeferrable()).toBe(true);
    expect(details.isDeferred()).toBe(false);
  });

  it("maps SQL Server rows including columns/indexes/keys", async () => {
    const provider = new SQLServerMetadataProvider(
      new StubAsyncQueryConnection(
        {
          "SELECT name FROM sys.databases ORDER BY name": ["master", "appdb"],
          "SELECT name\nFROM sys.schemas\nWHERE name NOT LIKE 'db_%'\n  AND name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')":
            ["dbo"],
        },
        {
          "SELECT s.name, t.name\nFROM sys.tables AS t\nJOIN sys.schemas AS s ON t.schema_id = s.schema_id\nWHERE s.name NOT LIKE 'db_%'\n  AND s.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')\n  AND t.name != 'sysdiagrams'\nORDER BY s.name, t.name":
            [["dbo", "users"]],
          "SELECT s.name, v.name, m.definition\nFROM sys.views v\nJOIN sys.schemas s ON v.schema_id = s.schema_id\nJOIN sys.sql_modules m ON v.object_id = m.object_id\nWHERE s.name NOT LIKE 'db_%'\n  AND s.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')\nORDER BY s.name, v.name":
            [["dbo", "active_users", "SELECT * FROM users"]],
          "SELECT scm.name, seq.name, seq.increment, seq.start_value\nFROM sys.sequences AS seq\nJOIN sys.schemas AS scm ON scm.schema_id = seq.schema_id":
            [["dbo", "users_id_seq", 1, 1]],
        },
        {
          "SELECT TABLE_SCHEMA AS table_schema,\n       TABLE_NAME AS table_name,\n       COLUMN_NAME AS column_name,\n       DATA_TYPE AS data_type,\n       CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,\n       NUMERIC_PRECISION AS numeric_precision,\n       NUMERIC_SCALE AS numeric_scale,\n       IS_NULLABLE AS is_nullable,\n       COLUMN_DEFAULT AS column_default\nFROM INFORMATION_SCHEMA.COLUMNS\nWHERE TABLE_SCHEMA NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')\nORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION":
            [
              {
                table_schema: "dbo",
                table_name: "users",
                column_name: "id",
                data_type: "int",
                is_nullable: "NO",
              },
            ],
          "SELECT s.name AS table_schema,\n       t.name AS table_name,\n       i.name AS index_name,\n       i.type_desc AS index_type,\n       i.is_unique AS is_unique,\n       CASE WHEN i.type_desc LIKE 'CLUSTERED%' THEN 1 ELSE 0 END AS is_clustered,\n       i.filter_definition AS predicate,\n       c.name AS column_name\nFROM sys.indexes i\nJOIN sys.tables t ON t.object_id = i.object_id\nJOIN sys.schemas s ON s.schema_id = t.schema_id\nJOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id\nJOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = ic.column_id\nWHERE i.is_primary_key = 0\n  AND i.is_hypothetical = 0\n  AND s.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')\nORDER BY s.name, t.name, i.name, ic.key_ordinal":
            [
              {
                table_schema: "dbo",
                table_name: "users",
                index_name: "idx_users_email",
                index_type: "NONCLUSTERED",
                is_unique: false,
                is_clustered: false,
                predicate: null,
                column_name: "email",
              },
            ],
          "SELECT s.name AS table_schema,\n       t.name AS table_name,\n       kc.name AS constraint_name,\n       CASE WHEN i.type_desc LIKE 'CLUSTERED%' THEN 1 ELSE 0 END AS is_clustered,\n       c.name AS column_name\nFROM sys.key_constraints kc\nJOIN sys.tables t ON t.object_id = kc.parent_object_id\nJOIN sys.schemas s ON s.schema_id = t.schema_id\nJOIN sys.indexes i ON i.object_id = kc.parent_object_id AND i.index_id = kc.unique_index_id\nJOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id\nJOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id\nWHERE kc.type = 'PK'\nORDER BY s.name, t.name, kc.name, ic.key_ordinal":
            [
              {
                table_schema: "dbo",
                table_name: "users",
                constraint_name: "PK_users",
                is_clustered: true,
                column_name: "id",
              },
            ],
          "SELECT s.name AS table_schema,\n       t.name AS table_name,\n       fk.object_id AS fk_id,\n       fk.name AS constraint_name,\n       rs.name AS referenced_table_schema,\n       rt.name AS referenced_table_name,\n       pc.name AS column_name,\n       rc.name AS referenced_column_name,\n       fk.update_referential_action_desc AS update_rule,\n       fk.delete_referential_action_desc AS delete_rule,\n       fkc.constraint_column_id AS ordinal_position\nFROM sys.foreign_keys fk\nJOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id\nJOIN sys.tables t ON t.object_id = fk.parent_object_id\nJOIN sys.schemas s ON s.schema_id = t.schema_id\nJOIN sys.columns pc ON pc.object_id = t.object_id AND pc.column_id = fkc.parent_column_id\nJOIN sys.tables rt ON rt.object_id = fk.referenced_object_id\nJOIN sys.schemas rs ON rs.schema_id = rt.schema_id\nJOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id\nWHERE s.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')\nORDER BY s.name, t.name, fk.name, fkc.constraint_column_id":
            [
              {
                table_schema: "dbo",
                table_name: "users",
                fk_id: 100,
                constraint_name: "FK_users_roles",
                referenced_table_schema: "dbo",
                referenced_table_name: "roles",
                column_name: "role_id",
                referenced_column_name: "id",
                update_rule: "NO_ACTION",
                delete_rule: "CASCADE",
                ordinal_position: 1,
              },
            ],
        },
      ),
      new SQLServerPlatform(),
    );

    expect((await provider.getAllDatabaseNames()).map((row) => row.getDatabaseName())).toEqual([
      "master",
      "appdb",
    ]);
    expect((await provider.getAllSchemaNames()).map((row) => row.getSchemaName())).toEqual(["dbo"]);
    expect((await provider.getAllTableNames()).map((row) => row.getTableName())).toEqual(["users"]);
    expect((await provider.getAllViews()).map((row) => row.getViewName())).toEqual([
      "active_users",
    ]);
    expect((await provider.getAllSequences()).map((row) => row.getSequenceName())).toEqual([
      "users_id_seq",
    ]);
    expect((await provider.getIndexColumnsForAllTables())[0]!.getType()).toBe(IndexType.REGULAR);
    expect((await provider.getPrimaryKeyConstraintColumnsForAllTables())[0]!.isClustered()).toBe(
      true,
    );
    expect(
      (await provider.getForeignKeyConstraintColumnsForAllTables())[0]!.getReferencedSchemaName(),
    ).toBe("dbo");
  });
});
