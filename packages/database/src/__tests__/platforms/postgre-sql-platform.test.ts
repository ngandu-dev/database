import { describe, expect, it } from "vitest";

import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { assertCommonPlatformSurface } from "./_helpers/platform-parity-scaffold";

describe("PostgreSQLPlatform parity", () => {
  it("exposes PostgreSQL-specific SQL helpers", () => {
    const platform = new PostgreSQLPlatform();

    assertCommonPlatformSurface(platform);
    expect(platform.getCurrentDatabaseExpression()).toBe("CURRENT_DATABASE()");
    expect(platform.supportsSchemas()).toBe(true);
    expect(platform.supportsSequences()).toBe(true);
  });
});
