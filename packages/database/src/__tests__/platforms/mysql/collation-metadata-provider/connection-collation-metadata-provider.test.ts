import { describe, expect, it, vi } from "vitest";

import { ConnectionCollationMetadataProvider } from "../../../../platforms/mysql/collation-metadata-provider/connection-collation-metadata-provider";

describe("MySQL ConnectionCollationMetadataProvider", () => {
  it("queries information_schema.COLLATIONS and returns a charset", async () => {
    const connection = {
      fetchOne: vi.fn().mockResolvedValue("utf8mb4"),
    };

    const provider = new ConnectionCollationMetadataProvider(connection);
    await expect(provider.getCollationCharset("utf8mb4_general_ci")).resolves.toBe("utf8mb4");
    expect(connection.fetchOne).toHaveBeenCalledWith(
      expect.stringContaining("information_schema.COLLATIONS"),
      ["utf8mb4_general_ci"],
    );
  });

  it("returns null when the collation is not found", async () => {
    const provider = new ConnectionCollationMetadataProvider({
      fetchOne: async () => undefined,
    });

    await expect(provider.getCollationCharset("missing")).resolves.toBeNull();
  });
});
