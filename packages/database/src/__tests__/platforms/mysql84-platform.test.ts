import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { MySQL84Platform } from "../../platforms/mysql84-platform";

describe("MySQL84Platform parity", () => {
  it("is a MySQL platform variant", () => {
    const platform = new MySQL84Platform();

    expect(platform).toBeInstanceOf(MySQL84Platform);
    expect(platform).toBeInstanceOf(MySQLPlatform);
    expect(platform.getRegexpExpression()).toBe("RLIKE");
  });
});
