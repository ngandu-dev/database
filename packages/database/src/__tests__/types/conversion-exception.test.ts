import { describe, expect, it } from "vitest";

import { InvalidFormat } from "../../types/exception/invalid-format";
import { InvalidType } from "../../types/exception/invalid-type";
import { ValueNotConvertible } from "../../types/exception/value-not-convertible";

describe("Types ConversionException parity", () => {
  it("preserves previous exception for value-not-convertible", () => {
    const previous = new Error("boom");
    const exception = ValueNotConvertible.new("foo", "foo", null, previous);

    expect(exception.previous).toBe(previous);
  });

  it.each([
    ["foo", 'Node value "foo"'],
    [123, "Node value 123"],
    [-123, "Node value -123"],
    [12.34, "Node value 12.34"],
    [true, "Node value true"],
    [false, "Node value false"],
    [null, "Node value null"],
  ])("includes scalar value previews in invalid-type messages (%p)", (value, expectedFragment) => {
    const exception = InvalidType.new(value, "foo", ["bar", "baz"]);

    expect(exception.message).toContain(expectedFragment);
    expect(exception.message).toContain("Expected one of the following types: bar, baz.");
  });

  it.each([
    [[], "Array"],
    [{}, "Object"],
    [Buffer.from("x"), "Buffer"],
  ])("formats non-scalar invalid-type messages (%p)", (value, expectedTypeName) => {
    const exception = InvalidType.new(value, "foo", ["bar", "baz"]);

    expect(exception.message).toBe(
      `Could not convert Node value type ${expectedTypeName} to type foo. Expected one of the following types: bar, baz.`,
    );
  });

  it("preserves previous exception for invalid-type", () => {
    const previous = new Error("boom");
    const exception = InvalidType.new("foo", "foo", ["bar", "baz"], previous);

    expect(exception.previous).toBe(previous);
  });

  it("preserves previous exception for invalid-format", () => {
    const previous = new Error("boom");
    const exception = InvalidFormat.new("foo", "bar", "baz", previous);

    expect(exception.previous).toBe(previous);
  });
});
