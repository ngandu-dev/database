import { describe, expect, it } from "vitest";

import { StaticServerVersionProvider } from "../../connection/static-server-version-provider";
import { AbstractOracleDriver } from "../../driver/abstract-oracle-driver";
import { ExceptionConverter as OCIExceptionConverter } from "../../driver/api/oci/exception-converter";
import type { Connection as DriverConnection } from "../../driver/connection";
import { OraclePlatform } from "../../platforms/oracle-platform";

class TestOracleDriver extends AbstractOracleDriver {
  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    throw new Error("not used in this test");
  }
}

describe("AbstractOracleDriver", () => {
  it("returns OraclePlatform", () => {
    const driver = new TestOracleDriver();

    expect(driver.getDatabasePlatform(new StaticServerVersionProvider("19.0"))).toBeInstanceOf(
      OraclePlatform,
    );
  });

  it("returns the OCI exception converter", () => {
    const driver = new TestOracleDriver();

    expect(driver.getExceptionConverter()).toBeInstanceOf(OCIExceptionConverter);
  });
});
