import { describe, expect, it } from "vitest";

import { DB2Platform } from "../../platforms/db2-platform";
import { assertCommonPlatformSurface } from "./_helpers/platform-parity-scaffold";

describe("DB2Platform parity", () => {
  it("exposes DB2-specific SQL helpers", () => {
    const platform = new DB2Platform();

    assertCommonPlatformSurface(platform);
    expect(platform.getDummySelectSQL("1")).toBe("SELECT 1 FROM sysibm.sysdummy1");
    expect(platform.supportsSavepoints()).toBe(false);
  });
});
