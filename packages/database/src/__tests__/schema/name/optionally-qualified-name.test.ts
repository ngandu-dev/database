import { describe, expect, it } from "vitest";

import { IncomparableNames } from "../../../schema/exception/incomparable-names";
import { OptionallyQualifiedName } from "../../../schema/name/optionally-qualified-name";
import { UnquotedIdentifierFolding } from "../../../schema/name/unquoted-identifier-folding";

describe("Schema/Name/OptionallyQualifiedName (Doctrine parity)", () => {
  it("creates qualified quoted names", () => {
    const name = OptionallyQualifiedName.quoted("customers", "inventory");

    expect(name.getUnqualifiedName().isQuoted()).toBe(true);
    expect(name.getUnqualifiedName().getValue()).toBe("customers");
    expect(name.getQualifier()?.isQuoted()).toBe(true);
    expect(name.getQualifier()?.getValue()).toBe("inventory");
    expect(name.toString()).toBe('"inventory"."customers"');
  });

  it("creates unqualified quoted names", () => {
    const name = OptionallyQualifiedName.quoted("customers");

    expect(name.getUnqualifiedName().isQuoted()).toBe(true);
    expect(name.getUnqualifiedName().getValue()).toBe("customers");
    expect(name.getQualifier()).toBeNull();
    expect(name.toString()).toBe('"customers"');
  });

  it("creates qualified unquoted names", () => {
    const name = OptionallyQualifiedName.unquoted("customers", "inventory");

    expect(name.getUnqualifiedName().isQuoted()).toBe(false);
    expect(name.getUnqualifiedName().getValue()).toBe("customers");
    expect(name.getQualifier()?.isQuoted()).toBe(false);
    expect(name.getQualifier()?.getValue()).toBe("inventory");
    expect(name.toString()).toBe("inventory.customers");
  });

  it("creates unqualified unquoted names", () => {
    const name = OptionallyQualifiedName.unquoted("customers");

    expect(name.getUnqualifiedName().isQuoted()).toBe(false);
    expect(name.getUnqualifiedName().getValue()).toBe("customers");
    expect(name.getQualifier()).toBeNull();
    expect(name.toString()).toBe("customers");
  });

  it("equals itself", () => {
    const name = OptionallyQualifiedName.unquoted("user.id");
    expect(name.equals(name, UnquotedIdentifierFolding.NONE)).toBe(true);
  });

  it.each([
    [OptionallyQualifiedName.unquoted("id"), OptionallyQualifiedName.unquoted("id")],
    [
      OptionallyQualifiedName.unquoted("id", "user"),
      OptionallyQualifiedName.unquoted("id", "user"),
    ],
  ])("compares equal names", (a, b) => {
    expect(a.equals(b, UnquotedIdentifierFolding.NONE)).toBe(true);
    expect(b.equals(a, UnquotedIdentifierFolding.NONE)).toBe(true);
  });

  it.each([
    [OptionallyQualifiedName.unquoted("id"), OptionallyQualifiedName.unquoted("name")],
    [
      OptionallyQualifiedName.unquoted("id", "user"),
      OptionallyQualifiedName.unquoted("name", "user"),
    ],
    [
      OptionallyQualifiedName.unquoted("id", "user"),
      OptionallyQualifiedName.unquoted("id", "order"),
    ],
  ])("compares unequal names", (a, b) => {
    expect(a.equals(b, UnquotedIdentifierFolding.NONE)).toBe(false);
    expect(b.equals(a, UnquotedIdentifierFolding.NONE)).toBe(false);
  });

  it.each([
    [OptionallyQualifiedName.unquoted("id"), OptionallyQualifiedName.unquoted("id", "user")],
    [OptionallyQualifiedName.unquoted("id", "user"), OptionallyQualifiedName.unquoted("id")],
  ])("throws for incomparable names", (a, b) => {
    expect(() => a.equals(b, UnquotedIdentifierFolding.NONE)).toThrow(IncomparableNames);
  });
});
