import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { DateTimeType } from "../../types/date-time-type";
import { SerializationFailed } from "../../types/exception/serialization-failed";
import { TypeAlreadyRegistered } from "../../types/exception/type-already-registered";
import { TypeNotRegistered } from "../../types/exception/type-not-registered";
import { TypesAlreadyExists } from "../../types/exception/types-already-exists";
import { UnknownColumnType } from "../../types/exception/unknown-column-type";
import { JsonType } from "../../types/json-type";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { SimpleArrayType } from "../../types/simple-array-type";
import { StringType } from "../../types/string-type";
import { Type } from "../../types/type";
import { TypeRegistry } from "../../types/type-registry";
import { Types } from "../../types/types";

describe("Types subsystem", () => {
  it("loads built-in types from the global registry", () => {
    registerBuiltInTypes();
    expect(Type.hasType(Types.STRING)).toBe(true);
    expect(Type.hasType(Types.INTEGER)).toBe(true);

    const stringType = Type.getType(Types.STRING);
    expect(stringType).toBeInstanceOf(StringType);
  });

  it("converts date-time values with platform format", () => {
    const platform = new MySQLPlatform();
    const type = new DateTimeType();
    const value = new Date(2024, 0, 2, 3, 4, 5);

    const dbValue = type.convertToDatabaseValue(value, platform);
    expect(dbValue).toBe("2024-01-02 03:04:05");

    const nodeValue = type.convertToNodeValue("2024-01-02 03:04:05", platform);
    expect(nodeValue).toBeInstanceOf(Date);
  });

  it("converts simple arrays to comma-delimited strings", () => {
    const type = new SimpleArrayType();

    expect(type.convertToDatabaseValue(["a", "b"], new MySQLPlatform())).toBe("a,b");
    expect(type.convertToNodeValue("x,y", new MySQLPlatform())).toEqual(["x", "y"]);
  });

  it("serializes JSON and throws on non-serializable values", () => {
    const type = new JsonType();
    const platform = new MySQLPlatform();

    expect(type.convertToDatabaseValue({ a: 1 }, platform)).toBe('{"a":1}');
    expect(type.convertToNodeValue('{"a":1}', platform)).toEqual({ a: 1 });

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => type.convertToDatabaseValue(circular, platform)).toThrow(SerializationFailed);
  });

  it("guards registry invariants with Datazen-style exceptions", () => {
    const shared = new StringType();
    const registry = new TypeRegistry({ first: shared });

    expect(() => registry.register("first", new StringType())).toThrow(TypesAlreadyExists);
    expect(() => registry.register("second", shared)).toThrow(TypeAlreadyRegistered);
    expect(() => registry.get("missing")).toThrow(UnknownColumnType);
    expect(() => registry.lookupName(new StringType())).toThrow(TypeNotRegistered);
  });
});
