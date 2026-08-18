import { describe, expect, it } from "vitest";

import { InvalidPrimaryKeyConstraintDefinition } from "../../schema/exception/invalid-primary-key-constraint-definition";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";

describe("Schema/PrimaryKeyConstraintEditor (Doctrine parity, supported scenarios)", () => {
  it("throws when column names are not set", () => {
    const editor = PrimaryKeyConstraint.editor();

    expect(() => editor.create()).toThrow(InvalidPrimaryKeyConstraintDefinition);
  });

  it("sets an unquoted name", () => {
    const constraint = PrimaryKeyConstraint.editor()
      .setUnquotedName("pk_users")
      .setColumnNames("id")
      .create();

    expect(constraint.getObjectName()).toBe("pk_users");
  });

  it("sets a quoted name", () => {
    const constraint = PrimaryKeyConstraint.editor()
      .setQuotedName("pk_users")
      .setColumnNames("id")
      .create();

    expect(constraint.getObjectName()).toBe('"pk_users"');
  });

  it("sets unquoted column names", () => {
    const constraint = PrimaryKeyConstraint.editor()
      .setUnquotedColumnNames("account_id", "user_id")
      .create();

    expect(constraint.getColumnNames()).toEqual(["account_id", "user_id"]);
  });

  it("sets quoted column names", () => {
    const constraint = PrimaryKeyConstraint.editor()
      .setQuotedColumnNames("account_id", "user_id")
      .create();

    expect(constraint.getColumnNames()).toEqual(['"account_id"', '"user_id"']);
  });

  it("defaults to clustered and supports disabling clustered", () => {
    let constraint = PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create();

    expect(constraint.isClustered()).toBe(true);

    constraint = constraint.edit().setIsClustered(false).create();
    expect(constraint.isClustered()).toBe(false);
  });
});
