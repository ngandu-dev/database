import { describe, expect, it } from "vitest";

import { StaticServerVersionProvider } from "../../connection/static-server-version-provider";
import type { Driver } from "../../driver";
import { MySQL2Driver } from "../../driver/mysql2/driver";
import { PgDriver } from "../../driver/pg/driver";
import type { AbstractPlatform } from "../../platforms/abstract-platform";
import { InvalidPlatformVersion } from "../../platforms/exception/invalid-platform-version";
import { MariaDBPlatform } from "../../platforms/mariadb-platform";
import { MariaDB1010Platform } from "../../platforms/mariadb1010-platform";
import { MariaDB1052Platform } from "../../platforms/mariadb1052-platform";
import { MariaDB1060Platform } from "../../platforms/mariadb1060-platform";
import { MariaDB110700Platform } from "../../platforms/mariadb110700-platform";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { MySQL80Platform } from "../../platforms/mysql80-platform";
import { MySQL84Platform } from "../../platforms/mysql84-platform";
import { PostgreSQLPlatform } from "../../platforms/postgresql-platform";
import { PostgreSQL120Platform } from "../../platforms/postgresql120-platform";

describe("VersionAwarePlatformDriver", () => {
  it.each(
    mySqlVersionProvider(),
  )("MySQL2Driver instantiates %p for version %p", async (version, expectedClass) => {
    await assertDriverInstantiatesDatabasePlatform(new MySQL2Driver(), version, expectedClass);
  });

  it.each(
    postgreSqlVersionProvider(),
  )("PgDriver instantiates %p for version %p", async (version, expectedClass) => {
    await assertDriverInstantiatesDatabasePlatform(new PgDriver(), version, expectedClass);
  });

  it("throws on malformed MySQL/MariaDB versions", async () => {
    await expect(
      new MySQL2Driver().getDatabasePlatform(
        new StaticServerVersionProvider("mariadb-not-a-version"),
      ),
    ).rejects.toThrow(InvalidPlatformVersion);

    await expect(
      new MySQL2Driver().getDatabasePlatform(
        new StaticServerVersionProvider("totally-invalid-version"),
      ),
    ).rejects.toThrow(InvalidPlatformVersion);
  });

  it("throws on malformed PostgreSQL versions", async () => {
    await expect(
      new PgDriver().getDatabasePlatform(new StaticServerVersionProvider("not-a-postgres-version")),
    ).rejects.toThrow(InvalidPlatformVersion);
  });
});

async function assertDriverInstantiatesDatabasePlatform(
  driver: Driver,
  version: string,
  expectedClass: new (...args: never[]) => AbstractPlatform,
): Promise<void> {
  const platform = await driver.getDatabasePlatform(new StaticServerVersionProvider(version));

  expect(platform).toBeInstanceOf(expectedClass);
}

function mySqlVersionProvider(): Array<[string, new (...args: never[]) => AbstractPlatform]> {
  return [
    ["5.7.0", MySQLPlatform],
    ["8.0.11", MySQL80Platform],
    ["8.4.1", MySQL84Platform],
    ["9.0.0", MySQL84Platform],
    ["5.5.40-MariaDB-1~wheezy", MariaDBPlatform],
    ["5.5.5-MariaDB-10.2.8+maria~xenial-log", MariaDBPlatform],
    ["10.2.8-MariaDB-10.2.8+maria~xenial-log", MariaDBPlatform],
    ["10.2.8-MariaDB-1~lenny-log", MariaDBPlatform],
    ["10.5.2-MariaDB-1~lenny-log", MariaDB1052Platform],
    ["10.6.0-MariaDB-1~lenny-log", MariaDB1060Platform],
    ["10.9.3-MariaDB-1~lenny-log", MariaDB1060Platform],
    ["11.0.2-MariaDB-1:11.0.2+maria~ubu2204", MariaDB1010Platform],
    ["11.7.1-MariaDB-ubu2404", MariaDB110700Platform],
  ];
}

function postgreSqlVersionProvider(): Array<[string, new (...args: never[]) => AbstractPlatform]> {
  return [
    ["10.0", PostgreSQLPlatform],
    ["11.0", PostgreSQLPlatform],
    ["12.0", PostgreSQL120Platform],
    ["13.16", PostgreSQL120Platform],
    ["16.4", PostgreSQL120Platform],
  ];
}
