import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { SmallFloatType } from "../../types/small-float-type";

describe("SmallFloatType parity", () => {
  it("converts database values to floats", () => {
    const type = new SmallFloatType();
    expect(type.convertToNodeValue("5.5", new MySQLPlatform())).toBe(5.5);
  });

  it("converts null database values to null", () => {
    expect(new SmallFloatType().convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });

  it("preserves numeric values for database conversion", () => {
    expect(new SmallFloatType().convertToDatabaseValue(5.5, new MySQLPlatform())).toBe(5.5);
  });

  it("preserves null for database conversion", () => {
    expect(new SmallFloatType().convertToDatabaseValue(null, new MySQLPlatform())).toBeNull();
  });
});
