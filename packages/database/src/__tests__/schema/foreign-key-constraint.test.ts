import { describe, expect, it } from "vitest";

import { InvalidState } from "../../schema/exception/invalid-state";
import { ForeignKeyConstraint } from "../../schema/foreign-key-constraint";
import { Deferrability } from "../../schema/foreign-key-constraint/deferrability";
import { MatchType } from "../../schema/foreign-key-constraint/match-type";
import { ReferentialAction } from "../../schema/foreign-key-constraint/referential-action";
import { Index } from "../../schema/index";
import { Identifier as NameIdentifier } from "../../schema/name/identifier";
import { OptionallyQualifiedName } from "../../schema/name/optionally-qualified-name";

describe("Schema/ForeignKeyConstraint (Doctrine parity, supported scenarios)", () => {
  it.each([
    [["baz"], false],
    [["baz", "bloo"], false],
    [["foo"], true],
    [["bar"], true],
    [["foo", "bar"], true],
    [["bar", "foo"], true],
    [["foo", "baz"], true],
    [["baz", "foo"], true],
    [["bar", "baz"], true],
    [["baz", "bar"], true],
    [["foo", "bloo", "baz"], true],
    [["bloo", "foo", "baz"], true],
    [["bloo", "baz", "foo"], true],
    [["FOO"], true],
  ])("checks index-column intersection for %j", (indexColumns, expectedResult) => {
    const foreignKey = new ForeignKeyConstraint(["foo", "bar"], "foreign_table", [
      "fk_foo",
      "fk_bar",
    ]);
    const index = new Index("foo", indexColumns);

    expect(foreignKey.intersectsIndexColumns(index)).toBe(expectedResult);
  });

  it.each([
    ["schema.foreign_table", "foreign_table"],
    ['schema."foreign_table"', "foreign_table"],
    ['"schema"."foreign_table"', "foreign_table"],
    ["foreign_table", "foreign_table"],
  ])("extracts unqualified foreign table name from %s", (foreignTableName, expectedUnqualified) => {
    const foreignKey = new ForeignKeyConstraint(["foo", "bar"], foreignTableName, [
      "fk_foo",
      "fk_bar",
    ]);

    expect(foreignKey.getUnqualifiedForeignTableName()).toBe(expectedUnqualified);
  });

  it("normalizes RESTRICT and NO ACTION to the same string action", () => {
    const fk1 = new ForeignKeyConstraint(["foo"], "bar", ["baz"], "fk1", { onDelete: "NO ACTION" });
    const fk2 = new ForeignKeyConstraint(["foo"], "bar", ["baz"], "fk1", { onDelete: "RESTRICT" });

    expect(fk1.onDelete()).toBe(fk2.onDelete());
  });

  it("returns a non-null parsed object name", () => {
    const foreignKey = new ForeignKeyConstraint(["user_id"], "users", ["id"], "fk_user_id");
    const name = foreignKey.getObjectName();

    expect(name).not.toBeNull();
    expect(name?.getIdentifier()).toEqual(NameIdentifier.unquoted("fk_user_id"));
  });

  it("returns null object name when unnamed", () => {
    const foreignKey = new ForeignKeyConstraint(["user_id"], "users", ["id"]);

    expect(foreignKey.getObjectName()).toBeNull();
  });

  it.each([
    [{}, Deferrability.NOT_DEFERRABLE],
    [{ deferred: false }, Deferrability.NOT_DEFERRABLE],
    [{ deferred: true }, Deferrability.DEFERRED],
    [{ deferrable: false }, Deferrability.NOT_DEFERRABLE],
    [{ deferrable: false, deferred: false }, Deferrability.NOT_DEFERRABLE],
    [{ deferrable: true }, Deferrability.DEFERRABLE],
    [{ deferrable: true, deferred: false }, Deferrability.DEFERRABLE],
    [{ deferrable: true, deferred: true }, Deferrability.DEFERRED],
  ])("parses deferrability options %j", (options, expected) => {
    const foreignKey = new ForeignKeyConstraint(["user_id"], "users", ["id"], "", options);
    expect(foreignKey.getDeferrability()).toBe(expected);
  });

  it("returns valid default properties", () => {
    const foreignKey = new ForeignKeyConstraint(["user_id"], "users", ["id"], "fk_user_id");

    expect(foreignKey.getReferencingColumnNames()).toEqual(["user_id"]);
    expect(foreignKey.getReferencedTableName()).toEqual(OptionallyQualifiedName.unquoted("users"));
    expect(foreignKey.getReferencedColumnNames()).toEqual(["id"]);
    expect(foreignKey.getMatchType()).toBe(MatchType.SIMPLE);
    expect(foreignKey.getOnUpdateAction()).toBe(ReferentialAction.NO_ACTION);
    expect(foreignKey.getOnDeleteAction()).toBe(ReferentialAction.NO_ACTION);
    expect(foreignKey.getDeferrability()).toBe(Deferrability.NOT_DEFERRABLE);
  });

  it.each([
    [() => new ForeignKeyConstraint([], "users", ["id"]).getReferencingColumnNames()],
    [() => new ForeignKeyConstraint([""], "users", ["id"]).getReferencingColumnNames()],
  ])("throws InvalidState for invalid referencing column names %#", (call) => {
    expect(call).toThrow(InvalidState);
  });

  it("throws InvalidState for invalid referenced table name", () => {
    const foreignKey = new ForeignKeyConstraint(["user_id"], "", ["id"]);
    expect(() => foreignKey.getReferencedTableName()).toThrow(InvalidState);
  });

  it.each([
    [() => new ForeignKeyConstraint(["user_id"], "users", []).getReferencedColumnNames()],
    [() => new ForeignKeyConstraint(["user_id"], "users", [""]).getReferencedColumnNames()],
  ])("throws InvalidState for invalid referenced column names %#", (call) => {
    expect(call).toThrow(InvalidState);
  });

  it("throws InvalidState for invalid match type", () => {
    const foreignKey = new ForeignKeyConstraint(["user_id"], "users", ["id"], "", {
      match: "MAYBE",
    });
    expect(() => foreignKey.getMatchType()).toThrow(InvalidState);
  });

  it.each([
    [
      () =>
        new ForeignKeyConstraint(["user_id"], "users", ["id"], "", {
          onUpdate: "DROP",
        }).getOnUpdateAction(),
    ],
    [
      () =>
        new ForeignKeyConstraint(["user_id"], "users", ["id"], "", {
          onDelete: "DROP",
        }).getOnDeleteAction(),
    ],
  ])("throws InvalidState for invalid referential action %#", (call) => {
    expect(call).toThrow(InvalidState);
  });

  it("throws InvalidState for invalid deferrability combination", () => {
    const foreignKey = new ForeignKeyConstraint(["user_id"], "users", ["id"], "", {
      deferred: true,
      deferrable: false,
    });

    expect(() => foreignKey.getDeferrability()).toThrow(InvalidState);
  });
});
