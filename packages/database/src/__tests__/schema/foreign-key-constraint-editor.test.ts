import { describe, expect, it } from "vitest";

import { InvalidForeignKeyConstraintDefinition } from "../../schema/exception/invalid-foreign-key-constraint-definition";
import { ForeignKeyConstraint } from "../../schema/foreign-key-constraint";
import { Deferrability } from "../../schema/foreign-key-constraint/deferrability";
import { MatchType } from "../../schema/foreign-key-constraint/match-type";
import { ReferentialAction } from "../../schema/foreign-key-constraint/referential-action";
import { OptionallyQualifiedName } from "../../schema/name/optionally-qualified-name";
import { UnqualifiedName } from "../../schema/name/unqualified-name";

describe("Schema/ForeignKeyConstraintEditor (Doctrine parity, supported scenarios)", () => {
  it("throws when referenced table name is not set", () => {
    const editor = ForeignKeyConstraint.editor()
      .setReferencingColumnNames("id")
      .setReferencedColumnNames("id");

    expect(() => editor.create()).toThrow(InvalidForeignKeyConstraintDefinition);
  });

  it("throws when referencing column names are not set", () => {
    const editor = ForeignKeyConstraint.editor()
      .setReferencedTableName(OptionallyQualifiedName.unquoted("users"))
      .setReferencedColumnNames("id");

    expect(() => editor.create()).toThrow(InvalidForeignKeyConstraintDefinition);
  });

  it("throws when referenced column names are not set", () => {
    const editor = ForeignKeyConstraint.editor()
      .setReferencedTableName(OptionallyQualifiedName.unquoted("users"))
      .setReferencingColumnNames("id");

    expect(() => editor.create()).toThrow(InvalidForeignKeyConstraintDefinition);
  });

  it("sets a name (nullable -> named)", () => {
    const editor = createMinimalValidEditor();

    expect(editor.create().getObjectName()).toBeNull();

    const name = UnqualifiedName.unquoted("fk_users_id");
    const constraint = editor.setName(name.toString()).create();

    expect(constraint.getObjectName()).toEqual(name);
  });

  it("sets an unquoted name", () => {
    const constraint = createMinimalValidEditor().setUnquotedName("fk_users_id").create();

    expect(constraint.getObjectName()).toEqual(UnqualifiedName.unquoted("fk_users_id"));
  });

  it("sets a quoted name", () => {
    const constraint = createMinimalValidEditor().setQuotedName("fk_users_id").create();

    expect(constraint.getObjectName()).toEqual(UnqualifiedName.quoted("fk_users_id"));
  });

  it("sets unquoted referencing column names", () => {
    const constraint = ForeignKeyConstraint.editor()
      .setUnquotedReferencingColumnNames("account_id", "user_id")
      .setReferencedTableName(OptionallyQualifiedName.unquoted("users"))
      .setUnquotedReferencedColumnNames("unused1", "unused2")
      .create();

    expect(constraint.getReferencingColumnNames()).toEqual(["account_id", "user_id"]);
  });

  it("sets quoted referencing column names", () => {
    const constraint = ForeignKeyConstraint.editor()
      .setQuotedReferencingColumnNames("account_id", "user_id")
      .setReferencedTableName(OptionallyQualifiedName.unquoted("users"))
      .setQuotedReferencedColumnNames("unused1", "unused2")
      .create();

    expect(constraint.getReferencingColumnNames()).toEqual(['"account_id"', '"user_id"']);
  });

  it("sets an unquoted referenced table name", () => {
    const constraint = ForeignKeyConstraint.editor()
      .setReferencingColumnNames("id")
      .setUnquotedReferencedTableName("users", "public")
      .setReferencedColumnNames("id")
      .create();

    expect(constraint.getReferencedTableName()).toEqual(
      OptionallyQualifiedName.unquoted("users", "public"),
    );
  });

  it("sets a quoted referenced table name", () => {
    const constraint = ForeignKeyConstraint.editor()
      .setReferencingColumnNames("id")
      .setQuotedReferencedTableName("users", "public")
      .setReferencedColumnNames("id")
      .create();

    expect(constraint.getReferencedTableName()).toEqual(
      OptionallyQualifiedName.quoted("users", "public"),
    );
  });

  it("sets unquoted referenced column names", () => {
    const constraint = ForeignKeyConstraint.editor()
      .setUnquotedReferencingColumnNames("unused1", "unused2")
      .setReferencedTableName(OptionallyQualifiedName.unquoted("users"))
      .setUnquotedReferencedColumnNames("account_id", "id")
      .create();

    expect(constraint.getReferencedColumnNames()).toEqual(["account_id", "id"]);
  });

  it("sets quoted referenced column names", () => {
    const constraint = ForeignKeyConstraint.editor()
      .setQuotedReferencingColumnNames("unused1", "unused2")
      .setReferencedTableName(OptionallyQualifiedName.unquoted("users"))
      .setQuotedReferencedColumnNames("account_id", "id")
      .create();

    expect(constraint.getReferencedColumnNames()).toEqual(['"account_id"', '"id"']);
  });

  it("sets match type", () => {
    const editor = createMinimalValidEditor();

    expect(editor.create().getMatchType()).toBe(MatchType.SIMPLE);
    expect(editor.setMatchType(MatchType.FULL).create().getMatchType()).toBe(MatchType.FULL);
  });

  it("sets on update action", () => {
    const editor = createMinimalValidEditor();

    expect(editor.create().getOnUpdateAction()).toBe(ReferentialAction.NO_ACTION);
    expect(editor.setOnUpdateAction(ReferentialAction.CASCADE).create().getOnUpdateAction()).toBe(
      ReferentialAction.CASCADE,
    );
  });

  it("sets on delete action", () => {
    const editor = createMinimalValidEditor();

    expect(editor.create().getOnDeleteAction()).toBe(ReferentialAction.NO_ACTION);
    expect(editor.setOnDeleteAction(ReferentialAction.CASCADE).create().getOnDeleteAction()).toBe(
      ReferentialAction.CASCADE,
    );
  });

  it("sets deferrability", () => {
    const editor = createMinimalValidEditor();

    expect(editor.create().getDeferrability()).toBe(Deferrability.NOT_DEFERRABLE);
    expect(editor.setDeferrability(Deferrability.DEFERRABLE).create().getDeferrability()).toBe(
      Deferrability.DEFERRABLE,
    );
  });
});

function createMinimalValidEditor() {
  return ForeignKeyConstraint.editor()
    .setReferencedTableName(OptionallyQualifiedName.unquoted("users"))
    .setReferencingColumnNames("id")
    .setReferencedColumnNames("id");
}
