import { describe, expect, it } from "vitest";

import { Configuration } from "../../configuration";
import { Connection } from "../../connection";
import type { Driver } from "../../driver";
import { ParameterBindingStyle } from "../../driver/_internal";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import { DriverException } from "../../exception/driver-exception";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { OraclePlatform } from "../../platforms/oracle-platform";
import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { AbstractSchemaManager } from "../../schema/abstract-schema-manager";
import { Comparator } from "../../schema/comparator";
import { ComparatorConfig } from "../../schema/comparator-config";
import { ForeignKeyConstraint } from "../../schema/foreign-key-constraint";
import { Index } from "../../schema/index";
import { OracleSchemaManager } from "../../schema/oracle-schema-manager";
import { PostgreSQLSchemaManager } from "../../schema/postgresql-schema-manager";
import { Schema } from "../../schema/schema";
import { SchemaConfig } from "../../schema/schema-config";
import { SchemaDiff } from "../../schema/schema-diff";
import { SchemaManagerFactory } from "../../schema/schema-manager-factory";
import { Sequence } from "../../schema/sequence";
import { SQLServerSchemaManager } from "../../schema/sqlserver-schema-manager";
import { Table } from "../../schema/table";
import { TableDiff } from "../../schema/table-diff";
import { UniqueConstraint } from "../../schema/unique-constraint";
import { View } from "../../schema/view";
import { Types } from "../../types/types";

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver failure", {
      cause: error,
      driverName: "schema-spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class SchemaSpyConnection implements DriverConnection {
  public constructor(private readonly executedStatements: string[] = []) {}

  public async prepare(sql: string) {
    return {
      bindValue: () => undefined,
      execute: async () => this.query(sql),
    };
  }

  public async query(sql: string) {
    if (sql.includes("information_schema.schemata")) {
      return new ArrayResult([{ schema_name: "public" }, { schema_name: "app" }], ["schema_name"]);
    }

    if (sql.includes("sys.schemas")) {
      return new ArrayResult([{ name: "dbo" }, { name: "app" }], ["name"]);
    }

    if (sql.includes("TABLE_TYPE = 'BASE TABLE'")) {
      return new ArrayResult([{ TABLE_NAME: "users" }, { TABLE_NAME: "posts" }], ["TABLE_NAME"]);
    }

    if (sql.includes("TABLE_TYPE = 'VIEW'")) {
      return new ArrayResult([{ TABLE_NAME: "active_users" }], ["TABLE_NAME"]);
    }

    return new ArrayResult([], [], 0);
  }

  public quote(value: string): string {
    return `'${value}'`;
  }

  public async exec(sql: string): Promise<number | string> {
    this.executedStatements.push(sql);
    return 0;
  }

  public async lastInsertId(): Promise<number | string> {
    return 0;
  }

  public async beginTransaction(): Promise<void> {}

  public async commit(): Promise<void> {}

  public async rollBack(): Promise<void> {}

  public async getServerVersion(): Promise<string> {
    return "8.0.0";
  }

  public async close(): Promise<void> {}

  public getNativeConnection(): unknown {
    return this;
  }
}

class SchemaSpyDriver implements Driver {
  public readonly name = "schema-spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  public readonly executedStatements: string[] = [];
  private readonly converter = new NoopExceptionConverter();

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return new SchemaSpyConnection(this.executedStatements);
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

class PostgreSQLSchemaSpyDriver extends SchemaSpyDriver {
  public override getDatabasePlatform(): PostgreSQLPlatform {
    return new PostgreSQLPlatform();
  }
}

class SQLServerSchemaSpyDriver extends SchemaSpyDriver {
  public override getDatabasePlatform(): SQLServerPlatform {
    return new SQLServerPlatform();
  }
}

class OracleSchemaSpyDriver extends SchemaSpyDriver {
  public override getDatabasePlatform(): OraclePlatform {
    return new OraclePlatform();
  }
}

class CustomSchemaManager extends AbstractSchemaManager {
  protected getListTableNamesSQL(): string {
    return "SELECT 'custom_table'";
  }
}

class InspectableSchemaManager extends CustomSchemaManager {
  public async exposeGetCurrentSchemaName(): Promise<string | null> {
    return this.getCurrentSchemaName();
  }

  public exposeNormalizeName(name: string): string {
    return this.normalizeName(name);
  }

  public async exposeFetchTableColumnsByTable(
    databaseName: string,
  ): Promise<Record<string, Record<string, unknown>[]>> {
    return this.fetchTableColumnsByTable(databaseName);
  }

  public exposePortableDatabaseDefinition(row: Record<string, unknown>): string {
    return this._getPortableDatabaseDefinition(row);
  }

  public exposePortableSequenceDefinition(row: Record<string, unknown>): Sequence {
    return this._getPortableSequenceDefinition(row);
  }

  public exposePortableTableDefinition(row: Record<string, unknown>): string {
    return this._getPortableTableDefinition(row);
  }

  public exposePortableViewDefinition(row: Record<string, unknown>): View {
    return this._getPortableViewDefinition(row);
  }
}

class CustomSchemaManagerFactory implements SchemaManagerFactory {
  public createSchemaManager(connection: Connection): AbstractSchemaManager {
    return new CustomSchemaManager(connection, connection.getDatabasePlatform());
  }
}

describe("Connection schema manager integration", () => {
  it("creates platform schema manager by default", async () => {
    const connection = new Connection({}, new SchemaSpyDriver());
    const manager = await connection.createSchemaManager();

    expect(manager).toBeInstanceOf(AbstractSchemaManager);
    await expect(manager.listTableNames()).resolves.toEqual(["users", "posts"]);
    await expect(manager.listViewNames()).resolves.toEqual(["active_users"]);
    await expect(manager.tableExists("users")).resolves.toBe(true);
    await expect(manager.tablesExist(["users", "posts"])).resolves.toBe(true);
    await expect(manager.tablesExist(["users", "missing"])).resolves.toBe(false);

    await expect(manager.listDatabases()).resolves.toEqual([]);
    await expect(manager.listSchemaNames()).resolves.toEqual([]);
    await expect(manager.listSequences()).resolves.toEqual([]);
    await expect(manager.listTableColumns("users")).resolves.toEqual([]);
    await expect(manager.listTableIndexes("users")).resolves.toEqual([]);
    await expect(manager.listTableForeignKeys("users")).resolves.toEqual([]);

    await expect(manager.introspectDatabaseNames()).resolves.toEqual([]);
    await expect(manager.introspectSchemaNames()).resolves.toEqual([]);
    await expect(manager.introspectTableNames()).resolves.toSatisfy(
      (names) =>
        names.map((name: { toString(): string }) => name.toString()).join(",") === "users,posts",
    );
    await expect(manager.introspectTables()).resolves.toHaveLength(2);
    await expect(manager.introspectTable("users")).rejects.toThrow();
    await expect(manager.introspectTableByUnquotedName("users")).rejects.toThrow();
    await expect(manager.introspectTableColumnsByUnquotedName("users")).resolves.toEqual([]);
    await expect(manager.introspectTableIndexesByUnquotedName("users")).resolves.toEqual([]);
    await expect(
      manager.introspectTableForeignKeyConstraintsByUnquotedName("users"),
    ).resolves.toEqual([]);
    await expect(
      manager.introspectTablePrimaryKeyConstraint((await manager.introspectTableNames())[0]!),
    ).resolves.toBeNull();
    await expect(manager.introspectViews()).resolves.toHaveLength(1);
    await expect(manager.introspectSequences()).resolves.toEqual([]);

    const schema = await manager.introspectSchema();
    expect(schema.getTables()).toHaveLength(2);
    expect(manager.createSchemaConfig()).toBeInstanceOf(SchemaConfig);
    expect(manager.createComparator()).toBeInstanceOf(Comparator);
  });

  it("uses custom schema manager factory from configuration", async () => {
    const configuration = new Configuration({
      schemaManagerFactory: new CustomSchemaManagerFactory(),
    });

    const connection = new Connection({}, new SchemaSpyDriver(), configuration);
    const manager = await connection.createSchemaManager();

    expect(manager).toBeInstanceOf(CustomSchemaManager);
  });

  it("adds PostgreSQL and SQL Server schema manager public overrides", async () => {
    const pgConnection = new Connection({}, new PostgreSQLSchemaSpyDriver());
    const pgManager = new PostgreSQLSchemaManager(pgConnection, pgConnection.getDatabasePlatform());
    await expect(pgManager.listSchemaNames()).resolves.toEqual(["public", "app"]);

    const sqlServerConnection = new Connection({}, new SQLServerSchemaSpyDriver());
    const sqlServerManager = new SQLServerSchemaManager(
      sqlServerConnection,
      sqlServerConnection.getDatabasePlatform(),
    );

    await expect(sqlServerManager.listSchemaNames()).resolves.toEqual(["dbo", "app"]);
    expect(sqlServerManager.createComparator()).toBeInstanceOf(Comparator);
    expect(
      sqlServerManager.createComparator(
        new ComparatorConfig({ detectColumnRenames: true, detectIndexRenames: true }),
      ),
    ).toBeInstanceOf(Comparator);
  });

  it("adds Oracle schema manager public overrides", async () => {
    const driver = new OracleSchemaSpyDriver();
    const connection = new Connection({ password: "secret_pwd" }, driver);
    const manager = new OracleSchemaManager(connection, connection.getDatabasePlatform());

    await manager.createDatabase("APPUSER");
    await manager.dropTable("USERS");

    expect(
      driver.executedStatements.some((sql) =>
        sql.startsWith('CREATE DATABASE APPUSER IDENTIFIED BY "secret_pwd"'),
      ),
    ).toBe(true);
    expect(driver.executedStatements).toContain("GRANT DBA TO APPUSER");
    expect(driver.executedStatements).toContain("DROP TABLE USERS");
  });

  it("executes mutating schema manager API shims through platform SQL", async () => {
    const driver = new SchemaSpyDriver();
    const connection = new Connection({}, driver);
    const manager = await connection.createSchemaManager();

    const table = new Table("users");
    table.addColumn("id", Types.INTEGER);
    table.setPrimaryKey(["id"]);

    const index = new Index("idx_users_email", ["email"]);
    const foreignKey = new ForeignKeyConstraint(["role_id"], "roles", ["id"], "fk_users_roles");
    const unique = new UniqueConstraint("uniq_users_email", ["email"]);
    const view = new View("active_users", "SELECT 1");

    await manager.createDatabase("appdb");
    await manager.dropDatabase("appdb");
    await manager.createTable(table);
    await manager.dropTable("users");
    await manager.createIndex(index, "users");
    await manager.dropIndex("idx_users_email", "users");
    await manager.createForeignKey(foreignKey, "users");
    await manager.dropForeignKey("fk_users_roles", "users");
    await manager.createUniqueConstraint(unique, "users");
    await manager.dropUniqueConstraint("uniq_users_email", "users");
    await manager.createView(view);
    await manager.dropView("active_users");
    await manager.renameTable("users", "accounts");

    const schema = new Schema();
    const teams = schema.createTable("teams");
    teams.addColumn("id", Types.INTEGER);
    teams.setPrimaryKey(["id"]);

    await manager.createSchemaObjects(schema);
    await manager.dropSchemaObjects(schema);

    expect(driver.executedStatements).toContain("CREATE DATABASE appdb");
    expect(driver.executedStatements).toContain("DROP DATABASE appdb");
    expect(driver.executedStatements.some((sql) => sql.startsWith("CREATE TABLE users"))).toBe(
      true,
    );
    expect(driver.executedStatements).toContain("DROP TABLE users");
    expect(driver.executedStatements).toContain("CREATE INDEX idx_users_email ON users (email)");
    expect(driver.executedStatements).toContain("DROP INDEX idx_users_email");
    expect(
      driver.executedStatements.some((sql) =>
        sql.includes("ALTER TABLE users ADD CONSTRAINT fk_users_roles FOREIGN KEY"),
      ),
    ).toBe(true);
    expect(driver.executedStatements).toContain(
      "ALTER TABLE users DROP FOREIGN KEY fk_users_roles",
    );
    expect(
      driver.executedStatements.some((sql) => sql.includes("ALTER TABLE users ADD UNIQUE")),
    ).toBe(true);
    expect(driver.executedStatements).toContain(
      "ALTER TABLE users DROP CONSTRAINT uniq_users_email",
    );
    expect(driver.executedStatements).toContain("CREATE VIEW active_users AS SELECT 1");
    expect(driver.executedStatements).toContain("DROP VIEW active_users");
    expect(driver.executedStatements).toContain("ALTER TABLE users RENAME TO accounts");
    expect(driver.executedStatements.some((sql) => sql.startsWith("CREATE TABLE teams"))).toBe(
      true,
    );
    expect(driver.executedStatements).toContain("DROP TABLE teams");

    await expect(manager.createSequence(new Sequence("users_id_seq"))).rejects.toThrow();
    await expect(manager.dropSequence("users_id_seq")).rejects.toThrow();
    await expect(manager.dropSchema("app")).rejects.toThrow();
    const oldUsers = new Table("users");
    oldUsers.addColumn("id", Types.INTEGER);
    const newUsers = new Table("users");
    newUsers.addColumn("id", Types.INTEGER);
    newUsers.addColumn("email", Types.STRING);

    await expect(
      manager.alterTable(
        new TableDiff(oldUsers, newUsers, { addedColumns: [newUsers.getColumn("email")] }),
      ),
    ).resolves.toBeUndefined();
    expect(driver.executedStatements.some((sql) => sql.includes("ALTER TABLE users ADD"))).toBe(
      true,
    );
    await expect(manager.alterSchema(new SchemaDiff())).rejects.toThrow();
    await expect(manager.migrateSchema(new Schema())).rejects.toThrow();
  });

  it("exposes safe defaults for protected schema-manager metadata helpers", async () => {
    const connection = new Connection({}, new SchemaSpyDriver());
    const manager = new InspectableSchemaManager(connection, connection.getDatabasePlatform());

    await expect(manager.exposeGetCurrentSchemaName()).resolves.toBeNull();
    expect(manager.exposeNormalizeName("Users")).toBe("Users");
    await expect(manager.exposeFetchTableColumnsByTable("appdb")).resolves.toEqual({});

    expect(manager.exposePortableDatabaseDefinition({ DATABASE_NAME: "appdb" })).toBe("appdb");
    expect(
      manager.exposePortableSequenceDefinition({ SEQUENCE_NAME: "users_id_seq" }).getName(),
    ).toBe("users_id_seq");
    expect(manager.exposePortableTableDefinition({ TABLE_NAME: "users" })).toBe("users");
    expect(manager.exposePortableViewDefinition({ TABLE_NAME: "active_users" }).getName()).toBe(
      "active_users",
    );
  });
});
