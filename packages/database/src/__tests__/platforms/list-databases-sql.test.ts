import { describe, expect, it } from "vitest";

import {
  MariaDBPlatform,
  MySQLPlatform,
  PostgreSQLPlatform,
  SQLServerPlatform,
} from "../../platforms/_index";

describe("database listing SQL", () => {
  it("is encapsulated by each supported platform", () => {
    expect(new MySQLPlatform().getListDatabasesSQL()).toBe("SHOW DATABASES");
    expect(new MariaDBPlatform().getListDatabasesSQL()).toBe("SHOW DATABASES");
    expect(new PostgreSQLPlatform().getListDatabasesSQL()).toContain("FROM pg_database");
    expect(new SQLServerPlatform().getListDatabasesSQL()).toBe(
      "SELECT name FROM sys.databases ORDER BY name",
    );
  });
});
