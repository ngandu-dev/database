import { describe, expect, it, vi } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { StringType } from "../../types/string-type";

describe("StringType parity", () => {
  it("delegates SQL declaration to the platform", () => {
    const platform = new MySQLPlatform();
    const type = new StringType();
    const spy = vi.spyOn(platform, "getStringTypeDeclarationSQL").mockReturnValue("TEST_STRING");

    expect(type.getSQLDeclaration({}, platform)).toBe("TEST_STRING");
    expect(spy).toHaveBeenCalledWith({});
  });

  it("converts node values and preserves null", () => {
    const type = new StringType();
    const platform = new MySQLPlatform();

    expect(typeof type.convertToNodeValue("foo", platform)).toBe("string");
    expect(typeof type.convertToNodeValue("", platform)).toBe("string");
    expect(type.convertToNodeValue(null, platform)).toBeNull();
  });

  it("keeps SQL conversion expressions unchanged", () => {
    const type = new StringType();
    const platform = new MySQLPlatform();

    expect(type.convertToDatabaseValueSQL("t.foo", platform)).toBe("t.foo");
    expect(type.convertToNodeValueSQL("t.foo", platform)).toBe("t.foo");
  });
});
