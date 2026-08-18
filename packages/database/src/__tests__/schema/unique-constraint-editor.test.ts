import { describe, expect, it } from "vitest";

import { InvalidUniqueConstraintDefinition } from "../../schema/exception/invalid-unique-constraint-definition";
import { UniqueConstraint } from "../../schema/unique-constraint";

describe("Schema/UniqueConstraintEditor (Doctrine parity, supported scenarios)", () => {
  it("throws when column names are empty", () => {
    expect(() => UniqueConstraint.editor().create()).toThrow(InvalidUniqueConstraintDefinition);
  });

  it("sets an unquoted name", () => {
    const constraint = UniqueConstraint.editor()
      .setUnquotedName("uq_id")
      .setColumnNames("id")
      .create();

    expect(constraint.getObjectName()).toBe("uq_id");
  });

  it("sets a quoted name", () => {
    const constraint = UniqueConstraint.editor()
      .setQuotedName("uq_id")
      .setColumnNames("id")
      .create();

    expect(constraint.getObjectName()).toBe('"uq_id"');
  });

  it("sets unquoted column names", () => {
    const constraint = UniqueConstraint.editor()
      .setUnquotedColumnNames("account_id", "user_id")
      .create();

    expect(constraint.getColumnNames()).toEqual(["account_id", "user_id"]);
  });

  it("sets quoted column names", () => {
    const constraint = UniqueConstraint.editor()
      .setQuotedColumnNames("account_id", "user_id")
      .create();

    expect(constraint.getColumnNames()).toEqual(["account_id", "user_id"]);
  });

  it("sets clustered flag", () => {
    const editor = UniqueConstraint.editor().setUnquotedColumnNames("user_id");

    expect(editor.create().isClustered()).toBe(false);
    expect(editor.setIsClustered(true).create().isClustered()).toBe(true);
  });
});
