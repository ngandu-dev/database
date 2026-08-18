import { describe, expect, it } from "vitest";

import { ObjectAlreadyExists } from "../../../schema/collections/exception/object-already-exists";
import { ObjectDoesNotExist } from "../../../schema/collections/exception/object-does-not-exist";
import { OptionallyUnqualifiedNamedObjectSet } from "../../../schema/collections/optionally-unqualified-named-object-set";
import { UnqualifiedName } from "../../../schema/name/unqualified-name";
import type { OptionallyNamedObject } from "../../../schema/optionally-named-object";

describe("Schema/Collections/OptionallyUnqualifiedNamedObjectSet (Doctrine parity)", () => {
  it("instantiates without arguments", () => {
    const set = new OptionallyUnqualifiedNamedObjectSet<TestOptionallyNamedObject>();

    expect(set.isEmpty()).toBe(true);
    expect(set.toList()).toEqual([]);
  });

  it("instantiates with arguments", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject(null, 2);
    const set = new OptionallyUnqualifiedNamedObjectSet(object1, object2);

    expect(set.toList()).toEqual([object1, object2]);
  });

  it("adds objects", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject(null, 2);
    const set = new OptionallyUnqualifiedNamedObjectSet(object1);

    set.add(object2);

    expect(set.toList()).toEqual([object1, object2]);
  });

  it("throws when adding an existing named object", () => {
    const object = createObject("object", 1);
    const set = new OptionallyUnqualifiedNamedObjectSet(object);

    expect(() => set.add(object)).toThrow(ObjectAlreadyExists);
  });

  it("removes an object", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject(null, 2);
    const set = new OptionallyUnqualifiedNamedObjectSet(object1, object2);

    set.remove(UnqualifiedName.unquoted("object1"));

    expect(set.toList()).toEqual([object2]);
  });

  it("throws when removing a non-existing object", () => {
    const object1 = createObject("object1", 1);
    const set = new OptionallyUnqualifiedNamedObjectSet(object1);

    expect(() => set.remove(UnqualifiedName.unquoted("object2"))).toThrow(ObjectDoesNotExist);
  });

  it("gets existing objects", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject(null, 2);
    const object3 = createObject("object3", 3);
    const set = new OptionallyUnqualifiedNamedObjectSet(object1, object2, object3);

    expect(set.get(UnqualifiedName.unquoted("object1"))).toBe(object1);
    expect(set.get(UnqualifiedName.unquoted("object3"))).toBe(object3);
  });

  it("returns null for non-existing objects", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject(null, 2);
    const set = new OptionallyUnqualifiedNamedObjectSet(object1, object2);

    expect(set.get(UnqualifiedName.unquoted("object3"))).toBeNull();
  });

  it("modifies an object", () => {
    const object11 = createObject("object1", 11);
    const object12 = createObject("object1", 12);
    const object2 = createObject("object2", 2);
    const set = new OptionallyUnqualifiedNamedObjectSet(object11, object2);

    set.modify(UnqualifiedName.unquoted("object1"), () => object12);

    expect(set.toList()).toEqual([object12, object2]);
  });

  it("throws when modifying a non-existing object", () => {
    const object1 = createObject("object1", 1);
    const set = new OptionallyUnqualifiedNamedObjectSet(object1);

    expect(() => set.modify(UnqualifiedName.unquoted("object2"), (object) => object)).toThrow(
      ObjectDoesNotExist,
    );
  });

  it("throws when renaming to an existing name", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject(null, 2);
    const object3 = createObject("object3", 3);
    const set = new OptionallyUnqualifiedNamedObjectSet(object1, object2, object3);

    expect(() => set.modify(UnqualifiedName.unquoted("object1"), () => object3)).toThrow(
      ObjectAlreadyExists,
    );
  });

  it("allows renaming to null and preserves list order", () => {
    const object1 = createObject("object1", 1);
    const object2 = createObject(null, 2);
    const object3 = createObject("object3", 3);
    const set = new OptionallyUnqualifiedNamedObjectSet(object1, object2, object3);

    set.modify(UnqualifiedName.unquoted("object1"), () => object2);

    expect(set.toList()).toEqual([object2, object2, object3]);
  });
});

type TestOptionallyNamedObject = OptionallyNamedObject<UnqualifiedName> & { getValue(): number };

function createObject(name: string | null, value: number): TestOptionallyNamedObject {
  return new (class implements OptionallyNamedObject<UnqualifiedName> {
    private readonly objectName = name !== null ? UnqualifiedName.unquoted(name) : null;

    public getObjectName(): UnqualifiedName | null {
      return this.objectName;
    }

    public getValue(): number {
      return value;
    }
  })() as TestOptionallyNamedObject;
}
