import { describe, expect, it } from "vitest";

import type { Driver } from "../../driver";
import type { ExceptionConverter } from "../../driver/api/exception-converter";
import type { Connection as DriverConnection } from "../../driver/connection";
import { MalformedDsnException } from "../../exception/malformed-dsn-exception";
import { DsnParser } from "../../tools/dsn-parser";

class DummyDriver implements Driver {
  public readonly name = "dummy";

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

describe("DsnParser", () => {
  it("parses a regular DSN into connection params", () => {
    const parser = new DsnParser();
    const params = parser.parse(
      "mysql2://bernard:123456@192.168.4.11:3306/testmain_db?charset=utf8mb4&sslmode=disable",
    );

    expect(params).toEqual({
      charset: "utf8mb4",
      dbname: "testmain_db",
      driver: "mysql2",
      host: "192.168.4.11",
      password: "123456",
      port: 3306,
      sslmode: "disable",
      user: "bernard",
    });
  });

  it("decodes credentials, db name and query values", () => {
    const parser = new DsnParser();
    const params = parser.parse("mysql2://user:pa%24%24@localhost/my%2Fdb?application_name=my+app");

    expect(params).toEqual({
      application_name: "my app",
      dbname: "my/db",
      driver: "mysql2",
      host: "localhost",
      password: "pa$$",
      user: "user",
    });
  });

  it("maps scheme aliases and driver classes", () => {
    const parser = new DsnParser({
      custom: DummyDriver,
      pdo_mysql: "mysql2",
    });

    const mapped = parser.parse("pdo-mysql://user:pass@localhost/main");
    const withClass = parser.parse("custom://localhost/main");

    expect(mapped).toEqual({
      dbname: "main",
      driver: "mysql2",
      host: "localhost",
      password: "pass",
      user: "user",
    });
    expect(withClass).toEqual({
      dbname: "main",
      driverClass: DummyDriver,
      host: "localhost",
    });
  });

  it("parses sqlite memory and file paths", () => {
    const parser = new DsnParser();

    const memory = parser.parse("sqlite:///:memory:");
    const file = parser.parse("sqlite:////var/data/app.db");

    expect(memory).toEqual({
      driver: "sqlite3",
      host: "localhost",
      memory: true,
    });
    expect(file).toEqual({
      driver: "sqlite3",
      host: "localhost",
      path: "/var/data/app.db",
    });
  });

  it("maps postgres URL schemes to pg driver", () => {
    const parser = new DsnParser();

    const params = parser.parse("postgresql://user:pass@localhost/app");

    expect(params).toEqual({
      dbname: "app",
      driver: "pg",
      host: "localhost",
      password: "pass",
      user: "user",
    });
  });

  it("lets query params override parsed params", () => {
    const parser = new DsnParser();
    const params = parser.parse(
      "mysql2://user:pass@localhost/main?driver=mssql&dbname=other&port=1444",
    );

    expect(params).toEqual({
      dbname: "other",
      driver: "mssql",
      host: "localhost",
      password: "pass",
      port: "1444",
      user: "user",
    });
  });

  it("throws malformed dsn exception for invalid URLs", () => {
    const parser = new DsnParser();

    expect(() => parser.parse("not a valid dsn")).toThrow(MalformedDsnException);
  });
});
