import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { IntegerType } from "../../types/integer-type";

describe("IntegerType parity", () => {
  it("converts database values to integers", () => {
    const type = new IntegerType();
    const platform = new MySQLPlatform();

    expect(type.convertToNodeValue("1", platform)).toBeTypeOf("number");
    expect(type.convertToNodeValue("0", platform)).toBeTypeOf("number");
  });

  it("converts null to null", () => {
    expect(new IntegerType().convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });
});
