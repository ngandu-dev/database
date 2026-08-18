import { describe, expect, it } from "vitest";

import { StaticServerVersionProvider } from "../../../connection/static-server-version-provider";
import type { Driver } from "../../../driver";
import type { ExceptionConverter } from "../../../driver/api/exception-converter";
import { AbstractDriverMiddleware } from "../../../driver/middleware/abstract-driver-middleware";
import { DriverException } from "../../../exception/driver-exception";
import { MySQLPlatform } from "../../../platforms/mysql-platform";

class TestDriverMiddleware extends AbstractDriverMiddleware {}

class SpyExceptionConverter implements ExceptionConverter {
  public convert(): DriverException {
    return new DriverException("driver error", { driverName: "spy", operation: "connect" });
  }
}

describe("AbstractDriverMiddleware", () => {
  it("delegates connect()", async () => {
    const connection = { connection: true };
    const driver: Driver = {
      connect: async (params) => {
        expect(params).toEqual({ host: "localhost" });
        return connection as never;
      },
      getDatabasePlatform: () => new MySQLPlatform(),
      getExceptionConverter: () => new SpyExceptionConverter(),
    };

    const middleware = new TestDriverMiddleware(driver);

    expect(await middleware.connect({ host: "localhost" })).toBe(connection);
  });

  it("delegates getExceptionConverter() and getDatabasePlatform()", () => {
    const converter = new SpyExceptionConverter();
    const platform = new MySQLPlatform();
    const driver: Driver = {
      connect: async () => ({}) as never,
      getDatabasePlatform: () => platform,
      getExceptionConverter: () => converter,
    };

    const middleware = new TestDriverMiddleware(driver);

    expect(middleware.getExceptionConverter()).toBe(converter);
    expect(middleware.getDatabasePlatform(new StaticServerVersionProvider("8.0.0"))).toBe(platform);
  });
});
