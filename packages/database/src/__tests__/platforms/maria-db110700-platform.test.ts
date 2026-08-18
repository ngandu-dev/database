import { describe, expect, it } from "vitest";

import { MariaDBPlatform } from "../../platforms/mariadb-platform";
import { MariaDB110700Platform } from "../../platforms/mariadb110700-platform";

describe("MariaDB110700Platform parity", () => {
  it("is a MariaDB platform variant with MySQL-compatible behaviors", () => {
    const platform = new MariaDB110700Platform();

    expect(platform).toBeInstanceOf(MariaDB110700Platform);
    expect(platform).toBeInstanceOf(MariaDBPlatform);
    expect(platform.getLocateExpression("name", "'x'")).toBe("LOCATE('x', name)");
  });
});
