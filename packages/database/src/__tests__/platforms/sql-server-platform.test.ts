import { describe, expect, it } from "vitest";

import { LockMode } from "../../lock-mode";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { assertCommonPlatformSurface } from "./_helpers/platform-parity-scaffold";

describe("SQLServerPlatform parity", () => {
  it("exposes SQL Server-specific SQL helpers", () => {
    const platform = new SQLServerPlatform();

    assertCommonPlatformSurface(platform);
    expect(platform.appendLockHint("users u", LockMode.PESSIMISTIC_WRITE)).toContain("UPDLOCK");
    expect(platform.quoteSingleIdentifier("a]b")).toBe("[a]]b]");
  });
});
