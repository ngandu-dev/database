import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { DecimalType } from "../../types/decimal-type";

describe("DecimalType parity", () => {
  it("converts database values to strings", () => {
    expect(new DecimalType().convertToNodeValue("5.5", new MySQLPlatform())).toBeTypeOf("string");
  });

  it("converts null to null", () => {
    expect(new DecimalType().convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });
});
