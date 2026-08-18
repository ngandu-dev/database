import { afterEach, describe, expect, it } from "vitest";

import { TypeArgumentCountException } from "../../types/exception/type-argument-count-exception";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Type } from "../../types/type";
import { TypeRegistry } from "../../types/type-registry";
import { Types } from "../../types/types";
import { TypeWithConstructor } from "./_helpers/type-with-constructor";

describe("Type parity", () => {
  const originalRegistry = Type.getTypeRegistry();

  afterEach(() => {
    Type.setTypeRegistry(originalRegistry);
  });

  it.each(Object.values(Types))("has built-in type registered: %s", (name) => {
    registerBuiltInTypes();
    expect(Type.hasType(name)).toBe(true);
  });

  it.each(Object.values(Types))("supports reverse lookup for built-in type: %s", (name) => {
    registerBuiltInTypes();

    const type = Type.getType(name);
    expect(Type.lookupName(type)).toBe(name);
  });

  it("throws when adding a type class that requires constructor arguments", () => {
    registerBuiltInTypes();
    Type.setTypeRegistry(new TypeRegistry(Type.getTypeRegistry().getMap()));

    expect(() => Type.addType("some_type_requires_args", TypeWithConstructor)).toThrow(
      TypeArgumentCountException,
    );
  });

  it("allows adding a type instance that requires constructor arguments", () => {
    registerBuiltInTypes();
    Type.setTypeRegistry(new TypeRegistry(Type.getTypeRegistry().getMap()));

    const name = "some_type_instance_requires_args";
    expect(Type.hasType(name)).toBe(false);

    Type.addType(name, new TypeWithConstructor(true));

    expect(Type.hasType(name)).toBe(true);
  });
});
