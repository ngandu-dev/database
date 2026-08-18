import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { InvalidType } from "../../types/exception/invalid-type";
import { NumberType } from "../../types/number-type";

describe("NumberType parity", () => {
  it("converts decimal-like database values to the local numeric representation", () => {
    const type = new NumberType();
    const platform = new MySQLPlatform();

    expect(type.convertToNodeValue("5.5", platform)).toBe("5.5");
    expect(type.convertToNodeValue("5.5000", platform)).toBe("5.5000");
    expect(type.convertToNodeValue(5.5, platform)).toBe("5.5");
  });

  it("converts null database values to null", () => {
    expect(new NumberType().convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });

  it("converts supported node values to decimal strings", () => {
    const type = new NumberType();
    const platform = new MySQLPlatform();

    expect(type.convertToDatabaseValue(5.5, platform)).toBe("5.5");
    expect(type.convertToDatabaseValue("5.5", platform)).toBe("5.5");
    expect(type.convertToDatabaseValue(5n, platform)).toBe("5");
  });

  it("converts null node values to null", () => {
    expect(new NumberType().convertToDatabaseValue(null, new MySQLPlatform())).toBeNull();
  });

  it.each([true, {}, []])("rejects invalid node values (%p)", (value) => {
    expect(() => new NumberType().convertToDatabaseValue(value, new MySQLPlatform())).toThrow(
      InvalidType,
    );
  });

  it.skip(
    "rejects unexpected database values with conversion exceptions (Doctrine bcmath-specific parity)",
  );
});
