import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { SmallIntType } from "../../types/small-int-type";

describe("SmallIntType parity", () => {
  it("converts database values to integers", () => {
    const type = new SmallIntType();
    const platform = new MySQLPlatform();

    expect(type.convertToNodeValue("1", platform)).toBeTypeOf("number");
    expect(type.convertToNodeValue("0", platform)).toBeTypeOf("number");
  });

  it("converts null to null", () => {
    expect(new SmallIntType().convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });
});
