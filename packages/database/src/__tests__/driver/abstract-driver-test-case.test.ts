import { describe, expect, it } from "vitest";

import type { Driver } from "../../driver";
import { ParameterBindingStyle } from "../../driver/_internal";
import type { ExceptionConverter } from "../../driver/api/exception-converter";
import type { Connection as DriverConnection } from "../../driver/connection";
import { MySQLPlatform } from "../../platforms/mysql-platform";

class TestDriver implements Driver {
  public readonly name = "test-driver";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    throw new Error("not needed");
  }

  public getExceptionConverter(): ExceptionConverter {
    return { convert: () => new Error("not needed") as any };
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

describe("Driver AbstractDriverTestCase parity scaffold", () => {
  it("creates a driver through a factory-style setup", () => {
    const createDriver = (): Driver => new TestDriver();
    const driver = createDriver();

    expect(driver).toBeInstanceOf(TestDriver);
    expect(driver.getDatabasePlatform({} as never)).toBeInstanceOf(MySQLPlatform);
  });
});
