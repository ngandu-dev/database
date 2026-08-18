import { coerce, gte } from "semver";

import type { Driver } from "../driver";
import { AbstractMySQLPlatform } from "../platforms/abstract-mysql-platform";
import { InvalidPlatformVersion } from "../platforms/exception/invalid-platform-version";
import { MariaDBPlatform } from "../platforms/mariadb-platform";
import { MariaDB1010Platform } from "../platforms/mariadb1010-platform";
import { MariaDB1052Platform } from "../platforms/mariadb1052-platform";
import { MariaDB1060Platform } from "../platforms/mariadb1060-platform";
import { MariaDB110700Platform } from "../platforms/mariadb110700-platform";
import { MySQLPlatform } from "../platforms/mysql-platform";
import { MySQL80Platform } from "../platforms/mysql80-platform";
import { MySQL84Platform } from "../platforms/mysql84-platform";
import type { ServerVersionProvider } from "../server-version-provider";
import type { ExceptionConverter as DriverExceptionConverter } from "./api/exception-converter";
import { ExceptionConverter } from "./api/mysql/exception-converter";

export abstract class AbstractMySQLDriver implements Driver {
  public async getDatabasePlatform(
    versionProvider: ServerVersionProvider,
  ): Promise<AbstractMySQLPlatform> {
    const version = await versionProvider.getServerVersion();

    if (version.toLowerCase().includes("mariadb")) {
      const mariaDbVersion = this.getMariaDbMysqlVersionNumber(version);
      if (gte(mariaDbVersion, "11.7.0")) {
        return new MariaDB110700Platform();
      }

      if (gte(mariaDbVersion, "10.10.0")) {
        return new MariaDB1010Platform();
      }

      if (gte(mariaDbVersion, "10.6.0")) {
        return new MariaDB1060Platform();
      }

      if (gte(mariaDbVersion, "10.5.2")) {
        return new MariaDB1052Platform();
      }

      return new MariaDBPlatform();
    }

    const mysqlVersion = coerce(version)?.version;
    if (mysqlVersion === undefined) {
      throw InvalidPlatformVersion.new(version, "<major_version>.<minor_version>.<patch_version>");
    }

    if (gte(mysqlVersion, "8.4.0")) {
      return new MySQL84Platform();
    }

    if (gte(mysqlVersion, "8.0.0")) {
      return new MySQL80Platform();
    }

    return new MySQLPlatform();
  }

  public getExceptionConverter(): DriverExceptionConverter {
    return new ExceptionConverter();
  }

  public abstract connect(params: Record<string, unknown>): ReturnType<Driver["connect"]>;

  private getMariaDbMysqlVersionNumber(versionString: string): string {
    const match = /^(?:5\.5\.5-)?(?:mariadb-)?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)/i.exec(
      versionString,
    );

    if (match?.groups === undefined) {
      throw InvalidPlatformVersion.new(
        versionString,
        "^(?:5.5.5-)?(mariadb-)?<major_version>.<minor_version>.<patch_version>",
      );
    }

    return `${match.groups.major}.${match.groups.minor}.${match.groups.patch}`;
  }
}
