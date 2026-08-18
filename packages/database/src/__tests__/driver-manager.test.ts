import { describe, expect, it } from "vitest";

import { Connection } from "../connection";
import type { Driver } from "../driver";
import type { ExceptionConverter } from "../driver/api/exception-converter";
import type { Connection as DriverConnection } from "../driver/connection";
import { MySQL2Driver } from "../driver/mysql2/driver";
import { SQLite3Driver } from "../driver/sqlite3/driver";
import { DriverManager } from "../driver-manager";
import { DriverRequired } from "../exception/driver-required";
import { UnknownDriver } from "../exception/unknown-driver";
import { DsnParser } from "../tools/dsn-parser";

type DriverManagerParams = Parameters<typeof DriverManager.getConnection>[0];

class DummyDriver implements Driver {
  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    throw new Error("not implemented");
  }

  public getExceptionConverter(): ExceptionConverter {
    throw new Error("not implemented");
  }

  public getDatabasePlatform(): never {
    throw new Error("not implemented");
  }
}

class DummyConnectionWrapper extends Connection {}

describe("DriverManager (Doctrine root-level parity)", () => {
  it("throws when connection params do not define a driver", () => {
    expect(() => DriverManager.getConnection({})).toThrow(DriverRequired);
  });

  it("throws when an invalid driver name is configured", () => {
    expect(() =>
      DriverManager.getConnection({
        driver: "invalid_driver" as never,
      }),
    ).toThrow(UnknownDriver);
  });

  it("accepts a valid custom driverClass", () => {
    const connection = DriverManager.getConnection({
      driverClass: DummyDriver,
    });

    expect(connection.getDriver()).toBeInstanceOf(DummyDriver);
  });

  it("creates a connection from parsed database URL params (MySQL-like URL)", () => {
    const parser = new DsnParser({
      pdo_mysql: "mysql2",
      pdo_sqlite: "sqlite3",
    });

    const params = parser.parse("pdo-mysql://foo:bar@localhost:11211/baz");
    const connection = DriverManager.getConnection(params as DriverManagerParams);

    expect(connection.getDriver()).toBeInstanceOf(MySQL2Driver);
    expect(connection.getParams()).toMatchObject({
      dbname: "baz",
      host: "localhost",
      password: "bar",
      port: 11211,
      user: "foo",
    });
  });

  it("creates a connection from parsed sqlite URLs (memory and file path)", () => {
    const parser = new DsnParser({
      pdo_sqlite: "sqlite3",
    });

    const memoryConnection = DriverManager.getConnection(
      parser.parse("pdo-sqlite:///:memory:") as DriverManagerParams,
    );
    const fileConnection = DriverManager.getConnection(
      parser.parse("pdo-sqlite:////tmp/dbname.sqlite") as DriverManagerParams,
    );

    expect(memoryConnection.getDriver()).toBeInstanceOf(SQLite3Driver);
    expect(memoryConnection.getParams()).toMatchObject({
      host: "localhost",
      memory: true,
    });

    expect(fileConnection.getDriver()).toBeInstanceOf(SQLite3Driver);
    expect(fileConnection.getParams()).toMatchObject({
      host: "localhost",
      path: "/tmp/dbname.sqlite",
    });
  });

  it("lets URL params override individual params when merged before getConnection()", () => {
    const parser = new DsnParser({
      pdo_mysql: "mysql2",
    });

    const merged = {
      password: "lulz",
      ...parser.parse("pdo-mysql://foo:bar@localhost/baz"),
    };
    const connection = DriverManager.getConnection(merged as DriverManagerParams);

    expect(connection.getDriver()).toBeInstanceOf(MySQL2Driver);
    expect(connection.getParams()).toMatchObject({
      dbname: "baz",
      host: "localhost",
      password: "bar",
      user: "foo",
    });
  });

  it("supports wrapperClass parity scenarios", () => {
    const connection = DriverManager.getConnection({
      driverClass: DummyDriver,
      wrapperClass: DummyConnectionWrapper,
    } as DriverManagerParams);

    expect(connection).toBeInstanceOf(DummyConnectionWrapper);
    expect(connection.getDriver()).toBeInstanceOf(DummyDriver);
  });
});
