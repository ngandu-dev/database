import { describe, expect, it } from "vitest";

import { invalidTemporalNodeValues } from "./_helpers/base-date-type-parity";

describe("BaseDateTypeTestCase parity scaffold", () => {
  it("provides the shared invalid-value provider for date/time type ports", () => {
    expect(invalidTemporalNodeValues.length).toBeGreaterThan(0);
    expect(invalidTemporalNodeValues).toContain("2015-01-31");
    expect(invalidTemporalNodeValues).toContain("10:11:12");
  });
});
