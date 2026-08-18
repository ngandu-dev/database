import { describe, expect, it } from "vitest";

import { InvalidIdentifier } from "../../../schema/exception/invalid-identifier";
import { Identifier } from "../../../schema/name/identifier";
import { UnquotedIdentifierFolding } from "../../../schema/name/unquoted-identifier-folding";

describe("Schema/Name/Identifier (Doctrine parity)", () => {
  it("does not allow empty identifiers", () => {
    expect(() => Identifier.unquoted("")).toThrow(InvalidIdentifier);
  });

  it.each([
    [Identifier.unquoted("id"), "id"],
    [Identifier.quoted("name"), '"name"'],
    [Identifier.quoted('"value"'), '"""value"""'],
  ])("renders string form", (identifier, expected) => {
    expect(identifier.toString()).toBe(expected);
  });

  it("equals itself", () => {
    const identifier = Identifier.unquoted("id");
    expect(identifier.equals(identifier, UnquotedIdentifierFolding.NONE)).toBe(true);
  });

  it.each([
    [Identifier.unquoted("id"), Identifier.unquoted("id"), UnquotedIdentifierFolding.NONE],
    [Identifier.quoted("id"), Identifier.quoted("id"), UnquotedIdentifierFolding.NONE],
    [Identifier.quoted("id"), Identifier.unquoted("ID"), UnquotedIdentifierFolding.LOWER],
    [Identifier.quoted("ID"), Identifier.unquoted("id"), UnquotedIdentifierFolding.UPPER],
  ])("compares equal identifiers", (a, b, folding) => {
    expect(a.equals(b, folding)).toBe(true);
    expect(b.equals(a, folding)).toBe(true);
  });

  it.each([
    [Identifier.unquoted("foo"), Identifier.unquoted("bar"), UnquotedIdentifierFolding.NONE],
    [Identifier.unquoted("id"), Identifier.unquoted("ID"), UnquotedIdentifierFolding.NONE],
    [Identifier.quoted("id"), Identifier.quoted("ID"), UnquotedIdentifierFolding.LOWER],
    [Identifier.quoted("ID"), Identifier.quoted("id"), UnquotedIdentifierFolding.UPPER],
  ])("compares unequal identifiers", (a, b, folding) => {
    expect(a.equals(b, folding)).toBe(false);
    expect(b.equals(a, folding)).toBe(false);
  });
});
