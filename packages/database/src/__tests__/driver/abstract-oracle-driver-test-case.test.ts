import { describe, expect, it } from "vitest";

import { AbstractOracleDriver } from "../../driver/abstract-oracle-driver";
import type { Connection as DriverConnection } from "../../driver/connection";
import { OraclePlatform } from "../../platforms/oracle-platform";

class TestOracleDriver extends AbstractOracleDriver {
  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    throw new Error("not needed");
  }
}

describe("Driver AbstractOracleDriverTestCase parity", () => {
  it("creates Oracle platforms without server-version branching", () => {
    expect(new TestOracleDriver().getDatabasePlatform({} as never)).toBeInstanceOf(OraclePlatform);
  });

  it.skip(
    "Oracle drivers do not use server version to instantiate platform (Doctrine parity skip)",
  );
});
