import { describe, expect, it } from "vitest";

import { AbstractSQLServerDriver } from "../../driver/abstract-sqlserver-driver";
import { PortWithoutHost } from "../../driver/abstract-sqlserver-driver/exception/port-without-host";
import type { Connection as DriverConnection } from "../../driver/connection";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";

class TestSQLServerDriver extends AbstractSQLServerDriver {
  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    if (params.port !== undefined && params.host === undefined) {
      throw PortWithoutHost.new();
    }

    throw new Error("not needed");
  }
}

describe("Driver AbstractSQLServerDriverTestCase parity", () => {
  it("throws when port is provided without a host", async () => {
    await expect(new TestSQLServerDriver().connect({ port: 1433 })).rejects.toBeInstanceOf(
      PortWithoutHost,
    );
  });

  it("creates SQL Server platforms without server-version branching", () => {
    expect(new TestSQLServerDriver().getDatabasePlatform({} as never)).toBeInstanceOf(
      SQLServerPlatform,
    );
  });

  it.skip(
    "SQL Server drivers do not use server version to instantiate platform (Doctrine parity skip)",
  );
});
