import { describe, expect, it } from "vitest";

import { Identifier as NameIdentifier } from "../../schema/name/identifier";
import { Sequence } from "../../schema/sequence";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";

describe("Schema/Sequence (Doctrine parity)", () => {
  it("detects auto-increment sequences for a table", () => {
    const table = new Table("foo");
    table.addColumn("id", Types.INTEGER, { autoincrement: true });
    table.setPrimaryKey(["id"]);

    const sequence1 = Sequence.editor().setUnquotedName("foo_id_seq").create();
    const sequence2 = Sequence.editor().setUnquotedName("bar_id_seq").create();
    const sequence3 = Sequence.editor().setUnquotedName("foo_id_seq", "other").create();

    expect(sequence1.isAutoIncrementsFor(table)).toBe(true);
    expect(sequence2.isAutoIncrementsFor(table)).toBe(false);
    expect(sequence3.isAutoIncrementsFor(table)).toBe(false);
  });

  it("detects auto-increment sequences case-insensitively", () => {
    const table = new Table("foo");
    table.addColumn("ID", Types.INTEGER, { autoincrement: true });
    table.setPrimaryKey(["ID"]);

    const exact = Sequence.editor().setUnquotedName("foo_id_seq").create();
    const mixed = Sequence.editor().setUnquotedName("foo_ID_seq").create();
    const wrongTable = Sequence.editor().setUnquotedName("bar_id_seq").create();
    const wrongTableMixed = Sequence.editor().setUnquotedName("bar_ID_seq").create();
    const wrongSchema = Sequence.editor().setUnquotedName("foo_id_seq", "other").create();

    expect(exact.isAutoIncrementsFor(table)).toBe(true);
    expect(mixed.isAutoIncrementsFor(table)).toBe(true);
    expect(wrongTable.isAutoIncrementsFor(table)).toBe(false);
    expect(wrongTableMixed.isAutoIncrementsFor(table)).toBe(false);
    expect(wrongSchema.isAutoIncrementsFor(table)).toBe(false);
  });

  it("parses unqualified object names", () => {
    const sequence = new Sequence("user_id_seq");
    const name = sequence.getObjectName();

    expect(name.getUnqualifiedName()).toEqual(NameIdentifier.unquoted("user_id_seq"));
    expect(name.getQualifier()).toBeNull();
  });

  it("parses qualified object names", () => {
    const sequence = new Sequence("auth.user_id_seq");
    const name = sequence.getObjectName();

    expect(name.getUnqualifiedName()).toEqual(NameIdentifier.unquoted("user_id_seq"));
    expect(name.getQualifier()).toEqual(NameIdentifier.unquoted("auth"));
  });
});
