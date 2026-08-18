import { describe, expect, it, vi } from "vitest";

import { CachingCharsetMetadataProvider } from "../../../../platforms/mysql/charset-metadata-provider/caching-charset-metadata-provider";

describe("MySQL CachingCharsetMetadataProvider", () => {
  it.each([
    ["utf8mb4", "utf8mb4_general_ci"],
    ["utf8mb5", null],
  ])("caches default collation lookups for %s", async (charset, collation) => {
    const underlying = {
      getDefaultCharsetCollation: vi.fn().mockResolvedValue(collation),
    };

    const provider = new CachingCharsetMetadataProvider(underlying);

    await expect(provider.getDefaultCharsetCollation(charset)).resolves.toBe(collation);
    await expect(provider.getDefaultCharsetCollation(charset)).resolves.toBe(collation);
    expect(underlying.getDefaultCharsetCollation).toHaveBeenCalledTimes(1);
    expect(underlying.getDefaultCharsetCollation).toHaveBeenCalledWith(charset);
  });
});
