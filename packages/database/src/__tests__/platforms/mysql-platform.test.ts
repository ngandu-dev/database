import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { assertCommonPlatformSurface } from "./_helpers/platform-parity-scaffold";

describe("MySQLPlatform parity", () => {
  it("exposes MySQL-specific SQL helpers", () => {
    const platform = new MySQLPlatform();

    assertCommonPlatformSurface(platform);
    expect(platform.getCurrentDatabaseExpression()).toBe("DATABASE()");
    expect(platform.getLocateExpression("name", "'x'", "2")).toBe("LOCATE('x', name, 2)");
  });
});
