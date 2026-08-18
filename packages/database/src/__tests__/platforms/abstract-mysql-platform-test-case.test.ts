import { describe, expect, it } from "vitest";

import {
  DummyMySQLPlatform,
  assertCommonPlatformSurface,
} from "./_helpers/platform-parity-scaffold";

describe("Platforms AbstractMySQLPlatformTestCase parity scaffold", () => {
  it("covers shared MySQL-platform contracts through a concrete test subclass", () => {
    const platform = new DummyMySQLPlatform();

    assertCommonPlatformSurface(platform);
    expect(platform.getRegexpExpression()).toBe("RLIKE");
    expect(platform.getCurrentDatabaseExpression()).toBe("DATABASE()");
  });
});
