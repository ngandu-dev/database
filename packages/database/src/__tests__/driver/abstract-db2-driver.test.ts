import { describe, expect, it } from "vitest";

import { StaticServerVersionProvider } from "../../connection/static-server-version-provider";
import { AbstractDB2Driver } from "../../driver/abstract-db2-driver";
import { ExceptionConverter as DB2ExceptionConverter } from "../../driver/api/db2/exception-converter";
import type { Connection as DriverConnection } from "../../driver/connection";
import { DB2Platform } from "../../platforms/db2-platform";

class TestDB2Driver extends AbstractDB2Driver {
  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    throw new Error("not used in this test");
  }
}

describe("AbstractDB2Driver", () => {
  it("returns DB2Platform", () => {
    const driver = new TestDB2Driver();

    expect(driver.getDatabasePlatform(new StaticServerVersionProvider("11.5"))).toBeInstanceOf(
      DB2Platform,
    );
  });

  it("returns the IBM DB2 exception converter", () => {
    const driver = new TestDB2Driver();

    expect(driver.getExceptionConverter()).toBeInstanceOf(DB2ExceptionConverter);
  });
});
