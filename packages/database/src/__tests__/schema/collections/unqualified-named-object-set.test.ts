import { describe, expect, it } from "vitest";

import { ObjectAlreadyExists } from "../../../schema/collections/exception/object-already-exists";
import { ObjectDoesNotExist } from "../../../schema/collections/exception/object-does-not-exist";
import { UnqualifiedNamedObjectSet } from "../../../schema/collections/unqualified-named-object-set";
import { UnqualifiedName } from "../../../schema/name/unqualified-name";
import type { NamedObject } from "../../../schema/named-object";

describe("Schema/Collections/UnqualifiedNamedObjectSet (Doctrine parity)", () => {
  it("instantiates without arguments", () => {
    const set = new UnqualifiedNamedObjectSet<TestNamedObject>();

    expect(set.isEmpty()).toBe(true);
    expect(set.toList()).toEqual([]);
  });

  it("instantiates with arguments", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject("object2", 2);

    const set = new UnqualifiedNamedObjectSet(object1, object2);

    expect(set.toList()).toEqual([object1, object2]);
  });

  it("adds an object", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject("object2", 2);

    const set = new UnqualifiedNamedObjectSet(object1);
    set.add(object2);

    expect(set.toList()).toEqual([object1, object2]);
  });

  it("throws when adding an existing object", () => {
    const object = createObject("object", 1);
    const set = new UnqualifiedNamedObjectSet(object);

    expect(() => set.add(object)).toThrow(ObjectAlreadyExists);
  });

  it("removes an object", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject("object2", 2);

    const set = new UnqualifiedNamedObjectSet(object1, object2);
    set.remove(object1.getObjectName());

    expect(set.toList()).toEqual([object2]);
  });

  it("throws when removing a non-existing object", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject("object2", 2);
    const set = new UnqualifiedNamedObjectSet(object1);

    expect(() => set.remove(object2.getObjectName())).toThrow(ObjectDoesNotExist);
  });

  it("gets existing objects", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject("object2", 2);
    const set = new UnqualifiedNamedObjectSet(object1, object2);

    expect(set.get(object1.getObjectName())).toBe(object1);
    expect(set.get(object2.getObjectName())).toBe(object2);
  });

  it("returns null for non-existing objects", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject("object2", 2);
    const set = new UnqualifiedNamedObjectSet(object1);

    expect(set.get(object2.getObjectName())).toBeNull();
  });

  it("modifies an object without renaming", () => {
    const object11 = createObject("object1", 11);
    const object12 = createObject("object1", 12);
    const object2 = createObject("object2", 2);
    const set = new UnqualifiedNamedObjectSet(object11, object2);

    set.modify(object11.getObjectName(), () => object12);

    expect(set.toList()).toEqual([object12, object2]);
  });

  it("modifies an object with renaming", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject("object2", 2);
    const object3 = createObject("object3", 3);
    const set = new UnqualifiedNamedObjectSet(object1, object2);

    set.modify(object1.getObjectName(), () => object3);

    expect(set.get(object1.getObjectName())).toBeNull();
    expect(set.get(object3.getObjectName())).toBe(object3);
    expect(set.toList()).toEqual([object3, object2]);
  });

  it("throws when modifying a non-existing object", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject("object2", 2);
    const set = new UnqualifiedNamedObjectSet(object1);

    expect(() => set.modify(object2.getObjectName(), (object) => object)).toThrow(
      ObjectDoesNotExist,
    );
  });

  it("throws when renaming to an existing name", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject("object2", 2);
    const set = new UnqualifiedNamedObjectSet(object1, object2);

    expect(() => set.modify(object1.getObjectName(), () => object2)).toThrow(ObjectAlreadyExists);
  });
});

type TestNamedObject = NamedObject<UnqualifiedName> & { getValue(): number };

function createObject(name: string, value: number): TestNamedObject {
  return new (class implements NamedObject<UnqualifiedName> {
    private readonly objectName = UnqualifiedName.unquoted(name);

    public getObjectName(): UnqualifiedName {
      return this.objectName;
    }

    public getValue(): number {
      return value;
    }
  })() as TestNamedObject;
}
