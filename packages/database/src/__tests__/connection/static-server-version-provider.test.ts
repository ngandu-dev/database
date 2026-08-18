import { describe, expect, it } from "vitest";

import { StaticServerVersionProvider } from "../../connection/static-server-version-provider";

describe("StaticServerVersionProvider", () => {
  it("returns the configured server version", async () => {
    const provider = new StaticServerVersionProvider("8.0.36");

    await expect(Promise.resolve(provider.getServerVersion())).resolves.toBe("8.0.36");
  });
});
