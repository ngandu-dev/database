import { describe, expect, it } from "vitest";

import { normalizeJson } from "../database/json";

describe("normalizeJson", () => {
  it("normalizes values that JSON cannot represent safely", () => {
    expect(
      normalizeJson({
        bigint: 9_007_199_254_740_993n,
        date: new Date("2026-01-02T03:04:05.000Z"),
        binary: Buffer.from([0, 1, 2]),
      }),
    ).toEqual({
      bigint: "9007199254740993",
      date: "2026-01-02T03:04:05.000Z",
      binary: { $binary: "AAEC", encoding: "base64" },
    });
  });
});
