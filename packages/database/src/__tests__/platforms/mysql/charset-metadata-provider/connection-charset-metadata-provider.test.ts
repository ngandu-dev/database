import { describe, expect, it, vi } from "vitest";

import { ConnectionCharsetMetadataProvider } from "../../../../platforms/mysql/charset-metadata-provider/connection-charset-metadata-provider";

describe("MySQL ConnectionCharsetMetadataProvider", () => {
  it("queries information_schema.CHARACTER_SETS and returns a collation", async () => {
    const connection = {
      fetchOne: vi.fn().mockResolvedValue("utf8mb4_general_ci"),
    };

    const provider = new ConnectionCharsetMetadataProvider(connection);
    await expect(provider.getDefaultCharsetCollation("utf8mb4")).resolves.toBe(
      "utf8mb4_general_ci",
    );
    expect(connection.fetchOne).toHaveBeenCalledWith(
      expect.stringContaining("information_schema.CHARACTER_SETS"),
      ["utf8mb4"],
    );
  });

  it("returns null when the charset is not found", async () => {
    const provider = new ConnectionCharsetMetadataProvider({
      fetchOne: async () => undefined,
    });

    await expect(provider.getDefaultCharsetCollation("missing")).resolves.toBeNull();
  });
});
