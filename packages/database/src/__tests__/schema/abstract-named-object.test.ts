import { describe, expect, it } from "vitest";

import { AbstractNamedObject } from "../../schema/abstract-named-object";
import { InvalidState } from "../../schema/exception/invalid-state";

class TestNamedObject extends AbstractNamedObject {}

describe("Schema/AbstractNamedObject (Doctrine parity, adapted)", () => {
  it("throws on access to an empty object name", () => {
    const object = new TestNamedObject("");

    expect(() => object.getObjectName()).toThrow(InvalidState);
  });

  it("returns a non-empty object name", () => {
    const object = new TestNamedObject("users");

    expect(object.getObjectName()).toBe("users");
  });

  it.skip("Doctrine deprecation signaling for empty-name construction is not modeled in Node");
});
