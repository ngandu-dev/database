import { describe, expect, it } from "vitest";

import { LockMode } from "../../lock-mode";
import { AbstractPlatform } from "../../platforms/abstract-platform";
import { DB2Platform } from "../../platforms/db2-platform";
import { NoColumnsSpecifiedForTable } from "../../platforms/exception/no-columns-specified-for-table";
import { NotSupported } from "../../platforms/exception/not-supported";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { OraclePlatform } from "../../platforms/oracle-platform";
import { PostgreSQL120Platform } from "../../platforms/postgresql120-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { TrimMode } from "../../platforms/trim-mode";
import { Table } from "../../schema/table";
import { Parser } from "../../sql/parser";
import { TransactionIsolationLevel } from "../../transaction-isolation-level";
import { Types } from "../../types/types";

class DummyPlatform extends AbstractPlatform {
  public getLocateExpression(string: string, substring: string, start?: string | null): string {
    if (start === undefined || start === null) {
      return `LOCATE(${substring}, ${string})`;
    }

    return `LOCATE(${substring}, ${string}, ${start})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DATEDIFF(${date1}, ${date2})`;
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET TRANSACTION ISOLATION LEVEL ${level}`;
  }

  public assertCreateTableColumnsForTest(table: {
    getColumns(): readonly unknown[];
    getName(): string;
  }): void {
    this.assertCreateTableHasColumns(table);
  }
}

describe("Platform parity extensions", () => {
  it("quotes identifiers with dot notation and escaping", () => {
    const platform = new DummyPlatform();

    expect(platform.quoteIdentifier('user."name"')).toBe('"user"."""name"""');
  });

  it("rejects negative offsets when modifying limit query", () => {
    const platform = new DummyPlatform();

    expect(() => platform.modifyLimitQuery("SELECT 1", 10, -1)).toThrowError(
      "Offset must be a positive integer or zero, -1 given.",
    );
  });

  it("escapes LIKE wildcard characters", () => {
    const platform = new DummyPlatform();
    const sqlServerPlatform = new SQLServerPlatform();

    expect(platform.escapeStringForLike("100%_done!", "!")).toBe("100!%!_done!!");
    expect(sqlServerPlatform.escapeStringForLike("[x]%_", "!")).toBe("![x]!%!_");
  });

  it("handles base trim expression modes", () => {
    const platform = new DummyPlatform();

    expect(platform.getTrimExpression("name")).toBe("TRIM(name)");
    expect(platform.getTrimExpression("name", TrimMode.LEADING, "'x'")).toBe(
      "TRIM(LEADING 'x' FROM name)",
    );
    expect(platform.getTrimExpression("name", TrimMode.TRAILING, "'x'")).toBe(
      "TRIM(TRAILING 'x' FROM name)",
    );
  });

  it("exposes Doctrine-style default bitwise comparison expressions", () => {
    const platform = new DummyPlatform();

    expect(platform.getBitAndComparisonExpression("flags", "4")).toBe("(flags & 4)");
    expect(platform.getBitOrComparisonExpression("flags", "2")).toBe("(flags | 2)");
  });

  it("converts booleans according to base and sqlserver rules", () => {
    const base = new DummyPlatform();
    const sqlServer = new SQLServerPlatform();

    expect(base.convertBooleans([true, false, "x"])).toEqual([1, 0, "x"]);
    expect(base.convertFromBoolean(null)).toBeNull();
    expect(base.convertFromBoolean(1)).toBe(true);

    expect(sqlServer.convertBooleans([true, false, 2, 0, "x"])).toEqual([1, 0, 1, 0, "x"]);
  });

  it("applies SQL Server pagination ORDER BY fallback rules", () => {
    const platform = new SQLServerPlatform();

    expect(platform.modifyLimitQuery("SELECT id FROM users", 5, 2)).toBe(
      "SELECT id FROM users ORDER BY (SELECT 0) OFFSET 2 ROWS FETCH NEXT 5 ROWS ONLY",
    );
    expect(platform.modifyLimitQuery("SELECT DISTINCT id FROM users", 5, 2)).toBe(
      "SELECT DISTINCT id FROM users ORDER BY 1 OFFSET 2 ROWS FETCH NEXT 5 ROWS ONLY",
    );
    expect(platform.modifyLimitQuery("SELECT id FROM users ORDER BY id DESC", 5, 0)).toBe(
      "SELECT id FROM users ORDER BY id DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY",
    );
  });

  it("applies SQL Server lock hints and identifier quoting", () => {
    const platform = new SQLServerPlatform();

    expect(platform.appendLockHint("users u", LockMode.PESSIMISTIC_READ)).toBe(
      "users u WITH (HOLDLOCK, ROWLOCK)",
    );
    expect(platform.appendLockHint("users u", LockMode.PESSIMISTIC_WRITE)).toBe(
      "users u WITH (UPDLOCK, ROWLOCK)",
    );
    expect(platform.quoteSingleIdentifier("a]b")).toBe("[a]]b]");
  });

  it("maps Oracle date arithmetic and savepoint release semantics", () => {
    const platform = new OraclePlatform();

    expect(platform.getDateAddQuarterExpression("created_at", "2")).toBe(
      "ADD_MONTHS(created_at, +(2 * 3))",
    );
    expect(platform.getDateSubYearExpression("created_at", "1")).toBe(
      "ADD_MONTHS(created_at, -(1 * 12))",
    );
    expect(platform.supportsReleaseSavepoints()).toBe(false);
    expect(platform.releaseSavePoint("sp1")).toBe("");
  });

  it("maps DB2 date arithmetic and select syntax", () => {
    const platform = new DB2Platform();

    expect(platform.getDateAddWeeksExpression("created_at", "3")).toBe("created_at + (3 * 7) DAY");
    expect(platform.getDateSubQuarterExpression("created_at", "2")).toBe(
      "created_at - (2 * 3) MONTH",
    );
    expect(platform.getDummySelectSQL("1")).toBe("SELECT 1 FROM sysibm.sysdummy1");
    expect(platform.supportsSavepoints()).toBe(false);
  });

  it("keeps MySQL-specific behavior for concat and locate", () => {
    const platform = new MySQLPlatform();

    expect(platform.getConcatExpression("a", "b", "c")).toBe("CONCAT(a, b, c)");
    expect(platform.getLocateExpression("name", "'x'")).toBe("LOCATE('x', name)");
    expect(platform.getLocateExpression("name", "'x'", "2")).toBe("LOCATE('x', name, 2)");
  });

  it("exposes Datazen Type mappings per platform", () => {
    const mysql = new MySQLPlatform();
    const sqlServer = new SQLServerPlatform();
    const oracle = new OraclePlatform();
    const db2 = new DB2Platform();

    expect(mysql.getDatazenTypeMapping("varchar")).toBe(Types.STRING);
    expect(sqlServer.getDatazenTypeMapping("uniqueidentifier")).toBe(Types.GUID);
    expect(oracle.getDatazenTypeMapping("varchar2")).toBe(Types.STRING);
    expect(db2.getDatazenTypeMapping("timestamp")).toBe(Types.DATETIME_MUTABLE);
  });

  it("supports checking and registering Datazen Type mappings", () => {
    const platform = new MySQLPlatform();

    expect(platform.hasDatazenTypeMappingFor("varchar")).toBe(true);
    expect(platform.hasDatazenTypeMappingFor("custom_json")).toBe(false);

    platform.registerDatazenTypeMapping("custom_json", Types.JSON);
    expect(platform.hasDatazenTypeMappingFor("custom_json")).toBe(true);
    expect(platform.getDatazenTypeMapping("custom_json")).toBe(Types.JSON);
  });

  it("exposes Doctrine-style aliases for type mappings and date plural helpers", () => {
    const platform = new DummyPlatform();

    platform.registerDoctrineTypeMapping("custom_alias", Types.STRING);
    expect(platform.hasDoctrineTypeMappingFor("custom_alias")).toBe(true);
    expect(platform.getDoctrineTypeMapping("custom_alias")).toBe(Types.STRING);

    expect(platform.getDateAddQuartersExpression("created_at", "2")).toBe(
      platform.getDateAddQuarterExpression("created_at", "2"),
    );
    expect(platform.getDateSubQuartersExpression("created_at", "2")).toBe(
      platform.getDateSubQuarterExpression("created_at", "2"),
    );
    expect(platform.getDateAddYearsExpression("created_at", "1")).toBe(
      platform.getDateAddYearExpression("created_at", "1"),
    );
    expect(platform.getDateSubYearsExpression("created_at", "1")).toBe(
      platform.getDateSubYearExpression("created_at", "1"),
    );
  });

  it("keeps PG12 default-value snippet and NotSupported factory parity", () => {
    const pg120 = new PostgreSQL120Platform();
    expect(pg120.getDefaultColumnValueSQLSnippet()).toContain("a.attgenerated = 's'");
    expect(pg120.getDefaultColumnValueSQLSnippet()).toContain("pg_get_expr(adbin, adrelid)");

    expect(NotSupported.new("demoMethod")).toBeInstanceOf(NotSupported);
  });

  it("adds PostgreSQL and Oracle platform parity helper methods", () => {
    const postgres = new (class extends PostgreSQL120Platform {})();
    postgres.setUseBooleanTrueFalseStrings(true);
    expect(postgres.getDefaultColumnValueSQLSnippet()).toContain("pg_get_expr(adbin, adrelid)");

    const oracle = new OraclePlatform();
    expect(oracle.getDropAutoincrementSql("users")).toEqual(["DROP SEQUENCE USERS_SEQ"]);
  });

  it("throws for unknown database type mappings", () => {
    const platform = new MySQLPlatform();

    expect(() => platform.getDatazenTypeMapping("definitely_unknown_type")).toThrowError(
      'Unknown database type "definitely_unknown_type" requested',
    );
  });

  it("exposes Doctrine-style default drop SQL helpers", () => {
    const platform = new DummyPlatform();

    expect(platform.getDropTableSQL("users")).toBe("DROP TABLE users");
    expect(platform.getDropTemporaryTableSQL("tmp_users")).toBe("DROP TABLE tmp_users");
    expect(platform.getDropIndexSQL("idx_users_email", "users")).toBe("DROP INDEX idx_users_email");
    expect(platform.getDropForeignKeySQL("fk_users_roles", "users")).toBe(
      "ALTER TABLE users DROP CONSTRAINT fk_users_roles",
    );
    expect(platform.getDropUniqueConstraintSQL("uniq_users_email", "users")).toBe(
      "ALTER TABLE users DROP CONSTRAINT uniq_users_email",
    );
  });

  it("creates a Doctrine-style SQL parser instance", () => {
    const platform = new DummyPlatform();

    expect(platform.createSQLParser()).toBeInstanceOf(Parser);
  });

  it("builds create-table SQL with primary keys, indexes, and foreign keys", () => {
    const platform = new DummyPlatform();
    const table = new Table("users");

    table.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
    table.addColumn("role_id", Types.INTEGER, { columnDefinition: "INT" });
    table.setPrimaryKey(["id"]);
    table.addIndex(["role_id"], "idx_users_role_id");
    table.addForeignKeyConstraint(
      "roles",
      ["role_id"],
      ["id"],
      { onDelete: "cascade" },
      "fk_users_roles",
    );

    expect(platform.getCreateTableSQL(table)).toEqual([
      "CREATE TABLE users (id INT, role_id INT, PRIMARY KEY (id), INDEX idx_users_role_id (role_id))",
      "ALTER TABLE users ADD CONSTRAINT fk_users_roles FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE",
    ]);
  });

  it("defers foreign keys in getCreateTablesSQL like Doctrine", () => {
    const platform = new DummyPlatform();

    const roles = new Table("roles");
    roles.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
    roles.setPrimaryKey(["id"]);

    const users = new Table("users");
    users.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
    users.addColumn("role_id", Types.INTEGER, { columnDefinition: "INT" });
    users.setPrimaryKey(["id"]);
    users.addForeignKeyConstraint("roles", ["role_id"], ["id"], {}, "fk_users_roles");

    const sql = platform.getCreateTablesSQL([users, roles]);

    expect(sql[0]).toMatch(
      /^CREATE TABLE users \(id INT, role_id INT, PRIMARY KEY \(id\), INDEX .+ \(role_id\)\)$/,
    );
    expect(sql[1]).toBe("CREATE TABLE roles (id INT, PRIMARY KEY (id))");
    expect(sql[2]).toBe(
      "ALTER TABLE users ADD CONSTRAINT fk_users_roles FOREIGN KEY (role_id) REFERENCES roles (id)",
    );
  });

  it("throws Doctrine-style NoColumnsSpecifiedForTable for empty create-table input", () => {
    const platform = new DummyPlatform();

    expect(() =>
      platform.assertCreateTableColumnsForTest({
        getColumns: () => [],
        getName: () => "users",
      }),
    ).toThrow(NoColumnsSpecifiedForTable);
    expect(() =>
      platform.assertCreateTableColumnsForTest({
        getColumns: () => [],
        getName: () => "users",
      }),
    ).toThrowError('No columns specified for table "users".');

    expect(() =>
      platform.assertCreateTableColumnsForTest({
        getColumns: () => [{ name: "id" }],
        getName: () => "users",
      }),
    ).not.toThrow();
  });
});
