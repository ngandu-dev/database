import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { GuidType } from "../../types/guid-type";

describe("GuidType parity", () => {
  it("converts database values to strings", () => {
    const type = new GuidType();
    const platform = new MySQLPlatform();

    expect(type.convertToNodeValue("foo", platform)).toBeTypeOf("string");
    expect(type.convertToNodeValue("", platform)).toBeTypeOf("string");
  });

  it("converts null to null", () => {
    expect(new GuidType().convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });
});
