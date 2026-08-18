import type { Driver } from "../driver";
import { InvalidPlatformVersion } from "../platforms/exception/invalid-platform-version";
import { PostgreSQLPlatform } from "../platforms/postgresql-platform";
import { PostgreSQL120Platform } from "../platforms/postgresql120-platform";
import type { ServerVersionProvider } from "../server-version-provider";
import type { ExceptionConverter as DriverExceptionConverter } from "./api/exception-converter";
import { ExceptionConverter } from "./api/postgresql/exception-converter";

export abstract class AbstractPostgreSQLDriver implements Driver {
  public async getDatabasePlatform(
    versionProvider: ServerVersionProvider,
  ): Promise<PostgreSQLPlatform> {
    const version = await versionProvider.getServerVersion();

    const match = /^(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+))?)?/.exec(version);
    if (match?.groups === undefined) {
      throw InvalidPlatformVersion.new(version, "<major_version>.<minor_version>.<patch_version>");
    }

    const major = Number.parseInt(match.groups.major ?? "0", 10);
    if (Number.isNaN(major)) {
      throw InvalidPlatformVersion.new(version, "<major_version>.<minor_version>.<patch_version>");
    }

    if (major >= 12) {
      return new PostgreSQL120Platform();
    }

    return new PostgreSQLPlatform();
  }

  public getExceptionConverter(): DriverExceptionConverter {
    return new ExceptionConverter();
  }

  public abstract connect(params: Record<string, unknown>): ReturnType<Driver["connect"]>;
}
