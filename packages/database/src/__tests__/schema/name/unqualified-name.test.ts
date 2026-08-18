import { describe, expect, it } from "vitest";

import { UnqualifiedName } from "../../../schema/name/unqualified-name";
import { UnquotedIdentifierFolding } from "../../../schema/name/unquoted-identifier-folding";

describe("Schema/Name/UnqualifiedName (Doctrine parity)", () => {
  it("creates quoted names", () => {
    const name = UnqualifiedName.quoted("id");
    const identifier = name.getIdentifier();

    expect(identifier.isQuoted()).toBe(true);
    expect(identifier.getValue()).toBe("id");
    expect(name.toString()).toBe('"id"');
  });

  it("creates unquoted names", () => {
    const name = UnqualifiedName.unquoted("id");
    const identifier = name.getIdentifier();

    expect(identifier.isQuoted()).toBe(false);
    expect(identifier.getValue()).toBe("id");
    expect(name.toString()).toBe("id");
  });

  it("equals itself", () => {
    const name = UnqualifiedName.unquoted("id");
    expect(name.equals(name, UnquotedIdentifierFolding.NONE)).toBe(true);
  });

  it("compares equal names", () => {
    const a = UnqualifiedName.unquoted("id");
    const b = UnqualifiedName.unquoted("id");

    expect(a.equals(b, UnquotedIdentifierFolding.NONE)).toBe(true);
    expect(b.equals(a, UnquotedIdentifierFolding.NONE)).toBe(true);
  });

  it("compares unequal names", () => {
    const a = UnqualifiedName.unquoted("id");
    const b = UnqualifiedName.unquoted("name");

    expect(a.equals(b, UnquotedIdentifierFolding.NONE)).toBe(false);
    expect(b.equals(a, UnquotedIdentifierFolding.NONE)).toBe(false);
  });
});
