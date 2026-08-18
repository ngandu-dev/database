import { beforeAll, describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { ColumnAlreadyExists } from "../../schema/exception/column-already-exists";
import { ColumnDoesNotExist } from "../../schema/exception/column-does-not-exist";
import { ForeignKeyDoesNotExist } from "../../schema/exception/foreign-key-does-not-exist";
import { IndexAlreadyExists } from "../../schema/exception/index-already-exists";
import { IndexDoesNotExist } from "../../schema/exception/index-does-not-exist";
import { InvalidTableName } from "../../schema/exception/invalid-table-name";
import { PrimaryKeyAlreadyExists } from "../../schema/exception/primary-key-already-exists";
import { UniqueConstraintDoesNotExist } from "../../schema/exception/unique-constraint-does-not-exist";
import { Identifier } from "../../schema/name/identifier";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { UniqueConstraint } from "../../schema/unique-constraint";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Types } from "../../types/types";

describe("Table (Doctrine TableTest parity, unified scope)", () => {
  beforeAll(() => {
    registerBuiltInTypes();
  });

  it("exposes unqualified and qualified parsed object names", () => {
    const unqualified = new Table("products").getObjectName();
    const qualified = new Table("inventory.products").getObjectName();

    expect(unqualified.getUnqualifiedName()).toEqual(Identifier.unquoted("products"));
    expect(unqualified.getQualifier()).toBeNull();
    expect(qualified.getUnqualifiedName()).toEqual(Identifier.unquoted("products"));
    expect(qualified.getQualifier()).toEqual(Identifier.unquoted("inventory"));
  });

  it("adds, retrieves and drops columns", () => {
    const table = new Table("foo");
    table.addColumn("foo", Types.INTEGER);
    table.addColumn("bar", Types.INTEGER);

    expect(table.hasColumn("foo")).toBe(true);
    expect(table.hasColumn("bar")).toBe(true);
    expect(table.hasColumn("baz")).toBe(false);
    expect(table.getColumn("foo").getName()).toBe("foo");
    expect(table.getColumns()).toHaveLength(2);

    table.dropColumn("foo").dropColumn("bar");

    expect(table.hasColumn("foo")).toBe(false);
    expect(table.hasColumn("bar")).toBe(false);
  });

  it("matches columns case-insensitively", () => {
    const table = new Table("foo");
    table.addColumn("Foo", Types.INTEGER);

    expect(table.hasColumn("foo")).toBe(true);
    expect(table.hasColumn("FOO")).toBe(true);
    expect(table.getColumn("foo")).toBe(table.getColumn("FOO"));
  });

  it("throws for unknown and duplicate columns", () => {
    const table = new Table("foo");
    table.addColumn("id", Types.INTEGER);

    expect(() => table.getColumn("unknown")).toThrow(ColumnDoesNotExist);
    expect(() => table.addColumn("id", Types.INTEGER)).toThrow(ColumnAlreadyExists);
  });

  it("renames columns and updates dependent indexes, foreign keys and unique constraints", () => {
    const table = new Table("t");
    table.addColumn("c1", Types.INTEGER);
    table.addColumn("c2", Types.INTEGER);
    table.addIndex(["c1", "c2"], "idx_c1_c2");
    table.addUniqueConstraint(new UniqueConstraint("uq_c1_c2", ["c1", "c2"]));
    table.addForeignKeyConstraint("t2", ["c1", "c2"], ["c1", "c2"], {}, "fk_c1_c2");
    table.setPrimaryKey(["c1"]);

    table.renameColumn("c2", "c2a");

    expect(table.getIndex("idx_c1_c2").getColumns()).toEqual(["c1", "c2a"]);
    expect(table.getUniqueConstraint("uq_c1_c2").getColumnNames()).toEqual(["c1", "c2a"]);
    expect(table.getForeignKey("fk_c1_c2").getLocalColumns()).toEqual(["c1", "c2a"]);
    expect(table.getRenamedColumns()).toEqual({ c2a: "c2" });
    expect(table.getPrimaryKey().getColumns()).toEqual(["c1"]);
  });

  it("tracks rename loops back to the original name across quoted/unquoted normalization", () => {
    const table = new Table("t");
    table.addColumn("foo", Types.INTEGER);

    table.renameColumn("foo", "foo_tmp");
    table.renameColumn("foo_tmp", "`foo`");

    expect(table.getRenamedColumns()).toEqual({});
    expect(table.hasColumn("foo")).toBe(true);
    expect(table.hasColumn("`foo`")).toBe(true);
  });

  it("throws when renaming a column to the same normalized quoted/unquoted name", () => {
    const table = new Table("t");
    table.addColumn("foo", Types.INTEGER);

    expect(() => table.renameColumn("foo", "`foo`")).toThrow();
    expect(() => table.renameColumn("foo", '"foo"')).toThrow();
  });

  it("adds, queries and drops indexes (including case-insensitive lookups)", () => {
    const table = new Table("foo");
    table.addColumn("foo", Types.INTEGER);
    table.addColumn("bar", Types.INTEGER);
    table.addIndex(["foo"], "Foo_Idx");
    table.addUniqueIndex(["bar"], "bar_uniq");

    expect(table.hasIndex("foo_idx")).toBe(true);
    expect(table.hasIndex("FOO_IDX")).toBe(true);
    expect(table.hasIndex("bar_uniq")).toBe(true);
    expect(table.getIndexes()).toHaveLength(2);

    table.dropIndex("bar_uniq");
    expect(table.hasIndex("bar_uniq")).toBe(false);
  });

  it("throws for unknown indexes and duplicate index names", () => {
    const table = new Table("foo");
    table.addColumn("id", Types.INTEGER);
    table.addIndex(["id"], "idx_id");

    expect(() => table.getIndex("missing")).toThrow(IndexDoesNotExist);
    expect(() => table.addIndex(["id"], "idx_id")).toThrow(IndexAlreadyExists);
  });

  it("renames indexes, preserves options, and updates primary key pointer", () => {
    const table = new Table("test");
    table.addColumn("id", Types.INTEGER);
    table.addColumn("foo", Types.INTEGER);
    table.setPrimaryKey(["id"], "pk");
    table.addIndex(["foo"], "idx", [], { where: "1 = 1" });

    table.renameIndex("pk", "pk_new");
    table.renameIndex("idx", "idx_new");

    expect(table.hasIndex("pk")).toBe(false);
    expect(table.hasIndex("pk_new")).toBe(true);
    expect(table.getPrimaryKey().getName()).toBe("pk_new");
    expect(table.getIndex("idx_new").getOptions()).toEqual({ where: "1 = 1" });

    table.renameIndex("idx_new", "IDX_NEW");
    expect(table.hasIndex("idx_new")).toBe(true);
  });

  it("throws when renaming indexes that do not exist or to an existing name", () => {
    const table = new Table("test");
    table.addColumn("id", Types.INTEGER);
    table.addColumn("foo", Types.INTEGER);
    table.addIndex(["id"], "idx_id");
    table.addIndex(["foo"], "idx_foo");

    expect(() => table.renameIndex("missing", "x")).toThrow(IndexDoesNotExist);
    expect(() => table.renameIndex("idx_id", "idx_foo")).toThrow(IndexAlreadyExists);
  });

  it("stores options and comments", () => {
    const table = new Table("foo");
    table.addOption("foo", "bar");
    table.setComment("Users table");

    expect(table.hasOption("foo")).toBe(true);
    expect(table.getOption("foo")).toBe("bar");
    expect(table.getComment()).toBe("Users table");
  });

  it("adds and removes unique constraints", () => {
    const table = new Table("foo");
    table.addColumn("email", Types.STRING);
    table.addUniqueConstraint(new UniqueConstraint("uniq_email", ["email"]));

    expect(table.hasUniqueConstraint("uniq_email")).toBe(true);
    expect(table.getUniqueConstraint("uniq_email").getColumnNames()).toEqual(["email"]);
    expect(table.columnsAreIndexed(["email"])).toBe(true);

    table.removeUniqueConstraint("uniq_email");

    expect(table.hasUniqueConstraint("uniq_email")).toBe(false);
  });

  it("throws for unknown unique constraints", () => {
    const table = new Table("foo");
    expect(() => table.getUniqueConstraint("missing")).toThrow(UniqueConstraintDoesNotExist);
    expect(() => table.removeUniqueConstraint("missing")).toThrow(UniqueConstraintDoesNotExist);
  });

  it("auto-generates names for unnamed unique constraints", () => {
    const table = new Table("test");
    table.addColumn("column1", Types.STRING);
    table.addColumn("column2", Types.STRING);
    table.addColumn("column3", Types.STRING);
    table.addColumn("column4", Types.STRING);

    table.addUniqueConstraint(new UniqueConstraint("", ["column1", "column2"]));
    table.addUniqueConstraint(new UniqueConstraint("", ["column3", "column4"]));

    const constraints = table.getUniqueConstraints();
    const names = constraints.map((constraint) => constraint.getObjectName());

    expect(constraints).toHaveLength(2);
    expect(names[0]).toMatch(/^UNIQ_/i);
    expect(names[1]).toMatch(/^UNIQ_/i);
    expect(names[0]).not.toBe(names[1]);
  });

  it("adds, queries and drops foreign keys", () => {
    const table = new Table("t1");
    table.addColumn("id", Types.INTEGER);
    table.addForeignKeyConstraint("t2", ["id"], ["id"], {}, "fk_t1_t2");

    expect(table.hasForeignKey("fk_t1_t2")).toBe(true);
    expect(table.getForeignKey("fk_t1_t2").getColumns()).toEqual(["id"]);

    table.dropForeignKey("fk_t1_t2");
    expect(table.hasForeignKey("fk_t1_t2")).toBe(false);
  });

  it("throws for unknown foreign keys", () => {
    const table = new Table("foo");
    expect(() => table.getForeignKey("missing")).toThrow(ForeignKeyDoesNotExist);
    expect(() => table.dropForeignKey("missing")).toThrow(ForeignKeyDoesNotExist);
  });

  it("derives primary key constraint from primary index and vice versa", () => {
    const tableA = new Table("t");
    tableA.addColumn("id", Types.INTEGER);
    tableA.setPrimaryKey(["id"]);

    expect(tableA.getPrimaryKeyConstraint()?.getColumnNames()).toEqual(["id"]);

    const tableB = new Table("t");
    tableB.addColumn("id", Types.INTEGER);
    tableB.addPrimaryKeyConstraint(new PrimaryKeyConstraint(null, ["id"], true));

    expect(tableB.getPrimaryKey().getColumns()).toEqual(["id"]);
  });

  it("drops the primary key and clears constraint state", () => {
    const table = new Table("t");
    table.addColumn("id", Types.INTEGER);
    table.setPrimaryKey(["id"]);

    expect(table.getPrimaryKeyConstraint()).not.toBeNull();

    table.dropPrimaryKey();

    expect(table.getPrimaryKeyConstraint()).toBeNull();
  });

  it("prevents adding duplicate primary key representations", () => {
    const tableA = new Table("t");
    tableA.addColumn("id", Types.INTEGER);
    tableA.addPrimaryKeyConstraint(new PrimaryKeyConstraint(null, ["id"], true));
    expect(() => tableA.setPrimaryKey(["id"])).toThrow(PrimaryKeyAlreadyExists);

    const tableB = new Table("t");
    tableB.addColumn("id", Types.INTEGER);
    tableB.setPrimaryKey(["id"]);
    expect(() =>
      tableB.addPrimaryKeyConstraint(new PrimaryKeyConstraint(null, ["id"], true)),
    ).toThrow(PrimaryKeyAlreadyExists);
  });

  it("marks nonclustered primary key constraints on the backing index", () => {
    const table = new Table("t");
    table.addColumn("id", Types.INTEGER);
    table.addPrimaryKeyConstraint(new PrimaryKeyConstraint("pk_t", ["id"], false));

    expect(table.getPrimaryKeyConstraint()?.isClustered()).toBe(false);
    expect(table.getPrimaryKey().hasFlag("nonclustered")).toBe(true);
  });

  it("supports index and foreign key quoted-name helper accessors", () => {
    const table = new Table("users");
    table.addColumn("role_id", Types.INTEGER);
    const index = table.addIndex(["role_id"], "idx_users_role", [], { where: "1 = 1" });
    const fk = table.addForeignKeyConstraint("app.roles", ["role_id"], ["id"], {}, "fk_users_role");

    expect(index.getPredicate()).toBe("1 = 1");
    expect(index.getQuotedColumns(new MySQLPlatform())).toEqual(["role_id"]);
    expect(fk.getReferencedTableName().toString()).toBe("app.roles");
    expect(fk.getUnqualifiedForeignTableName()).toBe("roles");
  });

  it("rejects empty table names in the constructor exactly like Doctrine", () => {
    expect(() => new Table("")).toThrow(InvalidTableName);
    expect(() => new Table("   ")).toThrow(InvalidTableName);
  });

  it.skip(
    "covers Doctrine deprecation-only cases for dropping columns with constraints and ambiguous name references (PHP deprecation harness specific)",
  );

  it.each([
    "foo",
    "FOO",
    "`foo`",
    "`FOO`",
    '"foo"',
    '"FOO"',
    "[foo]",
    "[FOO]",
  ])("normalizes asset names across columns/indexes/foreign keys for %s (Doctrine TableTest parity)", (assetName) => {
    const table = new Table("test");

    table.addColumn(assetName, Types.INTEGER);
    table.addIndex([assetName], assetName);
    table.addForeignKeyConstraint("test", [assetName], [assetName], {}, assetName);

    expect(table.hasColumn(assetName)).toBe(true);
    expect(table.hasColumn("foo")).toBe(true);

    expect(table.hasIndex(assetName)).toBe(true);
    expect(table.hasIndex("foo")).toBe(true);

    expect(table.hasForeignKey(assetName)).toBe(true);
    expect(table.hasForeignKey("foo")).toBe(true);

    table.renameIndex(assetName, assetName);
    expect(table.hasIndex(assetName)).toBe(true);
    expect(table.hasIndex("foo")).toBe(true);

    table.renameIndex(assetName, "foo");
    expect(table.hasIndex(assetName)).toBe(true);
    expect(table.hasIndex("foo")).toBe(true);

    table.renameIndex("foo", assetName);
    expect(table.hasIndex(assetName)).toBe(true);
    expect(table.hasIndex("foo")).toBe(true);

    table.renameIndex(assetName, "bar");
    expect(table.hasIndex(assetName)).toBe(false);
    expect(table.hasIndex("foo")).toBe(false);
    expect(table.hasIndex("bar")).toBe(true);

    table.renameIndex("bar", assetName);
    table.dropColumn(assetName);
    table.dropIndex(assetName);
    table.removeForeignKey(assetName);

    expect(table.hasColumn(assetName)).toBe(false);
    expect(table.hasColumn("foo")).toBe(false);
    expect(table.hasIndex(assetName)).toBe(false);
    expect(table.hasIndex("foo")).toBe(false);
    expect(table.hasForeignKey(assetName)).toBe(false);
    expect(table.hasForeignKey("foo")).toBe(false);
  });

  it("renames indexes to Doctrine-compatible auto-generated names, including primary => primary", () => {
    const table = new Table("test");
    table.addColumn("id", Types.INTEGER);
    table.addColumn("foo", Types.INTEGER);
    table.addColumn("bar", Types.INTEGER);
    table.addColumn("baz", Types.INTEGER);
    table.setPrimaryKey(["id"], "pk");
    table.addIndex(["foo"], "idx", ["flag"]);
    table.addUniqueIndex(["bar", "baz"], "uniq");

    table.renameIndex("pk", "pk_new");
    table.renameIndex("idx", "idx_new");
    table.renameIndex("uniq", "uniq_new");

    table.renameIndex("pk_new", null);
    table.renameIndex("idx_new", null);
    table.renameIndex("uniq_new", null);

    expect(table.getPrimaryKey().getName()).toBe("primary");
    expect(table.hasIndex("primary")).toBe(true);
    expect(table.hasIndex("IDX_D87F7E0C8C736521")).toBe(true);
    expect(table.hasIndex("UNIQ_D87F7E0C76FF8CAA78240498")).toBe(true);

    expect(table.getIndex("primary").getColumns()).toEqual(["id"]);
    expect(table.getIndex("IDX_D87F7E0C8C736521").getColumns()).toEqual(["foo"]);
    expect(table.getIndex("IDX_D87F7E0C8C736521").getFlags()).toEqual(["flag"]);
    expect(table.getIndex("UNIQ_D87F7E0C76FF8CAA78240498").getColumns()).toEqual(["bar", "baz"]);
    expect(table.getIndex("UNIQ_D87F7E0C76FF8CAA78240498").isUnique()).toBe(true);
  });
});
