import { describe, expect, it, vi } from "vitest";

import { CachingCollationMetadataProvider } from "../../../../platforms/mysql/collation-metadata-provider/caching-collation-metadata-provider";

describe("MySQL CachingCollationMetadataProvider (Doctrine parity)", () => {
  it.each([
    ["utf8mb4_unicode_ci", "utf8mb4"],
    ["utf8mb5_unicode_ci", null],
  ])("caches collation charset lookups for %s", async (collation, charset) => {
    const underlying = {
      getCollationCharset: vi.fn().mockResolvedValue(charset),
    };

    const cachingProvider = new CachingCollationMetadataProvider(underlying);

    await expect(cachingProvider.getCollationCharset(collation)).resolves.toBe(charset);
    await expect(cachingProvider.getCollationCharset(collation)).resolves.toBe(charset);
    expect(underlying.getCollationCharset).toHaveBeenCalledTimes(1);
    expect(underlying.getCollationCharset).toHaveBeenCalledWith(collation);
  });
});
