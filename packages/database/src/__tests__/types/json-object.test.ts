import { describe, expect, it, vi } from "vitest";

import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { ConversionException } from "../../types/conversion-exception";
import { JsonObjectType } from "../../types/json-object-type";

describe("JsonObjectType parity", () => {
  it("returns the string binding type", () => {
    expect(new JsonObjectType().getBindingType()).toBe(ParameterType.STRING);
  });

  it("delegates SQL declaration to the platform", () => {
    const platform = new MySQLPlatform();
    const spy = vi.spyOn(platform, "getJsonTypeDeclarationSQL").mockReturnValue("TEST_JSON");

    expect(new JsonObjectType().getSQLDeclaration({}, platform)).toBe("TEST_JSON");
    expect(spy).toHaveBeenCalledWith({});
  });

  it("converts null and empty-string database values to null", () => {
    const type = new JsonObjectType();
    const platform = new MySQLPlatform();

    expect(type.convertToNodeValue(null, platform)).toBeNull();
    expect(type.convertToNodeValue("", platform)).toBeNull();
  });

  it.each([
    [
      '{"foo":"bar","bar":"foo","array":[],"object":{}}',
      { foo: "bar", bar: "foo", array: [], object: {} },
    ],
    ["1", 1],
    ['["bar"]', ["bar"]],
  ])("converts JSON values to node values (%p)", (databaseValue, expectedValue) => {
    expect(new JsonObjectType().convertToNodeValue(databaseValue, new MySQLPlatform())).toEqual(
      expectedValue,
    );
  });

  it.each(["a", "{"])("throws on invalid JSON database values (%p)", (data) => {
    expect(() => new JsonObjectType().convertToNodeValue(data, new MySQLPlatform())).toThrow(
      ConversionException,
    );
  });

  it("converts Buffer-backed JSON values (resource-like Node adaptation)", () => {
    const json = '{"foo":"bar","bar":"foo","array":[],"object":{}}';

    expect(
      new JsonObjectType().convertToNodeValue(Buffer.from(json, "utf8"), new MySQLPlatform()),
    ).toEqual({ foo: "bar", bar: "foo", array: [], object: {} });
  });

  it("converts null node values to null database values", () => {
    expect(new JsonObjectType().convertToDatabaseValue(null, new MySQLPlatform())).toBeNull();
  });

  it.each([
    [
      { foo: "bar", bar: "foo", array: [], object: {} },
      '{"foo":"bar","bar":"foo","array":[],"object":{}}',
    ],
    [1, "1"],
    [{ foo: "bar" }, '{"foo":"bar"}'],
    [["bar"], '["bar"]'],
  ])("converts node values to JSON strings (%p)", (nodeValue, expectedValue) => {
    expect(new JsonObjectType().convertToDatabaseValue(nodeValue, new MySQLPlatform())).toBe(
      expectedValue,
    );
  });

  it("serializes floating-point JSON values using JS JSON semantics", () => {
    expect(
      new JsonObjectType().convertToDatabaseValue({ foo: 11.4, bar: 10.0 }, new MySQLPlatform()),
    ).toBe('{"foo":11.4,"bar":10}');
  });

  it("throws conversion exceptions on serialization failure", () => {
    const circular: Record<string, unknown> = {};
    circular.recursion = circular;

    expect(() =>
      new JsonObjectType().convertToDatabaseValue(circular, new MySQLPlatform()),
    ).toThrow(ConversionException);
  });
});
