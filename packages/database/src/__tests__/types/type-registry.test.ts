import { describe, expect, it } from "vitest";

import { BinaryType } from "../../types/binary-type";
import { BlobType } from "../../types/blob-type";
import { TypeAlreadyRegistered } from "../../types/exception/type-already-registered";
import { TypeNotFound } from "../../types/exception/type-not-found";
import { TypeNotRegistered } from "../../types/exception/type-not-registered";
import { TypesAlreadyExists } from "../../types/exception/types-already-exists";
import { UnknownColumnType } from "../../types/exception/unknown-column-type";
import { StringType } from "../../types/string-type";
import { TextType } from "../../types/text-type";
import { TypeRegistry } from "../../types/type-registry";

describe("TypeRegistry parity", () => {
  const TEST_TYPE_NAME = "test";
  const OTHER_TEST_TYPE_NAME = "other";

  function createFixture() {
    const testType = new BlobType();
    const otherTestType = new BinaryType();
    const registry = new TypeRegistry({
      [TEST_TYPE_NAME]: testType,
      [OTHER_TEST_TYPE_NAME]: otherTestType,
    });

    return { registry, testType, otherTestType };
  }

  it("gets registered instances and throws on unknown names", () => {
    const { registry, testType, otherTestType } = createFixture();

    expect(registry.get(TEST_TYPE_NAME)).toBe(testType);
    expect(registry.get(OTHER_TEST_TYPE_NAME)).toBe(otherTestType);
    expect(() => registry.get("unknown")).toThrow(UnknownColumnType);
  });

  it("returns the same instance on repeated get()", () => {
    const { registry } = createFixture();

    expect(registry.get(TEST_TYPE_NAME)).toBe(registry.get(TEST_TYPE_NAME));
  });

  it("looks up names by instance and throws for unregistered instances", () => {
    const { registry, testType, otherTestType } = createFixture();

    expect(registry.lookupName(testType)).toBe(TEST_TYPE_NAME);
    expect(registry.lookupName(otherTestType)).toBe(OTHER_TEST_TYPE_NAME);
    expect(() => registry.lookupName(new TextType())).toThrow(TypeNotRegistered);
  });

  it("reports whether a type name exists", () => {
    const { registry } = createFixture();

    expect(registry.has(TEST_TYPE_NAME)).toBe(true);
    expect(registry.has(OTHER_TEST_TYPE_NAME)).toBe(true);
    expect(registry.has("unknown")).toBe(false);
  });

  it("registers a new type", () => {
    const { registry } = createFixture();
    const newType = new TextType();

    registry.register("some", newType);

    expect(registry.has("some")).toBe(true);
    expect(registry.get("some")).toBe(newType);
  });

  it("rejects duplicate registered names", () => {
    const { registry } = createFixture();

    registry.register("some", new TextType());
    expect(() => registry.register("some", new TextType())).toThrow(TypesAlreadyExists);
  });

  it("rejects duplicate registered instances", () => {
    const { registry } = createFixture();
    const newType = new TextType();

    registry.register("type1", newType);
    expect(() => registry.register("type2", newType)).toThrow(TypeAlreadyRegistered);
  });

  it("rejects duplicate instances passed to the constructor", () => {
    const newType = new TextType();

    expect(() => new TypeRegistry({ a: newType, b: newType })).toThrow(TypeAlreadyRegistered);
  });

  it("overrides an existing type", () => {
    const { registry } = createFixture();
    const baseType = new TextType();
    const overrideType = new StringType();

    registry.register("some", baseType);
    registry.override("some", overrideType);

    expect(registry.get("some")).toBe(overrideType);
  });

  it("allows overriding with the same existing instance", () => {
    const { registry } = createFixture();
    const type = new TextType();

    registry.register("some", type);
    registry.override("some", type);

    expect(registry.get("some")).toBe(type);
  });

  it("rejects overriding unknown names", () => {
    const { registry } = createFixture();
    expect(() => registry.override("unknown", new TextType())).toThrow(TypeNotFound);
  });

  it("rejects overriding with an instance registered under another name", () => {
    const { registry } = createFixture();
    const shared = new TextType();

    registry.register("first", shared);
    registry.register("second", new StringType());

    expect(() => registry.override("second", shared)).toThrow(TypeAlreadyRegistered);
  });

  it("returns a shallow copy of the type map", () => {
    const { registry, testType, otherTestType } = createFixture();
    const registeredTypes = registry.getMap();

    expect(Object.keys(registeredTypes)).toHaveLength(2);
    expect(registeredTypes[TEST_TYPE_NAME]).toBe(testType);
    expect(registeredTypes[OTHER_TEST_TYPE_NAME]).toBe(otherTestType);
    expect(registeredTypes).not.toBe(registry.getMap());
  });
});
