import { describe, expect, it, vi } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { BooleanType } from "../../types/boolean-type";

describe("BooleanType parity", () => {
  it("delegates boolean conversion to database value to the platform", () => {
    const platform = new MySQLPlatform();
    const type = new BooleanType();
    const spy = vi.spyOn(platform, "convertBooleansToDatabaseValue").mockReturnValue(1);

    expect(type.convertToDatabaseValue(true, platform)).toBe(1);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it("delegates boolean conversion from database value to the platform", () => {
    const platform = new MySQLPlatform();
    const type = new BooleanType();
    const spy = vi.spyOn(platform, "convertFromBoolean").mockReturnValue(false);

    expect(type.convertToNodeValue(0, platform)).toBe(false);
    expect(spy).toHaveBeenCalledWith(0);
  });

  it("converts null to null", () => {
    const type = new BooleanType();
    expect(type.convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });
});
