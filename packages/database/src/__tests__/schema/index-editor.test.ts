import { describe, expect, it } from "vitest";

import { InvalidIndexDefinition } from "../../schema/exception/invalid-index-definition";
import { Index } from "../../schema/index";
import { IndexedColumn } from "../../schema/index/indexed-column";
import { UnqualifiedName } from "../../schema/name/unqualified-name";

describe("Schema/IndexEditor (Doctrine parity)", () => {
  it("throws when name is not set", () => {
    const editor = Index.editor().setUnquotedColumnNames("id");

    expect(() => editor.create()).toThrow(InvalidIndexDefinition);
  });

  it("throws when columns are not set", () => {
    const editor = Index.editor().setUnquotedName("idx_user_id");

    expect(() => editor.create()).toThrow(InvalidIndexDefinition);
  });

  it("sets an unquoted name", () => {
    const index = Index.editor().setUnquotedName("idx_id").setUnquotedColumnNames("id").create();

    expect(index.getObjectName()).toEqual(UnqualifiedName.unquoted("idx_id"));
  });

  it("sets a quoted name", () => {
    const index = Index.editor().setQuotedName("idx_id").setUnquotedColumnNames("id").create();

    expect(index.getObjectName()).toEqual(UnqualifiedName.quoted("idx_id"));
  });

  it("sets unquoted column names", () => {
    const index = Index.editor()
      .setUnquotedName("idx")
      .setUnquotedColumnNames("account_id", "user_id")
      .create();

    const indexedColumns = index.getIndexedColumns();

    expect(indexedColumns).toHaveLength(2);
    expect(indexedColumns[0]?.getColumnName()).toEqual(UnqualifiedName.unquoted("account_id"));
    expect(indexedColumns[1]?.getColumnName()).toEqual(UnqualifiedName.unquoted("user_id"));
  });

  it("sets quoted column names", () => {
    const index = Index.editor()
      .setUnquotedName("idx")
      .setQuotedColumnNames("account_id", "user_id")
      .create();

    const indexedColumns = index.getIndexedColumns();

    expect(indexedColumns).toHaveLength(2);
    expect(indexedColumns[0]?.getColumnName()).toEqual(UnqualifiedName.quoted("account_id"));
    expect(indexedColumns[1]?.getColumnName()).toEqual(UnqualifiedName.quoted("user_id"));
  });

  it("accepts IndexedColumn objects via addColumn()", () => {
    const index = Index.editor()
      .setUnquotedName("idx")
      .addColumn(new IndexedColumn(UnqualifiedName.unquoted("id")))
      .create();

    expect(index.getIndexedColumns()).toHaveLength(1);
    expect(index.getIndexedColumns()[0]?.getColumnName()).toEqual(UnqualifiedName.unquoted("id"));
  });

  it("preserves regular index properties through edit()", () => {
    const index1 = new Index("idx_user_name", ["user_name"], false, false, [], {
      lengths: [32],
      where: "is_active = 1",
    });

    const index2 = index1.edit().create();

    expect(index2.getObjectName()).toEqual(UnqualifiedName.unquoted("idx_user_name"));
    expect(index2.getColumns()).toEqual(["user_name"]);
    expect(index2.isUnique()).toBe(false);
    expect(index2.isPrimary()).toBe(false);
    expect(index2.getFlags()).toEqual([]);
    expect(index2.getOptions()).toEqual({
      lengths: [32],
      where: "is_active = 1",
    });
  });

  it.each([
    ["fulltext"],
    ["spatial"],
    ["clustered"],
  ])("preserves flag %s through edit()", (flag) => {
    const index1 = new Index("idx_test", ["test"], false, false, [flag]);
    const index2 = index1.edit().create();

    expect(index2.getFlags()).toEqual([flag]);
  });
});
