import { describe, expect, it } from "vitest";

import { AbstractOptionallyNamedObject } from "../../schema/abstract-optionally-named-object";

class TestOptionallyNamedObject extends AbstractOptionallyNamedObject {
  public setObjectName(name: string | null): void {
    this.setName(name);
  }
}

describe("Schema/AbstractOptionallyNamedObject (Doctrine parity, adapted)", () => {
  it.each([[""], [null]])("treats empty optional names as null (%j)", (name) => {
    const object = new TestOptionallyNamedObject(name);

    expect(object.getObjectName()).toBeNull();
  });

  it("supports toggling between named and unnamed states", () => {
    const object = new TestOptionallyNamedObject("users");

    expect(object.getObjectName()).toBe("users");
    object.setObjectName("");
    expect(object.getObjectName()).toBeNull();
    object.setObjectName("accounts");
    expect(object.getObjectName()).toBe("accounts");
  });

  it.skip(
    "Doctrine missing-parent-call invalid-state scenario is not representable in TypeScript class semantics",
  );
});
