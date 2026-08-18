import { describe, expect, it } from "vitest";

import { OraclePlatform } from "../../platforms/oracle-platform";
import { assertCommonPlatformSurface } from "./_helpers/platform-parity-scaffold";

describe("OraclePlatform parity", () => {
  it("exposes Oracle-specific SQL helpers", () => {
    const platform = new OraclePlatform();

    assertCommonPlatformSurface(platform);
    expect(platform.getDummySelectSQL("1")).toBe("SELECT 1 FROM DUAL");
    expect(platform.supportsReleaseSavepoints()).toBe(false);
  });
});
