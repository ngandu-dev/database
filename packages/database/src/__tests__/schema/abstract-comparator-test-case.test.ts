import { describe, expect, it } from "vitest";

import { Comparator } from "../../schema/comparator";
import { ComparatorConfig } from "../../schema/comparator-config";
import { Schema } from "../../schema/schema";
import { SchemaConfig } from "../../schema/schema-config";
import { Sequence } from "../../schema/sequence";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";

function createTable(name: string): Table {
  const table = new Table(name);
  table.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
  return table;
}

function createAutoincrementPkTable(name: string): Table {
  const table = new Table(name);
  table.addColumn("id", Types.INTEGER, { autoincrement: true });
  table.setPrimaryKey(["id"]);
  return table;
}

describe("Schema AbstractComparatorTestCase parity scaffold", () => {
  it("compares equal schemas as no-op diff", () => {
    const comparator = new Comparator();
    const schemaA = new Schema([createTable("bugdb")]);
    const schemaB = new Schema([createTable("bugdb")]);

    const diff = comparator.compareSchemas(schemaA, schemaB);

    expect(diff.getCreatedTables()).toEqual([]);
    expect(diff.getAlteredTables()).toEqual([]);
    expect(diff.getDroppedTables()).toEqual([]);
  });

  it("detects created and dropped tables", () => {
    const comparator = new Comparator();
    const table = createTable("bugdb");

    expect(
      comparator.compareSchemas(new Schema([]), new Schema([table])).getCreatedTables(),
    ).toEqual([table]);
    expect(
      comparator.compareSchemas(new Schema([table]), new Schema([])).getDroppedTables(),
    ).toEqual([table]);
  });

  it("detects sequence diffs and schema sequence changes", () => {
    const comparator = new Comparator();
    const seq1 = new Sequence("foo");
    const seq2 = new Sequence("foo", 2, 1);

    expect(comparator.diffSequence(seq1, seq2)).toBe(true);

    const oldSchema = new Schema();
    oldSchema.createSequence("foo");
    const newSchema = new Schema();
    newSchema.createSequence("foo").setAllocationSize(20);

    expect(comparator.compareSchemas(oldSchema, newSchema).getAlteredSequences()).toHaveLength(1);
  });

  it("detects added foreign keys in table diffs", () => {
    const oldTable = new Table("foo");
    oldTable.addColumn("fk", Types.INTEGER, { columnDefinition: "INT" });

    const newTable = new Table("foo");
    newTable.addColumn("fk", Types.INTEGER, { columnDefinition: "INT" });
    newTable.addForeignKeyConstraint("bar", ["fk"], ["id"], {}, "fk_bar");

    const diff = new Comparator().compareTables(oldTable, newTable);

    expect(diff).not.toBeNull();
    expect(diff?.getAddedForeignKeys()).toHaveLength(1);
  });

  it("respects comparator config construction surface", () => {
    const comparator = new Comparator(
      new ComparatorConfig({ detectColumnRenames: true, detectIndexRenames: true }),
    );
    const diff = comparator.compareTables(createTable("foo"), createTable("foo"));

    // Adapted parity: local comparator still returns a diff object even when empty.
    expect(diff).not.toBeNull();
    expect(diff?.hasChanges()).toBe(false);
  });

  it("matches tables case-insensitively when comparing schemas (Doctrine AbstractComparatorTestCase parity)", () => {
    const comparator = new Comparator();
    const oldSchema = new Schema([createTable("Foo")]);
    const newSchema = new Schema([createTable("foo")]);

    const diff = comparator.compareSchemas(oldSchema, newSchema);

    expect(diff.getCreatedTables()).toEqual([]);
    expect(diff.getDroppedTables()).toEqual([]);
    expect(diff.getAlteredTables()).toEqual([]);
  });

  it("matches sequences case-insensitively when comparing schemas (Doctrine AbstractComparatorTestCase parity)", () => {
    const comparator = new Comparator();
    const oldSchema = new Schema([], [new Sequence("Foo_Seq")]);
    const newSchema = new Schema([], [new Sequence("foo_seq")]);

    const diff = comparator.compareSchemas(oldSchema, newSchema);

    expect(diff.getCreatedSequences()).toEqual([]);
    expect(diff.getDroppedSequences()).toEqual([]);
    expect(diff.getAlteredSequences()).toEqual([]);
  });

  it("detects renamed indexes when enabled", () => {
    const prototype = new Table("foo");
    prototype.addColumn("foo", Types.INTEGER);

    const tableA = prototype.edit().setIndexes().create();
    tableA.addIndex(["foo"], "idx_foo");

    const tableB = prototype.edit().setIndexes().create();
    tableB.addIndex(["foo"], "idx_bar");

    const comparator = new Comparator(
      new ComparatorConfig({ detectIndexRenames: true, reportModifiedIndexes: false }),
    );
    const tableDiff = comparator.compareTables(tableA, tableB);

    expect(tableDiff).not.toBeNull();
    expect(tableDiff?.getAddedIndexes()).toHaveLength(0);
    expect(tableDiff?.getDroppedIndexes()).toHaveLength(0);
    expect(Object.keys(tableDiff?.getRenamedIndexes() ?? {})).toEqual(["idx_foo"]);
    expect(tableDiff?.getRenamedIndexes().idx_foo?.getName()).toBe("idx_bar");
  });

  it("does not detect renamed indexes when disabled", () => {
    const tableA = new Table("foo");
    tableA.addColumn("foo", Types.INTEGER);
    tableA.addIndex(["foo"], "idx_foo");

    const tableB = new Table("foo");
    tableB.addColumn("foo", Types.INTEGER);
    tableB.addIndex(["foo"], "idx_bar");

    const comparator = new Comparator(
      new ComparatorConfig({ detectIndexRenames: false, reportModifiedIndexes: false }),
    );
    const tableDiff = comparator.compareTables(tableA, tableB);

    expect(tableDiff?.getAddedIndexes().map((index) => index.getName())).toEqual(["idx_bar"]);
    expect(tableDiff?.getDroppedIndexes().map((index) => index.getName())).toEqual(["idx_foo"]);
    expect(tableDiff?.getRenamedIndexes()).toEqual({});
  });

  it("does not detect ambiguous renamed indexes", () => {
    const tableA = new Table("foo");
    tableA.addColumn("foo", Types.INTEGER);
    tableA.addIndex(["foo"], "idx_foo");
    tableA.addIndex(["foo"], "idx_bar");

    const tableB = new Table("foo");
    tableB.addColumn("foo", Types.INTEGER);
    tableB.addIndex(["foo"], "idx_baz");

    const comparator = new Comparator(
      new ComparatorConfig({ detectIndexRenames: true, reportModifiedIndexes: false }),
    );
    const tableDiff = comparator.compareTables(tableA, tableB);

    expect(tableDiff?.getAddedIndexes().map((index) => index.getName())).toEqual(["idx_baz"]);
    expect(
      tableDiff
        ?.getDroppedIndexes()
        .map((index) => index.getName())
        .sort(),
    ).toEqual(["idx_bar", "idx_foo"]);
    expect(tableDiff?.getRenamedIndexes()).toEqual({});
  });

  it("reports modified indexes when enabled", () => {
    const tableA = new Table("foo");
    tableA.addColumn("id", Types.INTEGER);
    tableA.addIndex(["id"], "idx_id");

    const tableB = new Table("foo");
    tableB.addColumn("id", Types.INTEGER);
    tableB.addUniqueIndex(["id"], "idx_id");

    const comparator = new Comparator(
      new ComparatorConfig({ detectIndexRenames: false, reportModifiedIndexes: true }),
    );
    const tableDiff = comparator.compareTables(tableA, tableB);

    expect(tableDiff?.getDroppedIndexes()).toHaveLength(0);
    expect(tableDiff?.getAddedIndexes()).toHaveLength(0);
    expect(tableDiff?.getModifiedIndexes().map((index) => index.getName())).toEqual(["idx_id"]);
  });

  it("converts modified indexes to add/drop when modified-index reporting is disabled", () => {
    const tableA = new Table("foo");
    tableA.addColumn("id", Types.INTEGER);
    tableA.addIndex(["id"], "idx_id");

    const tableB = new Table("foo");
    tableB.addColumn("id", Types.INTEGER);
    tableB.addUniqueIndex(["id"], "idx_id");

    const comparator = new Comparator(
      new ComparatorConfig({ detectIndexRenames: false, reportModifiedIndexes: false }),
    );
    const tableDiff = comparator.compareTables(tableA, tableB);

    expect(tableDiff?.getModifiedIndexes()).toHaveLength(0);
    expect(tableDiff?.getAddedIndexes().map((index) => index.getName())).toEqual(["idx_id"]);
    expect(tableDiff?.getDroppedIndexes().map((index) => index.getName())).toEqual(["idx_id"]);
  });

  it("detects renamed columns when enabled", () => {
    const tableA = new Table("foo");
    tableA.addColumn("foo", Types.INTEGER);

    const tableB = new Table("foo");
    tableB.addColumn("bar", Types.INTEGER);

    const comparator = new Comparator(new ComparatorConfig({ detectColumnRenames: true }));
    const tableDiff = comparator.compareTables(tableA, tableB);

    expect(tableDiff?.getAddedColumns()).toHaveLength(0);
    expect(tableDiff?.getDroppedColumns()).toHaveLength(0);

    const renamedColumns = tableDiff?.getRenamedColumns() ?? {};
    expect(Object.keys(renamedColumns)).toEqual(["foo"]);
    expect(renamedColumns.foo?.getName()).toBe("bar");
  });

  it("does not detect renamed columns when disabled", () => {
    const tableA = new Table("foo");
    tableA.addColumn("foo", Types.INTEGER);

    const tableB = new Table("foo");
    tableB.addColumn("bar", Types.INTEGER);

    const comparator = new Comparator(new ComparatorConfig({ detectColumnRenames: false }));
    const tableDiff = comparator.compareTables(tableA, tableB);

    expect(tableDiff?.getAddedColumns().map((column) => column.getName())).toEqual(["bar"]);
    expect(tableDiff?.getDroppedColumns().map((column) => column.getName())).toEqual(["foo"]);
    expect(tableDiff?.getRenamedColumns()).toEqual({});
  });

  it("does not detect ambiguous renamed columns", () => {
    const tableA = new Table("foo");
    tableA.addColumn("foo", Types.INTEGER);
    tableA.addColumn("bar", Types.INTEGER);

    const tableB = new Table("foo");
    tableB.addColumn("baz", Types.INTEGER);

    const comparator = new Comparator(new ComparatorConfig({ detectColumnRenames: true }));
    const tableDiff = comparator.compareTables(tableA, tableB);

    expect(tableDiff?.getAddedColumns().map((column) => column.getName())).toEqual(["baz"]);
    expect(
      tableDiff
        ?.getDroppedColumns()
        .map((column) => column.getName())
        .sort(),
    ).toEqual(["bar", "foo"]);
    expect(tableDiff?.getRenamedColumns()).toEqual({});
  });

  it("treats same-name changed foreign keys as drop+add", () => {
    const tableA = new Table("foo");
    tableA.addColumn("fk", Types.INTEGER);
    tableA.addForeignKeyConstraint("bar", ["fk"], ["id"], {}, "fk_bar");

    const tableB = new Table("foo");
    tableB.addColumn("fk", Types.INTEGER);
    tableB.addForeignKeyConstraint("bar", ["fk"], ["id"], { onUpdate: "CASCADE" }, "fk_bar");

    const tableDiff = new Comparator(
      new ComparatorConfig({ detectColumnRenames: true }),
    ).compareTables(tableA, tableB);

    expect(tableDiff?.getDroppedForeignKeys()).toHaveLength(1);
    expect(tableDiff?.getAddedForeignKeys()).toHaveLength(1);
    expect(tableDiff?.getDroppedForeignKeys()[0]?.getName()).toBe("fk_bar");
    expect(tableDiff?.getAddedForeignKeys()[0]?.getName()).toBe("fk_bar");
  });

  it("compares foreign keys by properties not name and ignores FK/local-column case differences", () => {
    const tableA = new Table("foo");
    tableA.addColumn("id", Types.INTEGER);
    tableA.addForeignKeyConstraint("bar", ["id"], ["id"], {}, "foo_constraint");

    const tableB = new Table("foo");
    tableB.addColumn("ID", Types.INTEGER);
    tableB.addForeignKeyConstraint("bar", ["id"], ["id"], {}, "bar_constraint");

    const tableDiff = new Comparator(
      new ComparatorConfig({ detectColumnRenames: true }),
    ).compareTables(tableA, tableB);

    expect(tableDiff?.getAddedForeignKeys()).toHaveLength(0);
    expect(tableDiff?.getDroppedForeignKeys()).toHaveLength(0);
    expect(tableDiff?.hasChanges()).toBe(false);
  });

  it("detects a single renamed column when multiple new columns are added (Doctrine matrix)", () => {
    const tableA = new Table("foo");
    tableA.addColumn("datecolumn1", Types.DATETIME_MUTABLE);

    const tableB = new Table("foo");
    tableB.addColumn("new_datecolumn1", Types.DATETIME_MUTABLE);
    tableB.addColumn("new_datecolumn2", Types.DATETIME_MUTABLE);

    const tableDiff = new Comparator(
      new ComparatorConfig({ detectColumnRenames: true }),
    ).compareTables(tableA, tableB);

    const renamedColumns = tableDiff?.getRenamedColumns() ?? {};
    expect(Object.keys(renamedColumns)).toEqual(["datecolumn1"]);
    expect(tableDiff?.getAddedColumns().map((column) => column.getName())).toEqual([
      "new_datecolumn2",
    ]);
    expect(tableDiff?.getDroppedColumns()).toHaveLength(0);
    expect(tableDiff?.getChangedColumns()).toHaveLength(1);
  });

  it("treats moved foreign-key target table as drop+add", () => {
    const tableA = new Table("foo");
    tableA.addColumn("fk", Types.INTEGER);
    tableA.addForeignKeyConstraint("bar", ["fk"], ["id"], {}, "fk_bar");

    const tableB = new Table("foo");
    tableB.addColumn("fk", Types.INTEGER);
    tableB.addForeignKeyConstraint("bar2", ["fk"], ["id"], {}, "fk_bar2");

    const tableDiff = new Comparator().compareTables(tableA, tableB);

    expect(tableDiff?.getDroppedForeignKeys()).toHaveLength(1);
    expect(tableDiff?.getAddedForeignKeys()).toHaveLength(1);
    expect(tableDiff?.getAddedForeignKeys()[0]?.getForeignTableName()).toBe("bar2");
  });

  it("treats column-name case differences as no column diff (Doctrine matrix)", () => {
    const tableA = new Table("foo");
    tableA.addColumn("id", Types.INTEGER);

    const tableB = new Table("foo");
    tableB.addColumn("ID", Types.INTEGER);

    const tableDiff = new Comparator(
      new ComparatorConfig({ detectColumnRenames: true }),
    ).compareTables(tableA, tableB);

    expect(tableDiff).not.toBeNull();
    expect(tableDiff?.hasChanges()).toBe(false);
  });

  it("matches FQN table names against the schema default namespace", () => {
    const config = new SchemaConfig().setName("foo");
    const oldSchema = new Schema([createTable("bar")], [], config);
    const newSchema = new Schema([createTable("foo.bar")], [], config);

    const diff = new Comparator().compareSchemas(oldSchema, newSchema);

    expect(diff.isEmpty()).toBe(true);
  });

  it("matches same table when one schema uses explicit default namespace and the other does not", () => {
    const config = new SchemaConfig().setName("foo");

    const oldSchema = new Schema([], [], config);
    oldSchema.createTable("foo.bar");

    const newSchema = new Schema();
    newSchema.createTable("bar");

    const diff = new Comparator().compareSchemas(oldSchema, newSchema);

    expect(diff.isEmpty()).toBe(true);
  });

  it("matches same bare table with and without schema config default namespace", () => {
    const config = new SchemaConfig().setName("foo");
    const oldSchema = new Schema([createTable("bar")], [], config);
    const newSchema = new Schema([createTable("bar")]);

    const diff = new Comparator().compareSchemas(oldSchema, newSchema);

    expect(diff.isEmpty()).toBe(true);
  });

  it("reports created namespaces from namespaced tables (Doctrine matrix)", () => {
    const config = new SchemaConfig().setName("schemaName");

    const oldSchema = new Schema([createTable("taz"), createTable("war.tab")], [], config);
    const newSchema = new Schema(
      [createTable("bar.tab"), createTable("baz.tab"), createTable("war.tab")],
      [],
      config,
    );

    const diff = new Comparator().compareSchemas(oldSchema, newSchema);

    expect([...diff.getCreatedSchemas()].sort()).toEqual(["bar", "baz"]);
    expect(diff.getCreatedTables()).toHaveLength(2);
  });

  it("compares explicit namespace lists", () => {
    const oldSchema = new Schema([], [], new SchemaConfig(), ["foo", "bar"]);
    const newSchema = new Schema([], [], new SchemaConfig(), ["bar", "baz"]);

    const diff = new Comparator().compareSchemas(oldSchema, newSchema);

    expect(diff.getCreatedSchemas()).toEqual(["baz"]);
    expect(diff.getDroppedSchemas()).toEqual(["foo"]);
  });

  it("ignores dropped auto-increment helper sequences", () => {
    const table = createAutoincrementPkTable("foo");
    const oldSchema = new Schema([table]);
    oldSchema.createSequence("foo_id_seq");

    const newSchema = new Schema([createAutoincrementPkTable("foo")]);

    const diff = new Comparator().compareSchemas(oldSchema, newSchema);

    expect(diff.getDroppedSequences()).toHaveLength(0);
  });

  it("ignores added auto-increment helper sequences", () => {
    const oldSchema = new Schema([createAutoincrementPkTable("foo")]);

    const newSchema = new Schema([createAutoincrementPkTable("foo")]);
    newSchema.createSequence("foo_id_seq");

    const diff = new Comparator().compareSchemas(oldSchema, newSchema);

    expect(diff.getCreatedSequences()).toHaveLength(0);
  });

  it("retains added FK when local FK column is also effectively renamed across schema diff", () => {
    const oldSchema = new Schema([
      createTable("table1"),
      (() => {
        const table = new Table("table2");
        table.addColumn("id", Types.INTEGER);
        table.addColumn("id_table1", Types.INTEGER);
        table.addForeignKeyConstraint("table1", ["id_table1"], ["fk_table2_table1"]);
        return table;
      })(),
    ]);

    const newSchema = new Schema([
      (() => {
        const table = new Table("table2");
        table.addColumn("id", Types.INTEGER);
        table.addColumn("id_table3", Types.INTEGER);
        table.addForeignKeyConstraint("table3", ["id_table3"], ["id"], {}, "fk_table2_table3");
        return table;
      })(),
      createTable("table3"),
    ]);

    const schemaDiff = new Comparator(
      new ComparatorConfig({ detectColumnRenames: true }),
    ).compareSchemas(oldSchema, newSchema);

    const alteredTables = schemaDiff.getAlteredTables();
    expect(alteredTables).toHaveLength(1);

    const addedForeignKeys = alteredTables[0]?.getAddedForeignKeys() ?? [];
    expect(addedForeignKeys).toHaveLength(1);
    expect(addedForeignKeys[0]?.getForeignTableName()).toBe("table3");
  });

  it("does not produce a schema diff when only columnDefinition changes from null to defined", () => {
    const oldSchema = new Schema([
      (() => {
        const table = new Table("a_table");
        table.addColumn("is_default", Types.STRING, { length: 32 });
        return table;
      })(),
    ]);

    const newSchema = new Schema([
      (() => {
        const table = new Table("a_table");
        table.addColumn("is_default", Types.STRING, {
          columnDefinition: "ENUM('default')",
          length: 32,
        });
        return table;
      })(),
    ]);

    expect(new Comparator().compareSchemas(oldSchema, newSchema).getAlteredTables()).toEqual([]);
  });
});
