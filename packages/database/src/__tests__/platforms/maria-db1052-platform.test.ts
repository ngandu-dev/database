import { describe, expect, it } from "vitest";

import { MariaDBPlatform } from "../../platforms/mariadb-platform";
import { MariaDB1052Platform } from "../../platforms/mariadb1052-platform";

describe("MariaDB1052Platform parity", () => {
  it("is a MariaDB platform variant", () => {
    const platform = new MariaDB1052Platform();

    expect(platform).toBeInstanceOf(MariaDB1052Platform);
    expect(platform).toBeInstanceOf(MariaDBPlatform);
    expect(platform.getCurrentDatabaseExpression()).toBe("DATABASE()");
  });
});
