import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { ForeignKeyConstraint } from "../../schema/foreign-key-constraint";
import { Index } from "../../schema/index";
import { Schema } from "../../schema/schema";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";

describe("Schema assets", () => {
  it("builds table columns, indexes and foreign keys", () => {
    const table = new Table("users");

    table.addColumn("id", Types.INTEGER, { autoincrement: true, notnull: true });
    table.addColumn("email", Types.STRING, { length: 190, notnull: true });

    const primary = table.setPrimaryKey(["id"]);
    const unique = table.addUniqueIndex(["email"], "uniq_users_email");
    const foreign = table.addForeignKeyConstraint("accounts", ["id"], ["user_id"], {
      onDelete: "CASCADE",
    });

    expect(table.hasPrimaryKey()).toBe(true);
    expect(primary.getColumns()).toEqual(["id"]);
    expect(unique.isUnique()).toBe(true);
    expect(foreign.getForeignTableName()).toBe("accounts");
    expect(foreign.onDelete()).toBe("CASCADE");
    expect(table.getColumns()).toHaveLength(2);
    expect(table.getIndexes()).toHaveLength(2);
    expect(table.getForeignKeys()).toHaveLength(1);
  });

  it("supports index matching semantics", () => {
    const lhs = new Index("idx_users_email", ["email"]);
    const rhs = new Index("idx_users_email_2", ["email"]);
    const unique = new Index("uniq_users_email", ["email"], true);

    expect(lhs.spansColumns(["email"])).toBe(true);
    expect(lhs.isFulfilledBy(rhs)).toBe(true);
    expect(unique.isFulfilledBy(lhs)).toBe(false);
  });

  it("tracks schema tables and sequences", () => {
    const schema = new Schema();

    const users = schema.createTable("users");
    users.addColumn("id", Types.INTEGER, { notnull: true });

    schema.createSequence("users_seq", 10, 1);

    expect(schema.hasTable("users")).toBe(true);
    expect(schema.getTable("users").getName()).toBe("users");
    expect(schema.hasSequence("users_seq")).toBe(true);
    expect(schema.getSequence("users_seq").getAllocationSize()).toBe(10);
  });

  it("quotes keyword-backed index columns", () => {
    const platform = new MySQLPlatform();
    const index = new Index("idx_select", ["select"]);
    const fk = new ForeignKeyConstraint(["select"], "roles", ["id"], "fk_select_role");

    expect(index.getQuotedColumns(platform)).toEqual(["`select`"]);
    expect(fk.getQuotedLocalColumns(platform)).toEqual(["`select`"]);
  });
});
