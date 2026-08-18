import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { FloatType } from "../../types/float-type";

describe("FloatType parity", () => {
  it("converts database values to floats", () => {
    const type = new FloatType();
    expect(type.convertToNodeValue("5.5", new MySQLPlatform())).toBeTypeOf("number");
  });

  it("converts null database values to null", () => {
    expect(new FloatType().convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });

  it("keeps numeric database conversions numeric", () => {
    const type = new FloatType();
    expect(type.convertToDatabaseValue(5.5, new MySQLPlatform())).toBeTypeOf("number");
  });

  it("preserves null for database conversion", () => {
    expect(new FloatType().convertToDatabaseValue(null, new MySQLPlatform())).toBeNull();
  });
});
