import { describe, expect, it } from "vitest";

import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { BinaryType } from "../../types/binary-type";
import { ConversionException } from "../../types/conversion-exception";

function getBinaryString(): string {
  return String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i));
}

describe("BinaryType parity", () => {
  it("returns the binary binding type", () => {
    expect(new BinaryType().getBindingType()).toBe(ParameterType.BINARY);
  });

  it("converts null database values to null", () => {
    expect(new BinaryType().convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });

  it("converts binary strings to node values", () => {
    const databaseValue = getBinaryString();
    expect(new BinaryType().convertToNodeValue(databaseValue, new MySQLPlatform())).toBe(
      databaseValue,
    );
  });

  it("converts Buffer values to node values (resource-like Node adaptation)", () => {
    const databaseValue = Buffer.from("binary string", "utf8");
    const phpValue = new BinaryType().convertToNodeValue(databaseValue, new MySQLPlatform());

    expect(phpValue).toBe(databaseValue);
    expect(Buffer.from(phpValue as Uint8Array).toString("utf8")).toBe("binary string");
  });

  it.each([
    false,
    true,
    0,
    1,
    -1,
    0.0,
    1.1,
    -1.1,
  ])("throws conversion exception on invalid database value: %p", (value) => {
    expect(() => new BinaryType().convertToNodeValue(value, new MySQLPlatform())).toThrow(
      ConversionException,
    );
  });
});
