import { describe, expect, it } from "vitest";

import { InvalidState } from "../../schema/exception/invalid-state";
import { Index } from "../../schema/index";
import { IndexType } from "../../schema/index/index-type";
import { UnqualifiedName } from "../../schema/name/unqualified-name";

function createIndex(
  unique = false,
  primary = false,
  options: Record<string, unknown> = {},
): Index {
  return new Index("foo", ["bar", "baz"], unique, primary, [], options);
}

describe("Schema/Index (Doctrine parity, supported scenarios)", () => {
  it("creates a regular index", () => {
    const index = createIndex();

    expect(index.getObjectName()).toEqual(UnqualifiedName.unquoted("foo"));
    expect(index.getColumns()).toEqual(["bar", "baz"]);
    expect(index.isUnique()).toBe(false);
    expect(index.isPrimary()).toBe(false);
  });

  it("creates primary and unique indexes", () => {
    const primary = createIndex(false, true);
    const unique = createIndex(true, false);

    expect(primary.isUnique()).toBe(true);
    expect(primary.isPrimary()).toBe(true);

    expect(unique.isUnique()).toBe(true);
    expect(unique.isPrimary()).toBe(false);
  });

  it("checks fulfillment for regular/unique/primary indexes", () => {
    const regular = createIndex();
    const regular2 = createIndex();
    const unique = createIndex(true, false);
    const unique2 = createIndex(true, false);
    const primary = createIndex(true, true);
    const primary2 = createIndex(true, true);

    expect(regular.isFulfilledBy(regular2)).toBe(true);
    expect(regular.isFulfilledBy(unique)).toBe(true);
    expect(regular.isFulfilledBy(primary)).toBe(true);

    expect(unique.isFulfilledBy(unique2)).toBe(true);
    expect(unique.isFulfilledBy(regular)).toBe(false);

    expect(primary.isFulfilledBy(primary2)).toBe(true);
    expect(primary.isFulfilledBy(unique)).toBe(false);
  });

  it("handles flags and clustered state", () => {
    const index = createIndex();

    expect(index.hasFlag("clustered")).toBe(false);
    expect(index.getFlags()).toEqual([]);

    index.addFlag("clustered");
    expect(index.hasFlag("clustered")).toBe(true);
    expect(index.hasFlag("CLUSTERED")).toBe(true);
    expect(index.getFlags()).toEqual(["clustered"]);
    expect(index.isClustered()).toBe(true);

    index.removeFlag("clustered");
    expect(index.hasFlag("clustered")).toBe(false);
    expect(index.getFlags()).toEqual([]);
    expect(index.isClustered()).toBe(false);
  });

  it("normalizes quoted columns in span and position checks", () => {
    const index = new Index("foo", ["`bar`", "`baz`"]);

    expect(index.spansColumns(["bar", "baz"])).toBe(true);
    expect(index.hasColumnAtPosition("bar", 0)).toBe(true);
    expect(index.hasColumnAtPosition("baz", 1)).toBe(true);
    expect(index.hasColumnAtPosition("bar", 1)).toBe(false);
    expect(index.hasColumnAtPosition("baz", 0)).toBe(false);
  });

  it("supports case-insensitive option access", () => {
    const without = createIndex();
    const withWhere = createIndex(false, false, { where: "name IS NULL" });

    expect(without.hasOption("where")).toBe(false);
    expect(without.getOptions()).toEqual({});

    expect(withWhere.hasOption("where")).toBe(true);
    expect(withWhere.hasOption("WHERE")).toBe(true);
    expect(withWhere.getOption("where")).toBe("name IS NULL");
    expect(withWhere.getOption("WHERE")).toBe("name IS NULL");
    expect(withWhere.getOptions()).toEqual({ where: "name IS NULL" });
  });

  it("infers index types and predicate for supported combinations", () => {
    expect(new Index("i1", ["user_id"]).getType()).toBe(IndexType.REGULAR);
    expect(new Index("i2", ["user_id"], true).getType()).toBe(IndexType.UNIQUE);
    expect(new Index("i3", ["user_id"], false, false, ["fulltext"]).getType()).toBe(
      IndexType.FULLTEXT,
    );
    expect(new Index("i4", ["user_id"], false, false, ["spatial"]).getType()).toBe(
      IndexType.SPATIAL,
    );

    expect(
      new Index("i5", ["user_id"], false, false, [], { where: null }).getPredicate(),
    ).toBeNull();
    expect(
      new Index("i6", ["user_id"], false, false, [], { where: "is_active = 1" }).getPredicate(),
    ).toBe("is_active = 1");
  });

  it("builds indexed columns with length metadata", () => {
    const index = new Index("idx_user_name", ["first_name", "last_name"], false, false, [], {
      lengths: [16],
    });

    const indexedColumns = index.getIndexedColumns();

    expect(indexedColumns).toHaveLength(2);
    expect(indexedColumns[0]?.getColumnName().toString()).toBe("first_name");
    expect(indexedColumns[0]?.getLength()).toBe(16);
    expect(indexedColumns[1]?.getColumnName().toString()).toBe("last_name");
    expect(indexedColumns[1]?.getLength()).toBeNull();
  });

  it("respects partial-index predicates when checking fulfillment", () => {
    const without = new Index("without", ["col1", "col2"], true, false, [], {});
    const partial = new Index("partial", ["col1", "col2"], true, false, [], {
      where: "col1 IS NULL",
    });
    const another = new Index("another", ["col1", "col2"], true, false, [], {
      where: "col1 IS NULL",
    });

    expect(partial.isFulfilledBy(without)).toBe(false);
    expect(without.isFulfilledBy(partial)).toBe(false);
    expect(partial.isFulfilledBy(another)).toBe(true);
    expect(another.isFulfilledBy(partial)).toBe(true);
  });

  it.each([
    [["column"], [], [], true],
    [["column"], [64], [64], true],
    [["column"], [32], [64], false],
    [["column1", "column2"], [32], [undefined, 32], false],
    [["column1", "column2"], [null, 32], [undefined, 32], true],
  ])("checks fulfillment with indexed column lengths %#", (columns, lengths1, lengths2, expected) => {
    const index1 = new Index("index1", columns, false, false, [], { lengths: lengths1 });
    const index2 = new Index("index2", columns, false, false, [], { lengths: lengths2 });

    expect(index1.isFulfilledBy(index2)).toBe(expected);
    expect(index2.isFulfilledBy(index1)).toBe(expected);
  });

  it.each([
    [() => new Index("idx_empty", []).getIndexedColumns()],
    [() => new Index("idx_invalid", ["user.name"]).getIndexedColumns()],
    [() => new Index("primary", ["id"], false, true, [], { lengths: [32] }).getIndexedColumns()],
    [
      () =>
        new Index("idx_non_positive", ["name"], false, false, [], {
          lengths: [-1],
        }).getIndexedColumns(),
    ],
  ])("throws InvalidState for invalid indexed-column definitions %#", (call) => {
    expect(call).toThrow(InvalidState);
  });

  it("accepts numeric-string lengths like Doctrine and coerces them when building indexed columns", () => {
    const index = new Index("idx_user_name", ["name"], false, false, [], { lengths: ["8"] });
    expect(index.getIndexedColumns()[0]?.getLength()).toBe(8);
  });

  it.each([
    [new Index("idx_conflict_unique", ["name"], true, false, ["fulltext"]), "unique + fulltext"],
    [
      new Index("idx_conflict_flags", ["name"], false, false, ["fulltext", "spatial"]),
      "fulltext + spatial",
    ],
  ])("throws InvalidState for conflicting type inference (%s)", (index) => {
    expect(() => index.getType()).toThrow(InvalidState);
  });

  it("throws InvalidState for empty predicate", () => {
    const index = new Index("idx_user_name", ["user_id"], false, false, [], { where: "" });
    expect(() => index.getPredicate()).toThrow(InvalidState);
  });
});
