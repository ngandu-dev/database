import { describe, expect, it } from "vitest";

import { OraclePlatform } from "../../platforms/oracle-platform";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { Connection } from "../../portability/connection";
import { OptimizeFlags } from "../../portability/optimize-flags";

describe("Portability/OptimizeFlags (Doctrine parity)", () => {
  it("clears EMPTY_TO_NULL for oracle", () => {
    const optimizeFlags = new OptimizeFlags();
    const flags = optimizeFlags.apply(new OraclePlatform(), Connection.PORTABILITY_ALL);

    expect(flags & Connection.PORTABILITY_EMPTY_TO_NULL).toBe(0);
  });

  it("keeps flags unchanged for other platforms", () => {
    const optimizeFlags = new OptimizeFlags();
    const flags = optimizeFlags.apply(new SQLitePlatform(), Connection.PORTABILITY_ALL);

    expect(flags).toBe(Connection.PORTABILITY_ALL);
  });
});
