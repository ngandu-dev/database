import { describe, expect, it, vi } from "vitest";

import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { ConversionException } from "../../types/conversion-exception";
import { JsonType } from "../../types/json-type";

describe("JsonType parity", () => {
  it("returns the string binding type", () => {
    expect(new JsonType().getBindingType()).toBe(ParameterType.STRING);
  });

  it("delegates SQL declaration to the platform", () => {
    const platform = new MySQLPlatform();
    const spy = vi.spyOn(platform, "getJsonTypeDeclarationSQL").mockReturnValue("TEST_JSON");

    expect(new JsonType().getSQLDeclaration({}, platform)).toBe("TEST_JSON");
    expect(spy).toHaveBeenCalledWith({});
  });

  it("converts null and empty-string database values to null", () => {
    const type = new JsonType();
    const platform = new MySQLPlatform();

    expect(type.convertToNodeValue(null, platform)).toBeNull();
    expect(type.convertToNodeValue("", platform)).toBeNull();
  });

  it("converts JSON strings to node values", () => {
    const databaseValue = '{"foo":"bar","bar":"foo"}';

    expect(new JsonType().convertToNodeValue(databaseValue, new MySQLPlatform())).toEqual({
      foo: "bar",
      bar: "foo",
    });
  });

  it.each(["a", "{"])("throws on invalid JSON database values (%p)", (data) => {
    expect(() => new JsonType().convertToNodeValue(data, new MySQLPlatform())).toThrow(
      ConversionException,
    );
  });

  it("converts Buffer-backed JSON values (resource-like Node adaptation)", () => {
    const databaseValue = Buffer.from('{"foo":"bar","bar":"foo"}', "utf8");

    expect(new JsonType().convertToNodeValue(databaseValue, new MySQLPlatform())).toEqual({
      foo: "bar",
      bar: "foo",
    });
  });

  it("converts null node values to null database values", () => {
    expect(new JsonType().convertToDatabaseValue(null, new MySQLPlatform())).toBeNull();
  });

  it("converts node values to JSON strings", () => {
    const source = { foo: "bar", bar: "foo" };
    expect(new JsonType().convertToDatabaseValue(source, new MySQLPlatform())).toBe(
      '{"foo":"bar","bar":"foo"}',
    );
  });

  it("serializes floating-point JSON values using JS JSON semantics", () => {
    const source = { foo: 11.4, bar: 10.0 };

    expect(new JsonType().convertToDatabaseValue(source, new MySQLPlatform())).toBe(
      '{"foo":11.4,"bar":10}',
    );
  });

  it("throws conversion exceptions on serialization failure", () => {
    const circular: Record<string, unknown> = {};
    circular.recursion = circular;

    expect(() => new JsonType().convertToDatabaseValue(circular, new MySQLPlatform())).toThrow(
      ConversionException,
    );

    try {
      new JsonType().convertToDatabaseValue(circular, new MySQLPlatform());
    } catch (error) {
      expect(error).toBeInstanceOf(ConversionException);
      expect((error as Error).message).toContain('Could not convert Node type "');
      expect((error as Error).message).toContain('to "json".');
      expect((error as Error).message).toContain("serialization");
    }
  });
});
