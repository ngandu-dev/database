import { describe, expect, it } from "vitest";

import { MariaDBPlatform } from "../../platforms/mariadb-platform";
import { assertCommonPlatformSurface } from "./_helpers/platform-parity-scaffold";

describe("MariaDBPlatform parity", () => {
  it("inherits MySQL-style platform behavior", () => {
    const platform = new MariaDBPlatform();

    assertCommonPlatformSurface(platform);
    expect(platform.getRegexpExpression()).toBe("RLIKE");
    expect(platform.getConcatExpression("a", "b")).toBe("CONCAT(a, b)");
  });
});
