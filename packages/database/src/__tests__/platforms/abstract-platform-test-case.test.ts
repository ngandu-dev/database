import { describe, expect, it } from "vitest";

import { DummyPlatform, assertCommonPlatformSurface } from "./_helpers/platform-parity-scaffold";

describe("Platforms AbstractPlatformTestCase parity scaffold", () => {
  it("covers common abstract platform contracts through a concrete test double", () => {
    const platform = new DummyPlatform();

    assertCommonPlatformSurface(platform);
    expect(platform.getLocateExpression("name", "'x'")).toBe("LOCATE('x', name)");
  });
});
